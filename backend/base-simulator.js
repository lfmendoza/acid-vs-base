// Simulador BASE: 3 réplicas en memoria con propagación asíncrona
// Los eventos de log usan los MISMOS nombres que ACID para permitir comparación directa

const INITIAL_ACCOUNTS = { Ana: 5000, Luis: 3000 };
const DEFAULT_PROPAGATION_DELAY = 2000;

let replicas = [];
let syncLog = [];
let pendingTimeouts = [];
let roundRobinIndex = 0;

function createInitialReplicas() {
  return [
    { id: 'node-1', accounts: { ...INITIAL_ACCOUNTS }, isPrimary: true, online: true, lastSync: Date.now() },
    { id: 'node-2', accounts: { ...INITIAL_ACCOUNTS }, isPrimary: false, online: true, lastSync: Date.now() },
    { id: 'node-3', accounts: { ...INITIAL_ACCOUNTS }, isPrimary: false, online: true, lastSync: Date.now() },
  ];
}

function reset() {
  pendingTimeouts.forEach(t => clearTimeout(t));
  pendingTimeouts = [];
  replicas = createInitialReplicas();
  syncLog = [];
  roundRobinIndex = 0;
  addLog('RESET', 'Sistema reiniciado — cuentas restauradas a Ana=Q5000, Luis=Q3000');
  return getState();
}

reset();

function addLog(event, details) {
  syncLog.push({ time: new Date().toISOString(), event, details });
}

function getPrimary() { return replicas.find(r => r.isPrimary); }
function getSecondaries() { return replicas.filter(r => !r.isPrimary); }
function snap(accounts) { return Object.entries(accounts).map(([k, v]) => `${k}=Q${v}`).join(', '); }

function transfer(from, to, amount, propagationDelay = DEFAULT_PROPAGATION_DELAY) {
  const primary = getPrimary();
  const secondaries = getSecondaries();

  // BEGIN — en BASE no hay transacción explícita, solo una operación directa
  addLog('BEGIN', `Operación iniciada — SIN transacción explícita (no hay BEGIN/COMMIT atómico)`);

  // READ origen
  if (primary.accounts[from] === undefined) {
    addLog('READ', `Error: cuenta "${from}" no encontrada`);
    return { success: false, error: `Cuenta "${from}" no existe` };
  }
  const oldFrom = primary.accounts[from];
  addLog('READ', `Lectura cuenta origen: ${from} → saldo actual Q${oldFrom} [solo en ${primary.id}]`);

  // READ destino
  if (primary.accounts[to] === undefined) {
    addLog('READ', `Error: cuenta "${to}" no encontrada`);
    return { success: false, error: `Cuenta "${to}" no existe` };
  }
  const oldTo = primary.accounts[to];
  addLog('READ', `Lectura cuenta destino: ${to} → saldo actual Q${oldTo} [solo en ${primary.id}]`);

  // VALIDATE
  if (oldFrom < amount) {
    addLog('VALIDATE', `RECHAZADO: Q${oldFrom} < Q${amount} — fondos insuficientes`);
    return { success: false, error: 'Fondos insuficientes' };
  }
  addLog('VALIDATE', `Validación: Q${oldFrom} ≥ Q${amount} → aprobado`);

  // DEBIT
  primary.accounts[from] -= amount;
  addLog('DEBIT', `${from}: Q${oldFrom} → Q${primary.accounts[from]} (−Q${amount}) [solo en ${primary.id}]`);

  // CREDIT
  primary.accounts[to] += amount;
  addLog('CREDIT', `${to}: Q${oldTo} → Q${primary.accounts[to]} (+Q${amount}) [solo en ${primary.id}]`);

  // WRITE — en BASE no se escribe en un grafo, solo se confirma en el primario
  primary.lastSync = Date.now();
  addLog('WRITE', `Cambios aplicados en ${primary.id} — NO hay registro transaccional global`);

  // NO COMMIT — en BASE no hay commit atómico, solo confirmación del primario
  addLog('ACK', `${primary.id} confirmó la escritura — pero los secundarios NO están actualizados aún`);

  // VERIFY del primario
  const primaryTotal = Object.values(primary.accounts).reduce((a, b) => a + b, 0);
  addLog('VERIFY', `${primary.id}: ${snap(primary.accounts)} | Total=Q${primaryTotal}`);

  // Señalar inconsistencia temporal
  secondaries.forEach(r => {
    addLog('STALE', `${r.id}: aún tiene ${snap(r.accounts)} — datos desactualizados`);
  });
  addLog('INCONSISTENT', `Estado actual: primario actualizado, secundarios pendientes — sistema INCONSISTENTE temporalmente`);

  // Propagación asíncrona
  addLog('PROPAGATION', `Propagación asíncrona iniciada a ${secondaries.length} secundarios (${propagationDelay}ms entre cada uno)`);

  secondaries.forEach((replica, index) => {
    const delay = propagationDelay * (index + 1);
    const timeout = setTimeout(() => {
      if (replica.online) {
        const before = snap(replica.accounts);
        replica.accounts = { ...primary.accounts };
        replica.lastSync = Date.now();
        addLog('SYNC', `${replica.id}: sincronizado (${before} → ${snap(replica.accounts)})`);

        const allEqual = replicas.every(r => JSON.stringify(r.accounts) === JSON.stringify(primary.accounts));
        if (allEqual) {
          addLog('CONSISTENT', `Convergencia eventual completada — todas las réplicas consistentes`);
          addLog('VERIFY', `Estado global: ${snap(primary.accounts)} | Total=Q${primaryTotal}`);
        }
      } else {
        addLog('SYNC_FAILED', `${replica.id}: OFFLINE — replicación falló`);
      }
    }, delay);
    pendingTimeouts.push(timeout);
  });

  return { success: true, primaryState: { ...primary.accounts }, propagationPending: true };
}

