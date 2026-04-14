import { motion, AnimatePresence } from 'framer-motion';
import AccountNode from './AccountNode';

const statusConfig = {
  idle: { label: 'Esperando', color: 'bg-slate-700', icon: '⏸' },
  in_progress: { label: 'Ejecutando transacción...', color: 'bg-teal-500', icon: '⚡' },
  committed: { label: 'COMMIT exitoso', color: 'bg-emerald-500', icon: '✓' },
  rolled_back: { label: 'ROLLBACK completo', color: 'bg-red-500', icon: '↩' },
  error: { label: 'Error', color: 'bg-red-600', icon: '✗' },
};

export default function ACIDPanel({ data, status = 'idle', active }) {
  const balances = data?.balances || [];
  const total = data?.total ?? '—';
  const ana = balances.find(b => b.titular === 'Ana');
  const luis = balances.find(b => b.titular === 'Luis');
  const config = statusConfig[status] || statusConfig.idle;

  const nodeStatus = status === 'rolled_back' ? 'inconsistent'
    : status === 'committed' ? 'consistent'
    : status === 'in_progress' ? 'propagating'
    : 'default';

  return (
    <div className="h-full flex flex-col items-center gap-4">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-2xl font-bold text-teal-400">ACID — Neo4j</h2>
        </div>
        <p className="text-xs text-slate-500">Una sola base de datos transaccional</p>
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

      {/* Account Nodes with transfer arc */}
      <div className="flex-1 flex items-center justify-center relative w-full max-w-sm mx-auto">
        {/* Rollback flash */}
        {status === 'rolled_back' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0, 0.3, 0] }}
            transition={{ duration: 2 }}
            className="absolute inset-0 bg-red-500/20 rounded-3xl z-10"
          />
        )}

        {/* Commit glow */}
        {status === 'committed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0.15] }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 bg-emerald-500/10 rounded-3xl"
          />
        )}

        {/* Transfer arc animation */}
        {status === 'in_progress' && (
          <svg className="absolute w-full h-full pointer-events-none" viewBox="0 0 300 200">
            <motion.path
              d="M 80 100 Q 150 30 220 100"
              fill="none"
              stroke="#2dd4bf"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="8 4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.circle
              r="6"
              fill="#facc15"
              initial={{ offsetDistance: '0%' }}
              animate={{ offsetDistance: '100%' }}
              style={{ offsetPath: "path('M 80 100 Q 150 30 220 100')" }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.text
              x="150" y="40"
              textAnchor="middle"
              fill="#facc15"
              fontSize="14"
              fontWeight="bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              Q200
            </motion.text>
          </svg>
        )}

        {/* Rollback arrows */}
        {status === 'rolled_back' && (
          <svg className="absolute w-full h-full pointer-events-none" viewBox="0 0 300 200">
            <motion.path
              d="M 220 100 Q 150 30 80 100"
              fill="none"
              stroke="#ef4444"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="8 4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2 }}
            />
            <motion.text
              x="150" y="40"
              textAnchor="middle"
              fill="#ef4444"
              fontSize="13"
              fontWeight="bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2 }}
            >
              ROLLBACK
            </motion.text>
          </svg>
        )}

        <div className="flex items-center justify-center gap-16 relative z-20">
          <AccountNode name="Ana" balance={ana?.saldo} status={nodeStatus} />
          <AccountNode name="Luis" balance={luis?.saldo} status={nodeStatus} />
        </div>
      </div>

      {/* Total Indicator */}
      <motion.div
        layout
        className={`
          px-6 py-3 rounded-xl border-2 text-center transition-colors duration-500
          ${total === 8000
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            : total === '—'
            ? 'border-slate-600 bg-slate-800/30 text-slate-500'
            : 'border-red-500/40 bg-red-500/10 text-red-400'}
        `}
      >
        <div className="text-xs text-slate-500 mb-0.5">Total del sistema</div>
        <div className="text-3xl font-black tabular-nums">Q{total}</div>
        <div className="text-xs mt-1 font-semibold">
          {total === 8000 ? '✓ Siempre consistente' : total === '—' ? 'Sin datos' : '⚠ Verificar'}
        </div>
      </motion.div>

      {/* ACID Properties */}
      <div className="flex gap-2 text-[10px]">
        {['Atómico', 'Consistente', 'Aislado', 'Durable'].map((prop, i) => (
          <span key={prop} className={`px-2 py-0.5 rounded-full ${
            status === 'committed' ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800 text-slate-500'
          } transition-colors duration-500`}>
            {prop}
          </span>
        ))}
      </div>
    </div>
  );
}
