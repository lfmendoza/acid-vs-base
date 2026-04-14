import { motion, AnimatePresence } from 'framer-motion';

const typeStyles = {
  info: 'bg-slate-800/80 border-slate-600 text-slate-200',
  acid: 'bg-teal-950/80 border-teal-500 text-teal-100',
  base: 'bg-amber-950/80 border-amber-500 text-amber-100',
  success: 'bg-emerald-950/80 border-emerald-500 text-emerald-100',
  warning: 'bg-yellow-950/80 border-yellow-500 text-yellow-100',
  error: 'bg-red-950/80 border-red-500 text-red-100',
};

const typeIcons = {
  info: '💡',
  acid: '🔒',
  base: '☁️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

export default function StepNarrator({ text, type = 'info', currentStep, totalSteps }) {
  if (!text) return null;

  const style = typeStyles[type] || typeStyles.info;
  const icon = typeIcons[type] || '💡';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className={`mx-4 mt-3 mb-1 px-5 py-3 rounded-xl border-l-4 ${style} backdrop-blur`}
      >
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
          <div className="flex-1 min-w-0">
            <motion.p
              key={text}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-sm font-medium leading-relaxed"
            >
              {text}
            </motion.p>
          </div>
          {totalSteps > 0 && (
            <div className="flex-shrink-0 flex items-center gap-1.5 ml-4">
              {Array.from({ length: totalSteps }, (_, i) => (
                <motion.div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    i < currentStep ? 'bg-white' : 'bg-white/20'
                  }`}
                  animate={i === currentStep - 1 ? { scale: [1, 1.4, 1] } : {}}
                  transition={{ duration: 0.5 }}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
