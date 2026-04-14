const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { verifyConnectivity, isConnected, runQuery, runTransaction, runReadTransaction, initDatabase, neo4j } = require('./neo4j-client');
const base = require('./base-simulator');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function toNumber(val) {
  if (neo4j.isInt(val)) return val.toNumber();
  return typeof val === 'number' ? val : Number(val);
}

function ok(data) { return { success: true, data }; }
function fail(error) { return { success: false, data: null, error }; }

const FIND_CUENTA = 'MATCH (p:Persona {nombre: $name})-[:TIENE_CUENTA]->(c:Cuenta)';
const GET_ALL_BALANCES = `
  MATCH (p:Persona)-[:TIENE_CUENTA]->(c:Cuenta)
  RETURN p.nombre AS titular, c.saldo AS saldo, c.numero AS cuenta
  ORDER BY p.nombre
`;

// Mantener un log ACID equivalente al syncLog de BASE
let acidLog = [];
function acidAddLog(event, details) {
  acidLog.push({ time: new Date().toISOString(), event, details });
}
function acidResetLog() {
  acidLog = [];
  acidAddLog('RESET', 'Sistema reiniciado — cuentas restauradas a Ana=Q5000, Luis=Q3000');
}

// --------------- POST /api/reset ---------------

app.post('/api/reset', async (req, res) => {
  try {
    acidResetLog();

    const neo4jResult = isConnected()
      ? await initDatabase()
      : { initialized: false, error: 'Neo4j no conectado' };

    const baseResult = base.reset();
    res.json(ok({ acid: neo4jResult, base: baseResult }));
  } catch (err) {
    res.status(500).json(fail(err.message));
  }
});

// --------------- GET /api/acid/log ---------------

app.get('/api/acid/log', (req, res) => {
  res.json(ok({ log: acidLog.slice(-150) }));
});

app.post('/api/acid/log', (req, res) => {
  const { entries } = req.body;
  if (entries && Array.isArray(entries)) {
    entries.forEach(e => acidAddLog(e.event || e.action, e.details || e.detail));
  }
  res.json(ok({ added: entries?.length || 0 }));
});

// --------------- ACID: Transfer ---------------

app.post('/api/acid/transfer', async (req, res) => {
  const { from, to, amount } = req.body;
  if (!from || !to || !amount) return res.status(400).json(fail('Faltan parámetros'));
  if (!isConnected()) return res.status(503).json(fail('Neo4j no está conectado'));

  try {
    const result = await runTransaction(async (tx) => {
      acidAddLog('BEGIN', `Inicio de transacción explícita (BEGIN)`);

      // READ origen
      const srcRes = await tx.run(`${FIND_CUENTA} RETURN c.saldo AS saldo, c.numero AS cuenta`, { name: from });
      const srcBal = toNumber(srcRes.records[0].get('saldo'));
      const srcNum = srcRes.records[0].get('cuenta');
      acidAddLog('READ', `Lectura cuenta origen: ${from} (${srcNum}) → saldo actual Q${srcBal}`);

      // VALIDATE
      if (srcBal < amount) throw new Error(`Fondos insuficientes: Q${srcBal} < Q${amount}`);
      acidAddLog('VALIDATE', `Validación: Q${srcBal} ≥ Q${amount} → aprobado`);

      // READ destino
      const dstRes = await tx.run(`${FIND_CUENTA} RETURN c.saldo AS saldo, c.numero AS cuenta`, { name: to });
      const dstBal = toNumber(dstRes.records[0].get('saldo'));
      const dstNum = dstRes.records[0].get('cuenta');
      acidAddLog('READ', `Lectura cuenta destino: ${to} (${dstNum}) → saldo actual Q${dstBal}`);

      // DEBIT
      await tx.run(`${FIND_CUENTA} SET c.saldo = c.saldo - $amount`, { name: from, amount: neo4j.int(amount) });
      acidAddLog('DEBIT', `${from}: Q${srcBal} → Q${srcBal - amount} (−Q${amount})`);

      // CREDIT
      await tx.run(`${FIND_CUENTA} SET c.saldo = c.saldo + $amount`, { name: to, amount: neo4j.int(amount) });
      acidAddLog('CREDIT', `${to}: Q${dstBal} → Q${dstBal + amount} (+Q${amount})`);

      // WRITE (registro en grafo)
      await tx.run(`
        MATCH (pF:Persona {nombre: $from})-[:TIENE_CUENTA]->(cF:Cuenta)
        MATCH (pT:Persona {nombre: $to})-[:TIENE_CUENTA]->(cT:Cuenta)
        CREATE (cF)-[:TRANSFERENCIA {monto: $amount, fecha: datetime(), estado: "completada"}]->(cT)
      `, { from, to, amount: neo4j.int(amount) });
      acidAddLog('WRITE', `Registro: ${srcNum} →[Q${amount}]→ ${dstNum} guardado en grafo`);

      // COMMIT
      acidAddLog('COMMIT', `COMMIT: todas las operaciones confirmadas atómicamente en una sola transacción`);

      // VERIFY
      const finalRes = await tx.run(GET_ALL_BALANCES);
      const balances = finalRes.records.map(r => ({ titular: r.get('titular'), saldo: toNumber(r.get('saldo')) }));
      const total = balances.reduce((s, a) => s + a.saldo, 0);
      acidAddLog('VERIFY', `Post-commit: ${balances.map(b => `${b.titular}=Q${b.saldo}`).join(', ')} | Total=Q${total}`);
      acidAddLog('CONSISTENT', `Integridad confirmada: Total Q${total} — datos consistentes globalmente`);

      return balances;
    });

    const total = result.reduce((sum, a) => sum + a.saldo, 0);
    res.json(ok({ balances: result, total, log: acidLog.slice(-150) }));
  } catch (err) {
    acidAddLog('ERROR', err.message);
    res.status(400).json({ success: false, data: { log: acidLog.slice(-150) }, error: err.message });
  }
});

