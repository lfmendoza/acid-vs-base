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

// --------------- Helpers ---------------

function toNumber(val) {
  if (neo4j.isInt(val)) return val.toNumber();
  return typeof val === 'number' ? val : Number(val);
}

function ok(data) {
  return { success: true, data };
}

function fail(error) {
  return { success: false, data: null, error };
}

// Cypher: encontrar cuenta por nombre del titular (atraviesa el grafo)
const FIND_CUENTA = 'MATCH (p:Persona {nombre: $name})-[:TIENE_CUENTA]->(c:Cuenta)';
const GET_ALL_BALANCES = `
  MATCH (p:Persona)-[:TIENE_CUENTA]->(c:Cuenta)
  RETURN p.nombre AS titular, c.saldo AS saldo, c.numero AS cuenta
  ORDER BY p.nombre
`;

// --------------- POST /api/reset ---------------

app.post('/api/reset', async (req, res) => {
  try {
    const neo4jResult = isConnected()
      ? await initDatabase()
      : { initialized: false, error: 'Neo4j no conectado' };

    const baseResult = base.reset();
    res.json(ok({ acid: neo4jResult, base: baseResult }));
  } catch (err) {
    res.status(500).json(fail(err.message));
  }
});

// --------------- ACID Endpoints ---------------

app.post('/api/acid/transfer', async (req, res) => {
  const { from, to, amount } = req.body;
  if (!from || !to || !amount) return res.status(400).json(fail('Faltan parámetros: from, to, amount'));
  if (!isConnected()) return res.status(503).json(fail('Neo4j no está conectado'));

  const log = [];
  try {
    const result = await runTransaction(async (tx) => {
      log.push({ step: 1, action: 'BEGIN', detail: 'Transacción iniciada' });

      // Leer saldo del origen atravesando Persona -> Cuenta
      const srcResult = await tx.run(
        `${FIND_CUENTA} RETURN c.saldo AS saldo, c.numero AS cuenta`,
        { name: from }
      );
      const srcBalance = toNumber(srcResult.records[0].get('saldo'));
      const srcCuenta = srcResult.records[0].get('cuenta');
      log.push({ step: 2, action: 'READ', detail: `${from} (${srcCuenta}): saldo = Q${srcBalance}` });

      if (srcBalance < amount) {
        throw new Error(`Fondos insuficientes: ${from} tiene Q${srcBalance}, necesita Q${amount}`);
      }

      // Debitar origen
      await tx.run(
        `${FIND_CUENTA} SET c.saldo = c.saldo - $amount`,
        { name: from, amount: neo4j.int(amount) }
      );
      log.push({ step: 3, action: 'DEBIT', detail: `${from} debitado: -Q${amount}` });

      // Acreditar destino
      await tx.run(
        `${FIND_CUENTA} SET c.saldo = c.saldo + $amount`,
        { name: to, amount: neo4j.int(amount) }
      );
      log.push({ step: 4, action: 'CREDIT', detail: `${to} acreditado: +Q${amount}` });

      // Crear relación TRANSFERENCIA en el grafo
      await tx.run(`
        MATCH (pFrom:Persona {nombre: $from})-[:TIENE_CUENTA]->(cFrom:Cuenta)
        MATCH (pTo:Persona {nombre: $to})-[:TIENE_CUENTA]->(cTo:Cuenta)
        CREATE (cFrom)-[:TRANSFERENCIA {
          monto: $amount,
          fecha: datetime(),
          estado: "completada"
        }]->(cTo)
      `, { from, to, amount: neo4j.int(amount) });
      log.push({ step: 5, action: 'RELATION', detail: `Relación (:Cuenta)-[:TRANSFERENCIA {monto: ${amount}}]->(:Cuenta) creada` });

      log.push({ step: 6, action: 'COMMIT', detail: 'Transacción confirmada (COMMIT)' });

      const finalResult = await tx.run(GET_ALL_BALANCES);
      return finalResult.records.map(r => ({
        titular: r.get('titular'),
        saldo: toNumber(r.get('saldo')),
      }));
    });

    const total = result.reduce((sum, a) => sum + a.saldo, 0);
    res.json(ok({ balances: result, total, log }));
  } catch (err) {
    log.push({ step: log.length + 1, action: 'ERROR', detail: err.message });
    res.status(400).json({ success: false, data: { log }, error: err.message });
  }
});

app.post('/api/acid/transfer-with-crash', async (req, res) => {
  const { from = 'Ana', to = 'Luis', amount = 200 } = req.body || {};
  if (!isConnected()) return res.status(503).json(fail('Neo4j no está conectado'));

  const log = [];
  try {
    await runTransaction(async (tx) => {
      log.push({ step: 1, action: 'BEGIN', detail: 'Transacción iniciada' });

      const srcResult = await tx.run(
        `${FIND_CUENTA} RETURN c.saldo AS saldo, c.numero AS cuenta`,
        { name: from }
      );
      const srcBalance = toNumber(srcResult.records[0].get('saldo'));
      log.push({ step: 2, action: 'READ', detail: `${from}: saldo = Q${srcBalance}` });

      // Debitar origen
      await tx.run(
        `${FIND_CUENTA} SET c.saldo = c.saldo - $amount`,
        { name: from, amount: neo4j.int(amount) }
      );
      log.push({ step: 3, action: 'DEBIT', detail: `${from} debitado: -Q${amount}` });

      // CRASH antes de acreditar y antes de crear la relación
      log.push({ step: 4, action: 'CRASH', detail: 'ERROR simulado antes de acreditar a destino y crear relación' });
      throw new Error('CRASH_SIMULADO: Fallo del sistema antes de completar la transferencia');
    });
  } catch (err) {
    log.push({ step: 5, action: 'ROLLBACK', detail: 'Transacción revertida — saldos y grafo sin cambios' });
  }

  try {
    const balances = await runQuery(GET_ALL_BALANCES);
    const formatted = balances.map(r => ({ titular: r.titular, saldo: toNumber(r.saldo) }));
    const total = formatted.reduce((sum, a) => sum + a.saldo, 0);
    res.json(ok({ balances: formatted, total, log, rolledBack: true }));
  } catch (err) {
    res.json(ok({ log, rolledBack: true, error: err.message }));
  }
});

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

