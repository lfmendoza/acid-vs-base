import { motion, AnimatePresence } from 'framer-motion';
import AccountNode from './AccountNode';

const statusLabels = {
  idle: { label: 'Esperando', color: 'bg-slate-700', icon: '⏸' },
  in_progress: { label: 'Escribiendo primario...', color: 'bg-amber-500', icon: '⚡' },
  propagating: { label: 'Propagando a réplicas...', color: 'bg-amber-400', icon: '📡' },
  inconsistent: { label: 'INCONSISTENTE', color: 'bg-red-500', icon: '⚠' },
  error: { label: 'Error', color: 'bg-red-600', icon: '✗' },
};

function getReplicaNodeStatus(replica, allReplicas, globalStatus) {
  if (!replica.online) return 'offline';

  const primary = allReplicas.find(r => r.isPrimary);
  if (!primary) return 'default';

  const matchesPrimary = JSON.stringify(replica.accounts) === JSON.stringify(primary.accounts);

  if (globalStatus === 'inconsistent' && !matchesPrimary) return 'inconsistent';
  if (globalStatus === 'propagating' && !replica.isPrimary && !matchesPrimary) return 'propagating';
  if (matchesPrimary) return 'consistent';
  return 'propagating';
}

export default function BASEPanel({ data, status = 'idle', partitionedNode, active }) {
  const replicas = data?.replicas || [];
  const consistent = data?.consistent ?? true;
  const config = statusLabels[status] || statusLabels.idle;

  const primary = replicas.find(r => r.isPrimary);
  const primaryTotal = primary ? Object.values(primary.accounts).reduce((a, b) => a + b, 0) : null;

  return (
    <div className="h-full flex flex-col items-center gap-4">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          <h2 className="text-2xl font-bold text-amber-400">BASE — Simulado</h2>
        </div>
        <p className="text-xs text-slate-500">3 réplicas con propagación asíncrona</p>
      </div>

      {/* Status Badge */}
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={`px-5 py-2 rounded-full text-sm font-bold ${config.color} text-white flex items-center gap-2`}
        >
          <span>{config.icon}</span>
          <span>{config.label}</span>
        </motion.div>
      </AnimatePresence>

      {/* Replica Columns */}
      <div className="flex-1 flex gap-3 w-full">
        {replicas.map((replica, idx) => {
          const replicaStatus = getReplicaNodeStatus(replica, replicas, status);
          const isPartitioned = partitionedNode === replica.id || !replica.online;
          const replicaTotal = replica.accounts
            ? Object.values(replica.accounts).reduce((a, b) => a + b, 0)
            : null;
          const totalMismatch = primaryTotal !== null && replicaTotal !== null && replicaTotal !== primaryTotal;

          return (
            <motion.div
              key={replica.id}
              layout
              className={`
                flex-1 rounded-xl border-2 p-3 flex flex-col items-center gap-2 transition-all duration-500 relative
                ${isPartitioned
                  ? 'border-red-500/30 bg-red-950/20'
                  : replicaStatus === 'inconsistent'
                  ? 'border-red-500/40 bg-red-950/10'
                  : replicaStatus === 'propagating'
                  ? 'border-amber-500/40 bg-amber-950/10'
                  : replicaStatus === 'consistent'
                  ? 'border-emerald-500/30 bg-emerald-950/10'
                  : 'border-slate-700 bg-slate-800/30'}
              `}
            >
              {/* Partition overlay */}
              {isPartitioned && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 rounded-xl bg-slate-950/60 z-10 flex flex-col items-center justify-center gap-2"
                >
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-red-400 text-2xl"
                  >
                    ✂️
                  </motion.div>
                  <span className="text-red-400 text-xs font-bold uppercase tracking-wider">
                    Desconectado
                  </span>
                </motion.div>
              )}

              {/* Propagation arrow */}
              {!replica.isPrimary && (status === 'propagating' || status === 'in_progress') && !isPartitioned && (
                <motion.div
                  className="absolute -left-3 top-1/2 -translate-y-1/2 text-amber-400"
                  animate={{ x: [0, 4, 0], opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: idx * 0.8 }}
                >
                  →
                </motion.div>
              )}

              {/* Replica Label */}
              <div className="text-center">
                <div className={`text-xs font-bold ${replica.isPrimary ? 'text-amber-300' : 'text-slate-400'}`}>
                  {replica.id.replace('node-', 'Nodo ')}
                </div>
                <div className={`text-[10px] font-semibold ${replica.isPrimary ? 'text-amber-500' : 'text-slate-600'}`}>
                  {replica.isPrimary ? 'PRIMARY' : 'SECONDARY'}
                </div>
              </div>

              {/* Account nodes */}
              <div className="flex flex-col items-center gap-1.5">
                <AccountNode
                  name="Ana"
                  balance={replica.accounts?.Ana}
                  status={replicaStatus}
                  size="small"
                />
                <AccountNode
                  name="Luis"
                  balance={replica.accounts?.Luis}
                  status={replicaStatus}
                  size="small"
                />
              </div>

              {/* Per-replica total */}
              <div className={`
                text-xs px-3 py-1 rounded-full font-bold transition-colors duration-500
                ${replicaTotal === 8000
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/15 text-red-400'}
              `}>
                Σ Q{replicaTotal ?? '—'}
              </div>

              {/* Stale indicator */}
              {totalMismatch && !isPartitioned && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[10px] text-red-400 font-bold"
                >
                  ≠ Primario
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Convergence Indicator */}
      <motion.div
        layout
        className={`
          w-full px-4 py-3 rounded-xl border-2 text-center transition-colors duration-500
          ${consistent
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400'}
        `}
      >
        <div className="flex items-center justify-center gap-2 text-sm font-bold">
          {consistent ? (
            <>
              <span>✓</span>
              <span>Todas las réplicas sincronizadas</span>
            </>
          ) : (
            <>
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                ⚠
              </motion.span>
              <span>Réplicas con datos diferentes</span>
            </>
          )}
        </div>
      </motion.div>

      {/* BASE Properties */}
      <div className="flex gap-2 text-[10px]">
        {['Basically Available', 'Soft State', 'Eventually Consistent'].map((prop) => (
          <span key={prop} className={`px-2 py-0.5 rounded-full ${
            !consistent ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
          } transition-colors duration-500`}>
            {prop}
          </span>
        ))}
      </div>
    </div>
  );
}