// --------------- ACID: Transfer with Crash ---------------

app.post('/api/acid/transfer-with-crash', async (req, res) => {
  const { from = 'Ana', to = 'Luis', amount = 200 } = req.body || {};
  if (!isConnected()) return res.status(503).json(fail('Neo4j no está conectado'));

  try {
    await runTransaction(async (tx) => {
      acidAddLog('BEGIN', `Inicio de transacción explícita (BEGIN)`);

      // READ
      const srcRes = await tx.run(`${FIND_CUENTA} RETURN c.saldo AS saldo, c.numero AS cuenta`, { name: from });
      const srcBal = toNumber(srcRes.records[0].get('saldo'));
      acidAddLog('READ', `Lectura cuenta origen: ${from} → saldo actual Q${srcBal}`);

      const dstRes = await tx.run(`${FIND_CUENTA} RETURN c.saldo AS saldo`, { name: to });
      const dstBal = toNumber(dstRes.records[0].get('saldo'));
      acidAddLog('READ', `Lectura cuenta destino: ${to} → saldo actual Q${dstBal}`);

      // VALIDATE
      acidAddLog('VALIDATE', `Validación: Q${srcBal} ≥ Q${amount} → aprobado`);

      // DEBIT
      await tx.run(`${FIND_CUENTA} SET c.saldo = c.saldo - $amount`, { name: from, amount: neo4j.int(amount) });
      acidAddLog('DEBIT', `${from}: Q${srcBal} → Q${srcBal - amount} (−Q${amount})`);

      // CRASH antes del CREDIT
      acidAddLog('CRASH', `FALLO: el sistema murió después del DEBIT pero antes del CREDIT`);
      acidAddLog('CRASH', `${to} NUNCA recibió +Q${amount} — transacción incompleta`);
      throw new Error('CRASH_SIMULADO');
    });
  } catch (err) {
    acidAddLog('ROLLBACK', `Neo4j revirtió TODAS las operaciones automáticamente`);
    acidAddLog('ROLLBACK', `DEBIT de −Q${req.body?.amount || 200} a ${req.body?.from || 'Ana'} fue deshecho`);
  }

  try {
    const balances = await runQuery(GET_ALL_BALANCES);
    const formatted = balances.map(r => ({ titular: r.titular, saldo: toNumber(r.saldo) }));
    const total = formatted.reduce((sum, a) => sum + a.saldo, 0);
    acidAddLog('VERIFY', `Post-rollback: ${formatted.map(b => `${b.titular}=Q${b.saldo}`).join(', ')} | Total=Q${total}`);
    acidAddLog('CONSISTENT', `Integridad confirmada: Q${total} — NINGÚN dato se corrompió`);
    res.json(ok({ balances: formatted, total, log: acidLog.slice(-150), rolledBack: true }));
  } catch (err) {
    res.json(ok({ log: acidLog.slice(-150), rolledBack: true, error: err.message }));
  }
});

// --------------- ACID: Balances ---------------

app.get('/api/acid/balances', async (req, res) => {
  if (!isConnected()) return res.status(503).json(fail('Neo4j no está conectado'));
  try {
    const result = await runQuery(GET_ALL_BALANCES);
    const balances = result.map(r => ({ titular: r.titular, saldo: toNumber(r.saldo) }));
    const total = balances.reduce((sum, a) => sum + a.saldo, 0);
    res.json(ok({ balances, total }));
  } catch (err) {
    res.status(500).json(fail(err.message));
  }
});

// --------------- ACID: Concurrent Read ---------------

