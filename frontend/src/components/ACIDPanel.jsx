import { motion, AnimatePresence } from 'framer-motion';
import AccountNode from './AccountNode';

const statusConfig = {
  idle: { label: 'Inactivo', color: 'bg-slate-600', textColor: 'text-slate-400' },
  in_progress: { label: 'En progreso...', color: 'bg-teal-500', textColor: 'text-teal-300' },
  committed: { label: 'COMMITTED', color: 'bg-emerald-500', textColor: 'text-emerald-300' },
  rolled_back: { label: 'ROLLBACK', color: 'bg-red-500', textColor: 'text-red-300' },
  error: { label: 'Error', color: 'bg-red-600', textColor: 'text-red-400' },
};

export default function ACIDPanel({ data, status = 'idle' }) {
  const balances = data?.balances || [];
  const total = data?.total ?? '—';
  const ana = balances.find(b => b.titular === 'Ana');
  const luis = balances.find(b => b.titular === 'Luis');
  const config = statusConfig[status] || statusConfig.idle;

  const nodeStatus = status === 'rolled_back' ? 'inconsistent'
    : status === 'committed' ? 'consistent'
    : 'default';

  return (
    <div className="h-full flex flex-col items-center gap-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-bold text-teal-400">ACID — Neo4j</h2>
        </div>
        <p className="text-xs text-slate-500">Transacciones reales con garantías ACID</p>
      </div>

      {/* Status Badge */}
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold ${config.color} text-white`}
        >
          {config.label}
        </motion.div>
      </AnimatePresence>

      {/* Account Nodes */}
      <div className="flex-1 flex items-center justify-center gap-12 relative">
        {status === 'rolled_back' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 1, repeat: 2 }}
            className="absolute inset-0 bg-red-500/10 rounded-2xl"
          />
        )}

        {status === 'in_progress' && (
          <motion.svg
            className="absolute"
            width="200" height="4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <motion.line
              x1="0" y1="2" x2="200" y2="2"
              stroke="#2dd4bf"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.svg>
        )}

        <AccountNode name="Ana" balance={ana?.saldo} status={nodeStatus} />
        <AccountNode name="Luis" balance={luis?.saldo} status={nodeStatus} />
      </div>

      {/* Total Indicator */}
      <div className={`
        px-6 py-2 rounded-xl border text-center
        ${total === 1500
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : 'border-red-500/30 bg-red-500/10 text-red-400'}
      `}>
        <div className="text-xs text-slate-500 mb-0.5">Total del sistema</div>
        <div className="text-2xl font-bold">Q{total}</div>
        <div className="text-xs mt-0.5">
          {total === 1500 ? 'Consistente' : 'Verificar'}
        </div>
      </div>
    </div>
  );
}