function simulateCrash(from = 'Ana', to = 'Luis', amount = 200) {
  const primary = getPrimary();
  const secondaries = getSecondaries();

  // Los mismos pasos que transfer, pero crash después del write
  addLog('BEGIN', `Operación iniciada — SIN transacción explícita`);

  const oldFrom = primary.accounts[from];
  const oldTo = primary.accounts[to];

  // READ
  addLog('READ', `Lectura cuenta origen: ${from} → saldo actual Q${oldFrom} [solo en ${primary.id}]`);
  addLog('READ', `Lectura cuenta destino: ${to} → saldo actual Q${oldTo} [solo en ${primary.id}]`);

  // VALIDATE
  if (oldFrom < amount) {
    addLog('VALIDATE', `RECHAZADO: fondos insuficientes`);
    return { success: false, error: 'Fondos insuficientes' };
  }
  addLog('VALIDATE', `Validación: Q${oldFrom} ≥ Q${amount} → aprobado`);

  // DEBIT
  primary.accounts[from] -= amount;
  addLog('DEBIT', `${from}: Q${oldFrom} → Q${primary.accounts[from]} (−Q${amount}) [solo en ${primary.id}]`);

  // CREDIT
  primary.accounts[to] += amount;
  addLog('CREDIT', `${to}: Q${oldTo} → Q${primary.accounts[to]} (+Q${amount}) [solo en ${primary.id}]`);

  // WRITE
  primary.lastSync = Date.now();
  addLog('WRITE', `Cambios aplicados en ${primary.id}`);
  addLog('ACK', `${primary.id} confirmó — cambios son PERMANENTES (no hay rollback en BASE)`);

  // VERIFY del primario
  const primaryTotal = Object.values(primary.accounts).reduce((a, b) => a + b, 0);
  addLog('VERIFY', `${primary.id}: ${snap(primary.accounts)} | Total=Q${primaryTotal}`);

  // CRASH
  addLog('CRASH', `FALLO DEL SISTEMA — proceso de propagación interrumpido`);
  addLog('CRASH', `A diferencia de ACID: NO hay ROLLBACK — el DEBIT y CREDIT ya son permanentes en ${primary.id}`);

  // Estado de cada secundario
  secondaries.forEach(r => {
    addLog('STALE', `${r.id}: mantiene datos ANTERIORES → ${snap(r.accounts)}`);
  });

  // Comparar
  secondaries.forEach(r => {
    const secTotal = Object.values(r.accounts).reduce((a, b) => a + b, 0);
    addLog('INCONSISTENT', `${r.id} Total=Q${secTotal} vs ${primary.id} Total=Q${primaryTotal}`);
  });

  // Convergencia eventual
  addLog('RECOVERY', `Anti-entropy daemon detectará la divergencia eventualmente...`);

  secondaries.forEach((replica, index) => {
    const recoveryDelay = 6000 + (index * 2000);
    const timeout = setTimeout(() => {
      if (replica.online) {
        const before = snap(replica.accounts);
        replica.accounts = { ...primary.accounts };
        replica.lastSync = Date.now();
        addLog('SYNC', `${replica.id}: daemon sincronizó (${before} → ${snap(replica.accounts)})`);

        const allEqual = replicas.every(r => JSON.stringify(r.accounts) === JSON.stringify(primary.accounts));
        if (allEqual) {
          addLog('CONSISTENT', `Convergencia eventual completada — todas las réplicas consistentes`);
          addLog('VERIFY', `Estado global: ${snap(primary.accounts)} | Total=Q${primaryTotal}`);
        }
      }
    }, recoveryDelay);
    pendingTimeouts.push(timeout);
  });

  addLog('RECOVERY', `Convergencia programada en 6-10 segundos`);

  return {
    success: true, crashed: true,
    primaryState: { ...primary.accounts },
    secondariesStale: secondaries.map(r => ({ id: r.id, accounts: { ...r.accounts } })),
  };
}