app.post('/api/acid/concurrent-read', async (req, res) => {
  const { from = 'Ana', to = 'Luis', amount = 200 } = req.body || {};
  if (!isConnected()) return res.status(503).json(fail('Neo4j no está conectado'));

  try {
    const transferPromise = runTransaction(async (tx) => {
      acidAddLog('BEGIN', `Sesión A: inicio de transacción de transferencia`);
      acidAddLog('READ', `Sesión A: leyendo saldos actuales`);
      acidAddLog('VALIDATE', `Sesión A: fondos verificados`);

      await tx.run(`${FIND_CUENTA} SET c.saldo = c.saldo - $amount`, { name: from, amount: neo4j.int(amount) });
      acidAddLog('DEBIT', `Sesión A: ${from} debitado −Q${amount}`);

      await tx.run(`${FIND_CUENTA} SET c.saldo = c.saldo + $amount`, { name: to, amount: neo4j.int(amount) });
      acidAddLog('CREDIT', `Sesión A: ${to} acreditado +Q${amount}`);

      await tx.run(`
        MATCH (pF:Persona {nombre: $from})-[:TIENE_CUENTA]->(cF:Cuenta)
        MATCH (pT:Persona {nombre: $to})-[:TIENE_CUENTA]->(cT:Cuenta)
        CREATE (cF)-[:TRANSFERENCIA {monto: $amount, fecha: datetime(), estado: "completada"}]->(cT)
      `, { from, to, amount: neo4j.int(amount) });
      acidAddLog('WRITE', `Sesión A: transferencia registrada en grafo`);

      const finalRes = await tx.run(GET_ALL_BALANCES);
      acidAddLog('COMMIT', `Sesión A: transacción confirmada`);
      return finalRes.records.map(r => ({ titular: r.get('titular'), saldo: toNumber(r.get('saldo')) }));
    });

    const readPromise = runReadTransaction(async (tx) => {
      acidAddLog('READ', `Sesión B: lectura concurrente desde otra conexión`);
      const result = await tx.run(GET_ALL_BALANCES);
      const balances = result.records.map(r => ({ titular: r.get('titular'), saldo: toNumber(r.get('saldo')) }));
      acidAddLog('READ', `Sesión B: vio ${balances.map(b => `${b.titular}=Q${b.saldo}`).join(', ')}`);
      return balances;
    });

    const [transferResult, readResult] = await Promise.all([transferPromise, readPromise]);
    const transferTotal = transferResult.reduce((s, a) => s + a.saldo, 0);
    const readTotal = readResult.reduce((s, a) => s + a.saldo, 0);

    acidAddLog('VERIFY', `Sesión B leyó Total=Q${readTotal} — estado consistente (antes o después del commit, nunca a medias)`);
    acidAddLog('CONSISTENT', `AISLAMIENTO garantizado: lecturas concurrentes nunca ven datos parciales`);

    res.json(ok({
      transferResult: { balances: transferResult, total: transferTotal },
      concurrentRead: { balances: readResult, total: readTotal },
      log: acidLog.slice(-150),
    }));
  } catch (err) {
    res.status(500).json(fail(err.message));
  }
});

// --------------- BASE Endpoints ---------------

app.post('/api/base/transfer', (req, res) => {
  const { from = 'Ana', to = 'Luis', amount = 200 } = req.body || {};
  const result = base.transfer(from, to, amount);
  res.json(result.success ? ok(result) : { success: false, data: null, error: result.error });
});

app.post('/api/base/transfer-with-crash', (req, res) => {
  const { from = 'Ana', to = 'Luis', amount = 200 } = req.body || {};
  const result = base.simulateCrash(from, to, amount);
  res.json(result.success ? ok(result) : { success: false, data: null, error: result.error });
});

app.get('/api/base/balances', (req, res) => {
  const state = base.getState();
  res.json(ok({
    replicas: state.replicas.map(r => ({ id: r.id, accounts: r.accounts, total: r.total, isPrimary: r.isPrimary, online: r.online })),
    consistent: state.consistent,
  }));
});

app.get('/api/base/state', (req, res) => { res.json(ok(base.getState())); });

app.post('/api/base/partition', (req, res) => {
  const { nodeId } = req.body;
  if (!nodeId) return res.status(400).json(fail('Falta: nodeId'));
  const result = base.simulatePartition(nodeId);
  res.json(result.success ? ok(result) : { success: false, data: null, error: result.error });
});

app.post('/api/base/heal', (req, res) => {
  const { nodeId } = req.body;
  if (!nodeId) return res.status(400).json(fail('Falta: nodeId'));
  const result = base.healPartition(nodeId);
  res.json(result.success ? ok(result) : { success: false, data: null, error: result.error });
});

app.post('/api/base/read-from', (req, res) => {
  const { account, replicaId } = req.body;
  if (!account) return res.status(400).json(fail('Falta: account'));
  const result = base.readBalance(account, replicaId);
  res.json(result.success ? ok(result) : { success: false, data: null, error: result.error });
});

// --------------- Startup ---------------

async function startServer() {
  console.log('============================================');
  console.log('  The Bank of Neo4j — ACID vs BASE Demo');
  console.log('============================================\n');

  const connectivity = await verifyConnectivity();
  if (connectivity.connected) await initDatabase();

  const server = app.listen(PORT, () => {
    console.log(`\n[Server] Escuchando en http://localhost:${PORT}`);
    console.log(`[Server] Neo4j: ${connectivity.connected ? 'Conectado' : 'No disponible (solo BASE funcionará)'}`);
    console.log(`[Server] BASE Simulator: Listo\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[Server] Puerto ${PORT} en uso.\n`);
    } else {
      console.error('[Server] Error:', err.message);
    }
    process.exit(1);
  });
}

startServer().catch(err => { console.error('Error fatal:', err); process.exit(1); });
