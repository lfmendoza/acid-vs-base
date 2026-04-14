import { motion } from 'framer-motion';
import AccountNode from './AccountNode';

const statusLabels = {
  idle: { label: 'Inactivo', color: 'bg-slate-600' },
  in_progress: { label: 'Escribiendo...', color: 'bg-amber-500' },
  propagating: { label: 'Propagando...', color: 'bg-amber-400' },
  inconsistent: { label: 'INCONSISTENTE', color: 'bg-red-500' },
  error: { label: 'Error', color: 'bg-red-600' },
};

function getReplicaStatus(replica, allReplicas, globalStatus) {
  if (!replica.online) return 'offline';
  if (globalStatus === 'inconsistent') {
    const primary = allReplicas.find(r => r.isPrimary);
    if (primary && JSON.stringify(replica.accounts) !== JSON.stringify(primary.accounts)) {
      return 'inconsistent';
    }
  }
  if (globalStatus === 'propagating' && !replica.isPrimary) return 'propagating';
  const allEqual = allReplicas.every(r =>
    JSON.stringify(r.accounts) === JSON.stringify(allReplicas[0].accounts)
  );
  return allEqual ? 'consistent' : 'propagating';
}

export default function BASEPanel({ data, status = 'idle', partitionedNode }) {
  const replicas = data?.replicas || [];
  const consistent = data?.consistent ?? true;
  const config = statusLabels[status] || statusLabels.idle;

  return (
    <div className="h-full flex flex-col items-center gap-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          <h2 className="text-xl font-bold text-amber-400">BASE — Simulado</h2>
        </div>
        <p className="text-xs text-slate-500">Réplicas en memoria con propagación asíncrona</p>
      </div>

      {/* Status Badge */}
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`px-4 py-1.5 rounded-full text-xs font-semibold ${config.color} text-white`}
      >
        {config.label}
      </motion.div>

      {/* Replica Columns */}
      <div className="flex-1 flex gap-4 w-full">
        {replicas.map((replica) => {
          const replicaStatus = getReplicaStatus(replica, replicas, status);
          const isPartitioned = partitionedNode === replica.id || !replica.online;

          return (
            <motion.div
              key={replica.id}
              layout
              className={`
                flex-1 rounded-xl border p-3 flex flex-col items-center gap-3 transition-all duration-300
                ${isPartitioned
                  ? 'border-slate-700 bg-slate-900/50 opacity-50'
                  : 'border-slate-700 bg-slate-800/30'}
              `}
            >
              <div className="text-center">
                <div className="text-xs font-semibold text-slate-300">
                  {replica.id.replace('node-', 'Nodo ')}
                </div>
                <div className="text-[10px] text-slate-500">
                  {replica.isPrimary ? '(Primary)' : '(Secondary)'}
                </div>
                {isPartitioned && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] text-red-400 font-semibold mt-1"
                  >
                    Desconectado
                  </motion.div>
                )}
              </div>

              <div className="flex flex-col items-center gap-2">
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

              <div className={`
                text-xs px-3 py-1 rounded-full
                ${replica.total === 1500
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'}
              `}>
                Total: Q{replica.total ?? '—'}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Convergence Indicator */}
      <div className={`
        w-full px-4 py-2 rounded-xl border text-center text-xs
        ${consistent
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-400'}
      `}>
        <div className="flex items-center justify-center gap-2">
          {!consistent && (
            <motion.div
              className="w-2 h-2 rounded-full bg-amber-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
          )}
          <span>{consistent ? 'Todas las réplicas sincronizadas' : 'Convergencia en progreso...'}</span>
        </div>
      </div>
    </div>
  );
}
