// Simulador BASE: 3 réplicas en memoria con propagación asíncrona

const INITIAL_ACCOUNTS = { Ana: 5000, Luis: 3000 };
const DEFAULT_PROPAGATION_DELAY = 2000; // ms por réplica

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
  addLog('RESET', 'Todas las réplicas restauradas al estado inicial (Ana=5000, Luis=3000)');
  return getState();
}

reset();

function addLog(event, details) {
  syncLog.push({ time: new Date().toISOString(), event, details });
}

function getPrimary() {
  return replicas.find(r => r.isPrimary);
}

function getSecondaries() {
  return replicas.filter(r => !r.isPrimary);
}

function snapshotAccounts(accounts) {
  return Object.entries(accounts).map(([k, v]) => `${k}=Q${v}`).join(', ');
}

function transfer(from, to, amount, propagationDelay = DEFAULT_PROPAGATION_DELAY) {
  const primary = getPrimary();
  const secondaries = getSecondaries();

  addLog('REQUEST', `Solicitud de transferencia: ${from} → ${to} por Q${amount}`);
  addLog('ROUTING', `Escritura dirigida al nodo primario (${primary.id})`);

  // Validaciones
  if (primary.accounts[from] === undefined) {
    addLog('VALIDATION_FAIL', `Cuenta "${from}" no existe en el primario`);
    return { success: false, error: `Cuenta "${from}" no existe` };
  }
  if (primary.accounts[to] === undefined) {
    addLog('VALIDATION_FAIL', `Cuenta "${to}" no existe en el primario`);
    return { success: false, error: `Cuenta "${to}" no existe` };
  }

  addLog('VALIDATION', `Verificando saldo: ${from} tiene Q${primary.accounts[from]}, necesita Q${amount}`);

  if (primary.accounts[from] < amount) {
    addLog('VALIDATION_FAIL', `Fondos insuficientes: Q${primary.accounts[from]} < Q${amount}`);
    return { success: false, error: 'Fondos insuficientes' };
  }

  addLog('VALIDATION', `Saldo suficiente — aprobado`);

  // Escritura en primario
  const oldFrom = primary.accounts[from];
  const oldTo = primary.accounts[to];
  primary.accounts[from] -= amount;
  primary.accounts[to] += amount;
  primary.lastSync = Date.now();

  addLog('WRITE_PRIMARY', `${primary.id}: ${from} Q${oldFrom} → Q${primary.accounts[from]} (−Q${amount})`);
  addLog('WRITE_PRIMARY', `${primary.id}: ${to} Q${oldTo} → Q${primary.accounts[to]} (+Q${amount})`);
  addLog('ACK_PRIMARY', `Escritura confirmada en primario. Estado: ${snapshotAccounts(primary.accounts)}`);

  // Estado de secundarios ANTES de la propagación
  addLog('REPLICA_STATE', `Secundarios AÚN tienen datos anteriores: ${from}=Q${oldFrom}, ${to}=Q${oldTo}`);

  // Propagación asíncrona
  addLog('PROPAGATION_START', `Iniciando propagación asíncrona a ${secondaries.length} secundarios`);

  secondaries.forEach((replica, index) => {
    const delay = propagationDelay * (index + 1);
    addLog('PROPAGATION_QUEUE', `${replica.id}: programado para sincronizar en ${delay}ms`);

    const timeout = setTimeout(() => {
      if (replica.online) {
        const oldState = snapshotAccounts(replica.accounts);
        replica.accounts = { ...primary.accounts };
        replica.lastSync = Date.now();
        addLog('SYNC_START', `${replica.id}: recibiendo datos del primario...`);
        addLog('SYNC_APPLY', `${replica.id}: ${oldState} → ${snapshotAccounts(replica.accounts)}`);
        addLog('SYNC_DONE', `${replica.id}: sincronización completa`);
      } else {
        addLog('SYNC_FAILED', `${replica.id}: OFFLINE — no recibió la propagación`);
        addLog('INCONSISTENCY', `${replica.id} mantiene datos obsoletos: ${snapshotAccounts(replica.accounts)}`);
      }
    }, delay);
    pendingTimeouts.push(timeout);
  });

  return {
    success: true,
    primaryState: { ...primary.accounts },
    propagationPending: true,
  };
}