function readBalance(account, replicaId = null) {
  let replica;

  if (replicaId) {
    replica = replicas.find(r => r.id === replicaId);
    if (!replica) return { success: false, error: `Réplica "${replicaId}" no encontrada` };
    addLog('READ', `Lectura dirigida a ${replicaId}`);
  } else {
    const online = replicas.filter(r => r.online);
    if (online.length === 0) {
      addLog('READ', 'Ninguna réplica disponible');
      return { success: false, error: 'No hay réplicas disponibles' };
    }
    replica = online[roundRobinIndex % online.length];
    roundRobinIndex++;
    addLog('READ', `Round-robin → ${replica.id} (${online.length} réplicas online)`);
  }

  const balance = replica.accounts[account];
  const isStale = replica.lastSync < getPrimary().lastSync;

  addLog('READ', `${replica.id}: ${account} = Q${balance}${isStale ? ' ⚠ DESACTUALIZADO' : ''}`);

  if (isStale) {
    const fresh = getPrimary().accounts[account];
    addLog('STALE', `Valor real en primario: ${account}=Q${fresh} — cliente recibió dato viejo (dif: Q${Math.abs(fresh - balance)})`);
  }

  return { success: true, replicaId: replica.id, account, balance, isStale };
}

function simulatePartition(nodeId) {
  const replica = replicas.find(r => r.id === nodeId);
  if (!replica) return { success: false, error: `Nodo "${nodeId}" no encontrado` };

  replica.online = false;
  addLog('PARTITION', `${nodeId} → OFFLINE (partición de red simulada)`);

  const online = replicas.filter(r => r.online);
  addLog('PARTITION', `Topología: ${online.map(r => r.id).join(', ')} online (${online.length}/${replicas.length})`);
  addLog('PARTITION', `Sistema sigue operando con ${online.length} nodos — BASE prioriza DISPONIBILIDAD`);

  return { success: true, nodeId, online: false };
}

function healPartition(nodeId) {
  const replica = replicas.find(r => r.id === nodeId);
  if (!replica) return { success: false, error: `Nodo "${nodeId}" no encontrado` };

  replica.online = true;

  const primary = getPrimary();
  const before = snap(replica.accounts);
  replica.accounts = { ...primary.accounts };
  replica.lastSync = Date.now();

  addLog('HEAL', `${nodeId} → ONLINE (reconectado)`);
  addLog('SYNC', `Catch-up: ${nodeId} sincronizado (${before} → ${snap(replica.accounts)})`);

  const allEqual = replicas.every(r => JSON.stringify(r.accounts) === JSON.stringify(primary.accounts));
  if (allEqual) {
    addLog('CONSISTENT', `Todas las réplicas consistentes`);
  }
  addLog('VERIFY', `Topología: ${replicas.map(r => r.id).join(', ')} — todos online`);

  return { success: true, nodeId, online: true, accounts: { ...replica.accounts } };
}

function getState() {
  const allEqual = replicas.every(r => JSON.stringify(r.accounts) === JSON.stringify(replicas[0].accounts));
  return {
    replicas: replicas.map(r => ({
      id: r.id, accounts: { ...r.accounts }, isPrimary: r.isPrimary,
      online: r.online, total: Object.values(r.accounts).reduce((a, b) => a + b, 0), lastSync: r.lastSync,
    })),
    consistent: allEqual,
    syncLog: syncLog.slice(-150),
  };
}

module.exports = { reset, transfer, simulateCrash, readBalance, simulatePartition, healPartition, getState };
