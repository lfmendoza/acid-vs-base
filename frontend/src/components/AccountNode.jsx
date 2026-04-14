import { motion } from 'framer-motion';

const statusColors = {
  consistent: 'border-emerald-400 shadow-emerald-400/20',
  propagating: 'border-amber-400 shadow-amber-400/20',
  inconsistent: 'border-red-400 shadow-red-400/20',
  offline: 'border-slate-600 shadow-none opacity-50',
  default: 'border-slate-600 shadow-none',
};

export default function AccountNode({ name, balance, status = 'default', size = 'normal' }) {
  const colorClass = statusColors[status] || statusColors.default;
  const sizeClass = size === 'small' ? 'w-20 h-20 text-xs' : 'w-28 h-28 text-sm';

  return (
    <motion.div
      layout
      className={`
        ${sizeClass} rounded-full border-3 flex flex-col items-center justify-center
        bg-slate-800/60 backdrop-blur shadow-lg ${colorClass} transition-colors duration-300
      `}
    >
      <span className="font-semibold text-slate-300">{name}</span>
      <motion.span
        key={balance}
        initial={{ scale: 1.3, color: '#facc15' }}
        animate={{ scale: 1, color: '#ffffff' }}
        transition={{ duration: 0.4 }}
        className="text-lg font-bold"
      >
        Q{balance ?? '—'}
      </motion.span>
    </motion.div>
  );
}