function simulateCrash(from = 'Ana', to = 'Luis', amount = 200) {
  const primary = getPrimary();
  const secondaries = getSecondaries();

  addLog('REQUEST', `Solicitud de transferencia: ${from} → ${to} por Q${amount}`);
  addLog('ROUTING', `Escritura dirigida al nodo primario (${primary.id})`);

  // Validación
  addLog('VALIDATION', `Verificando saldo: ${from} tiene Q${primary.accounts[from]}, necesita Q${amount}`);

  if (primary.accounts[from] < amount) {
    addLog('VALIDATION_FAIL', `Fondos insuficientes`);
    return { success: false, error: 'Fondos insuficientes' };
  }

  addLog('VALIDATION', `Saldo suficiente — aprobado`);

  // Escritura en primario
  const oldFrom = primary.accounts[from];
  const oldTo = primary.accounts[to];
  primary.accounts[from] -= amount;
  primary.accounts[to] += amount;
  primary.lastSync = Date.now();

  addLog('WRITE_PRIMARY', `${primary.id}: ${from} Q${oldFrom} → Q${primary.accounts[from]} (−Q${amount})`);
  addLog('WRITE_PRIMARY', `${primary.id}: ${to} Q${oldTo} → Q${primary.accounts[to]} (+Q${amount})`);
  addLog('ACK_PRIMARY', `Escritura confirmada en primario. Estado: ${snapshotAccounts(primary.accounts)}`);

  // CRASH
  addLog('CRASH', `FALLO DEL SISTEMA — proceso de propagación interrumpido`);
  addLog('CRASH_DETAIL', `La propagación a secundarios nunca se inició`);

  // Mostrar estado de cada secundario
  secondaries.forEach((replica) => {
    addLog('STALE_NODE', `${replica.id}: mantiene datos ANTERIORES → ${snapshotAccounts(replica.accounts)}`);
  });

  addLog('INCONSISTENCY', `Primario: ${snapshotAccounts(primary.accounts)} ≠ Secundarios: ${snapshotAccounts(secondaries[0].accounts)}`);

  // Verificar totales por réplica
  const primaryTotal = Object.values(primary.accounts).reduce((a, b) => a + b, 0);
  secondaries.forEach((replica) => {
    const secTotal = Object.values(replica.accounts).reduce((a, b) => a + b, 0);
    if (secTotal !== primaryTotal) {
      addLog('TOTAL_MISMATCH', `${replica.id} total=Q${secTotal} vs primario total=Q${primaryTotal}`);
    }
  });

  // Convergencia eventual programada
  addLog('RECOVERY', `Anti-entropy daemon detectará la inconsistencia...`);

  secondaries.forEach((replica, index) => {
    const recoveryDelay = 6000 + (index * 2000);
    const timeout = setTimeout(() => {
      if (replica.online) {
        const oldState = snapshotAccounts(replica.accounts);
        replica.accounts = { ...primary.accounts };
        replica.lastSync = Date.now();
        addLog('ANTI_ENTROPY', `${replica.id}: daemon detectó divergencia`);
        addLog('SYNC_APPLY', `${replica.id}: ${oldState} → ${snapshotAccounts(replica.accounts)}`);
        addLog('EVENTUAL_SYNC', `${replica.id}: convergió con primario (después de ${recoveryDelay / 1000}s)`);
      }
    }, recoveryDelay);
    pendingTimeouts.push(timeout);
  });

  addLog('RECOVERY', `Convergencia eventual programada: secundarios sincronizarán en 6-10s`);

  return {
    success: true,
    crashed: true,
    primaryState: { ...primary.accounts },
    secondariesStale: secondaries.map(r => ({ id: r.id, accounts: { ...r.accounts } })),
  };
}