app.post('/api/acid/concurrent-read', async (req, res) => {
  const { from = 'Ana', to = 'Luis', amount = 200 } = req.body || {};
  if (!isConnected()) return res.status(503).json(fail('Neo4j no está conectado'));

  const log = [];

  try {
    const transferPromise = runTransaction(async (tx) => {
      log.push({ step: 1, action: 'TX_BEGIN', detail: 'Transacción de transferencia iniciada' });

      await tx.run(
        `${FIND_CUENTA} SET c.saldo = c.saldo - $amount`,
        { name: from, amount: neo4j.int(amount) }
      );
      log.push({ step: 2, action: 'TX_DEBIT', detail: `${from} debitado en transacción` });

      await tx.run(
        `${FIND_CUENTA} SET c.saldo = c.saldo + $amount`,
        { name: to, amount: neo4j.int(amount) }
      );
      log.push({ step: 3, action: 'TX_CREDIT', detail: `${to} acreditado en transacción` });

      await tx.run(`
        MATCH (pFrom:Persona {nombre: $from})-[:TIENE_CUENTA]->(cFrom:Cuenta)
        MATCH (pTo:Persona {nombre: $to})-[:TIENE_CUENTA]->(cTo:Cuenta)
        CREATE (cFrom)-[:TRANSFERENCIA {monto: $amount, fecha: datetime(), estado: "completada"}]->(cTo)
      `, { from, to, amount: neo4j.int(amount) });

      const finalResult = await tx.run(GET_ALL_BALANCES);
      log.push({ step: 4, action: 'TX_COMMIT', detail: 'Transacción confirmada' });
      return finalResult.records.map(r => ({ titular: r.get('titular'), saldo: toNumber(r.get('saldo')) }));
    });

    const readPromise = runReadTransaction(async (tx) => {
      log.push({ step: 'R1', action: 'READ_START', detail: 'Lectura concurrente desde otra sesión' });
      const result = await tx.run(GET_ALL_BALANCES);
      const balances = result.records.map(r => ({ titular: r.get('titular'), saldo: toNumber(r.get('saldo')) }));
      log.push({ step: 'R2', action: 'READ_RESULT', detail: `Lectura vio: ${balances.map(b => `${b.titular}=Q${b.saldo}`).join(', ')}` });
      return balances;
    });

    const [transferResult, readResult] = await Promise.all([transferPromise, readPromise]);

    const transferTotal = transferResult.reduce((s, a) => s + a.saldo, 0);
    const readTotal = readResult.reduce((s, a) => s + a.saldo, 0);

    log.push({
      step: 5,
      action: 'ISOLATION',
      detail: `Lectura concurrente vio total=Q${readTotal} (consistente). ACID garantiza aislamiento.`,
    });

    res.json(ok({
      transferResult: { balances: transferResult, total: transferTotal },
      concurrentRead: { balances: readResult, total: readTotal },
      log,
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
    replicas: state.replicas.map(r => ({
      id: r.id,
      accounts: r.accounts,
      total: r.total,
      isPrimary: r.isPrimary,
      online: r.online,
    })),
    consistent: state.consistent,
  }));
});

app.get('/api/base/state', (req, res) => {
  res.json(ok(base.getState()));
});

app.post('/api/base/partition', (req, res) => {
  const { nodeId } = req.body;
  if (!nodeId) return res.status(400).json(fail('Falta parámetro: nodeId'));
  const result = base.simulatePartition(nodeId);
  res.json(result.success ? ok(result) : { success: false, data: null, error: result.error });
});

app.post('/api/base/heal', (req, res) => {
  const { nodeId } = req.body;
  if (!nodeId) return res.status(400).json(fail('Falta parámetro: nodeId'));
  const result = base.healPartition(nodeId);
  res.json(result.success ? ok(result) : { success: false, data: null, error: result.error });
});

app.post('/api/base/read-from', (req, res) => {
  const { account, replicaId } = req.body;
  if (!account) return res.status(400).json(fail('Falta parámetro: account'));
  const result = base.readBalance(account, replicaId);
  res.json(result.success ? ok(result) : { success: false, data: null, error: result.error });
});

// --------------- Startup ---------------

async function startServer() {
  console.log('============================================');
  console.log('  The Bank of Neo4j — ACID vs BASE Demo');
  console.log('============================================\n');

  const connectivity = await verifyConnectivity();
  if (connectivity.connected) {
    await initDatabase();
  }

  const server = app.listen(PORT, () => {
    console.log(`\n[Server] Escuchando en http://localhost:${PORT}`);
    console.log(`[Server] Neo4j: ${connectivity.connected ? 'Conectado' : 'No disponible (solo BASE funcionará)'}`);
    console.log(`[Server] BASE Simulator: Listo\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[Server] El puerto ${PORT} ya está en uso.`);
      console.error(`[Server] Cierra el otro proceso o usa PORT=<otro> en .env\n`);
    } else {
      console.error('[Server] Error al iniciar:', err.message);
    }
    process.exit(1);
  });
}

startServer().catch(err => {
  console.error('Error fatal al iniciar:', err);
  process.exit(1);
});
