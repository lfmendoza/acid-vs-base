// Simulador BASE: 3 réplicas en memoria con propagación asíncrona

const INITIAL_ACCOUNTS = { Ana: 1000, Luis: 500 };
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
  addLog('RESET', 'Todas las réplicas restauradas al estado inicial');
  return getState();
}

// Inicializar al cargar el módulo
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

function transfer(from, to, amount, propagationDelay = DEFAULT_PROPAGATION_DELAY) {
  const primary = getPrimary();

  if (primary.accounts[from] === undefined) {
    addLog('ERROR', `Cuenta "${from}" no existe`);
    return { success: false, error: `Cuenta "${from}" no existe` };
  }
  if (primary.accounts[to] === undefined) {
    addLog('ERROR', `Cuenta "${to}" no existe`);
    return { success: false, error: `Cuenta "${to}" no existe` };
  }
  if (primary.accounts[from] < amount) {
    addLog('ERROR', `Fondos insuficientes: ${from} tiene ${primary.accounts[from]}, necesita ${amount}`);
    return { success: false, error: 'Fondos insuficientes' };
  }

  // Escritura inmediata en el nodo primario
  primary.accounts[from] -= amount;
  primary.accounts[to] += amount;
  primary.lastSync = Date.now();
  addLog('WRITE_PRIMARY', `Primario actualizado: ${from}=${primary.accounts[from]}, ${to}=${primary.accounts[to]}`);

  // Propagación asíncrona a secundarios
  const secondaries = getSecondaries();
  secondaries.forEach((replica, index) => {
    const delay = propagationDelay * (index + 1);
    const timeout = setTimeout(() => {
      if (replica.online) {
        replica.accounts = { ...primary.accounts };
        replica.lastSync = Date.now();
        addLog('SYNC', `${replica.id} sincronizado con primario (delay: ${delay}ms)`);
      } else {
        addLog('SYNC_FAILED', `${replica.id} está desconectado, no recibió la propagación`);
      }
    }, delay);
    pendingTimeouts.push(timeout);
  });

  addLog('PROPAGATION_STARTED', `Propagación iniciada a ${secondaries.length} secundarios (delay: ${propagationDelay}ms cada uno)`);

  return {
    success: true,
    primaryState: { ...primary.accounts },
    propagationPending: true,
  };
}

function simulateCrash(from = 'Ana', to = 'Luis', amount = 200) {
  const primary = getPrimary();

  if (primary.accounts[from] < amount) {
    return { success: false, error: 'Fondos insuficientes' };
  }

  // Actualizar solo el primario
  primary.accounts[from] -= amount;
  primary.accounts[to] += amount;
  primary.lastSync = Date.now();
  addLog('WRITE_PRIMARY', `Primario actualizado: ${from}=${primary.accounts[from]}, ${to}=${primary.accounts[to]}`);

  // "Crash" — NO propagamos a secundarios
  addLog('CRASH', 'Simulación de crash: la propagación a secundarios fue interrumpida');
  addLog('INCONSISTENCY', `Primario tiene datos nuevos, secundarios mantienen datos antiguos`);

  return {
    success: true,
    crashed: true,
    primaryState: { ...primary.accounts },
    secondariesStale: getSecondaries().map(r => ({ id: r.id, accounts: { ...r.accounts } })),
  };
}

function readBalance(account, replicaId = null) {
  let replica;

  if (replicaId) {
    replica = replicas.find(r => r.id === replicaId);
    if (!replica) {
      return { success: false, error: `Réplica "${replicaId}" no encontrada` };
    }
  } else {
    // Round-robin entre réplicas online
    const onlineReplicas = replicas.filter(r => r.online);
    if (onlineReplicas.length === 0) {
      return { success: false, error: 'No hay réplicas disponibles' };
    }
    replica = onlineReplicas[roundRobinIndex % onlineReplicas.length];
    roundRobinIndex++;
  }

  const balance = replica.accounts[account];
  addLog('READ', `Lectura de ${account} desde ${replica.id}: ${balance}`);

  return {
    success: true,
    replicaId: replica.id,
    account,
    balance,
    isStale: replica.lastSync < getPrimary().lastSync,
  };
}

function simulatePartition(nodeId) {
  const replica = replicas.find(r => r.id === nodeId);
  if (!replica) {
    return { success: false, error: `Nodo "${nodeId}" no encontrado` };
  }
  replica.online = false;
  addLog('PARTITION', `${nodeId} desconectado — partición de red simulada`);
  return { success: true, nodeId, online: false };
}

function healPartition(nodeId) {
  const replica = replicas.find(r => r.id === nodeId);
  if (!replica) {
    return { success: false, error: `Nodo "${nodeId}" no encontrado` };
  }
  replica.online = true;

  // Catch-up sync: copiar el estado del primario
  const primary = getPrimary();
  replica.accounts = { ...primary.accounts };
  replica.lastSync = Date.now();
  addLog('HEAL', `${nodeId} reconectado y sincronizado con primario`);
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
    syncLog: syncLog.slice(-50),
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