function readBalance(account, replicaId = null) {
  let replica;

  if (replicaId) {
    replica = replicas.find(r => r.id === replicaId);
    if (!replica) {
      return { success: false, error: `Réplica "${replicaId}" no encontrada` };
    }
    addLog('READ_ROUTING', `Lectura dirigida específicamente a ${replicaId}`);
  } else {
    const onlineReplicas = replicas.filter(r => r.online);
    if (onlineReplicas.length === 0) {
      addLog('READ_FAIL', 'No hay réplicas online disponibles');
      return { success: false, error: 'No hay réplicas disponibles' };
    }
    replica = onlineReplicas[roundRobinIndex % onlineReplicas.length];
    roundRobinIndex++;
    addLog('READ_ROUTING', `Round-robin seleccionó ${replica.id} (de ${onlineReplicas.length} réplicas online)`);
  }

  const balance = replica.accounts[account];
  const isStale = replica.lastSync < getPrimary().lastSync;

  addLog('READ', `${replica.id}: ${account} = Q${balance}${isStale ? ' (DATO DESACTUALIZADO)' : ' (actual)'}`);

  if (isStale) {
    const freshBalance = getPrimary().accounts[account];
    addLog('STALE_WARNING', `Dato real en primario: ${account} = Q${freshBalance} — diferencia de Q${Math.abs(freshBalance - balance)}`);
  }

  return {
    success: true,
    replicaId: replica.id,
    account,
    balance,
    isStale,
  };
}

function simulatePartition(nodeId) {
  const replica = replicas.find(r => r.id === nodeId);
  if (!replica) {
    return { success: false, error: `Nodo "${nodeId}" no encontrado` };
  }

  addLog('NETWORK', `Simulando partición de red en ${nodeId}...`);
  replica.online = false;
  addLog('PARTITION', `${nodeId} marcado como OFFLINE — no recibirá escrituras ni lecturas`);
  addLog('TOPOLOGY', `Nodos online: ${replicas.filter(r => r.online).map(r => r.id).join(', ')}`);

  return { success: true, nodeId, online: false };
}

function healPartition(nodeId) {
  const replica = replicas.find(r => r.id === nodeId);
  if (!replica) {
    return { success: false, error: `Nodo "${nodeId}" no encontrado` };
  }

  addLog('NETWORK', `Restaurando conexión de ${nodeId}...`);
  replica.online = true;

  const primary = getPrimary();
  const oldState = snapshotAccounts(replica.accounts);
  replica.accounts = { ...primary.accounts };
  replica.lastSync = Date.now();

  addLog('HEAL', `${nodeId} reconectado — iniciando catch-up sync`);
  addLog('SYNC_APPLY', `${nodeId}: ${oldState} → ${snapshotAccounts(replica.accounts)}`);
  addLog('SYNC_DONE', `${nodeId}: sincronizado con primario — convergencia completa`);
  addLog('TOPOLOGY', `Todos los nodos online: ${replicas.filter(r => r.online).map(r => r.id).join(', ')}`);

  return { success: true, nodeId, online: true, accounts: { ...replica.accounts } };
}

function getState() {
  const allEqual = replicas.every(r =>
    JSON.stringify(r.accounts) === JSON.stringify(replicas[0].accounts)
  );

  return {
    replicas: replicas.map(r => ({
      id: r.id,
      accounts: { ...r.accounts },
      isPrimary: r.isPrimary,
      online: r.online,
      total: Object.values(r.accounts).reduce((a, b) => a + b, 0),
      lastSync: r.lastSync,
    })),
    consistent: allEqual,
    syncLog: syncLog.slice(-100),
  };
}

module.exports = {
  reset,
  transfer,
  simulateCrash,
  readBalance,
  simulatePartition,
  healPartition,
  getState,
};
