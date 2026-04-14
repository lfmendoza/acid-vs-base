import { motion } from 'framer-motion';

const statusStyles = {
  consistent: {
    border: 'border-emerald-400',
    shadow: 'shadow-emerald-400/30',
    bg: 'bg-emerald-950/40',
    glow: true,
  },
  propagating: {
    border: 'border-amber-400',
    shadow: 'shadow-amber-400/30',
    bg: 'bg-amber-950/40',
    glow: true,
  },
  inconsistent: {
    border: 'border-red-400',
    shadow: 'shadow-red-400/30',
    bg: 'bg-red-950/40',
    glow: true,
  },
  offline: {
    border: 'border-slate-700',
    shadow: 'shadow-none',
    bg: 'bg-slate-900/60',
    glow: false,
  },
  default: {
    border: 'border-slate-600',
    shadow: 'shadow-none',
    bg: 'bg-slate-800/60',
    glow: false,
  },
};

export default function AccountNode({ name, balance, status = 'default', size = 'normal' }) {
  const style = statusStyles[status] || statusStyles.default;
  const isSmall = size === 'small';

  return (
    <motion.div
      layout
      className={`
        ${isSmall ? 'w-[72px] h-[72px]' : 'w-32 h-32'}
        rounded-full border-[3px] flex flex-col items-center justify-center
        ${style.bg} ${style.border} ${style.shadow}
        backdrop-blur-sm transition-colors duration-500
        ${style.glow ? 'shadow-lg' : ''}
      `}
      animate={status === 'propagating' ? { borderColor: ['#fbbf24', '#f59e0b', '#fbbf24'] } : {}}
      transition={status === 'propagating' ? { repeat: Infinity, duration: 1.5 } : {}}
    >
      <span className={`font-semibold text-slate-300 ${isSmall ? 'text-[10px]' : 'text-xs'}`}>
        {name}
      </span>
      <AnimatedBalance balance={balance} isSmall={isSmall} />
    </motion.div>
  );
}

function AnimatedBalance({ balance, isSmall }) {
  return (
    <motion.span
      key={balance}
      initial={{ scale: 1.4, color: '#facc15' }}
      animate={{ scale: 1, color: '#ffffff' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`font-black tabular-nums ${isSmall ? 'text-sm' : 'text-xl'}`}
    >
      Q{balance ?? '—'}
    </motion.span>
  );
}
