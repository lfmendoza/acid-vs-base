const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    return await res.json();
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}

function post(path, body = {}) {
  return request(path, { method: 'POST', body: JSON.stringify(body) });
}

function get(path) {
  return request(path, { method: 'GET' });
}

// --------------- API Functions ---------------

export const api = {
  reset: () => post('/api/reset'),

  // ACID
  acidTransfer: (from, to, amount) => post('/api/acid/transfer', { from, to, amount }),
  acidTransferCrash: (from, to, amount) => post('/api/acid/transfer-with-crash', { from, to, amount }),
  acidBalances: () => get('/api/acid/balances'),
  acidConcurrentRead: (from, to, amount) => post('/api/acid/concurrent-read', { from, to, amount }),

  // BASE
  baseTransfer: (from, to, amount) => post('/api/base/transfer', { from, to, amount }),
  baseTransferCrash: (from, to, amount) => post('/api/base/transfer-with-crash', { from, to, amount }),
  baseBalances: () => get('/api/base/balances'),
  baseState: () => get('/api/base/state'),
  basePartition: (nodeId) => post('/api/base/partition', { nodeId }),
  baseHeal: (nodeId) => post('/api/base/heal', { nodeId }),
  baseReadFrom: (account, replicaId) => post('/api/base/read-from', { account, replicaId }),
};

// Polling: llama callbacks con el estado actual cada intervalMs durante durationMs
export function pollState(onUpdate, durationMs = 10000, intervalMs = 500) {
  let elapsed = 0;
  const interval = setInterval(async () => {
    elapsed += intervalMs;
    const [acid, base] = await Promise.all([api.acidBalances(), api.baseState()]);
    onUpdate({ acid: acid.data, base: base.data, elapsed, done: elapsed >= durationMs });
    if (elapsed >= durationMs) clearInterval(interval);
  }, intervalMs);

  return () => clearInterval(interval);
}
