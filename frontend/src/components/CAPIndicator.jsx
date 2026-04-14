import { motion } from 'framer-motion';

export default function CAPIndicator({ activeScenario }) {
  const isPartition = activeScenario === 'partition';

  return (
    <div className="border-t border-slate-800 pt-4">
      <div className="text-[10px] text-slate-500 text-center mb-2 uppercase tracking-wider">
        Teorema CAP
      </div>
      <div className="flex gap-3 justify-center">
        {/* ACID = CP */}
        <div className="text-center">
          <div className="text-[10px] text-teal-400 font-semibold mb-1">ACID</div>
          <svg width="60" height="55" viewBox="0 0 60 55">
            <polygon points="30,5 5,50 55,50" fill="none" stroke="#334155" strokeWidth="1.5" />
            {/* C vertex */}
            <motion.circle
              cx="30" cy="5" r="6"
              fill="#2dd4bf"
              animate={{ opacity: isPartition ? [1, 0.4, 1] : 1 }}
              transition={{ repeat: isPartition ? Infinity : 0, duration: 1 }}
            />
            <text x="30" y="8" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">C</text>
            {/* A vertex */}
            <circle cx="5" cy="50" r="6" fill="#334155" />
            <text x="5" y="53" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">A</text>
            {/* P vertex */}
            <motion.circle
              cx="55" cy="50" r="6"
              fill="#2dd4bf"
              animate={{ opacity: isPartition ? [1, 0.4, 1] : 1 }}
              transition={{ repeat: isPartition ? Infinity : 0, duration: 1 }}
            />
            <text x="55" y="53" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">P</text>
          </svg>
          <div className="text-[9px] text-slate-500">CP</div>
        </div>

        {/* BASE = AP */}
        <div className="text-center">
          <div className="text-[10px] text-amber-400 font-semibold mb-1">BASE</div>
          <svg width="60" height="55" viewBox="0 0 60 55">
            <polygon points="30,5 5,50 55,50" fill="none" stroke="#334155" strokeWidth="1.5" />
            {/* C vertex */}
            <circle cx="30" cy="5" r="6" fill="#334155" />
            <text x="30" y="8" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">C</text>
            {/* A vertex */}
            <motion.circle
              cx="5" cy="50" r="6"
              fill="#f59e0b"
              animate={{ opacity: isPartition ? [1, 0.4, 1] : 1 }}
              transition={{ repeat: isPartition ? Infinity : 0, duration: 1 }}
            />
            <text x="5" y="53" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">A</text>
            {/* P vertex */}
            <motion.circle
              cx="55" cy="50" r="6"
              fill="#f59e0b"
              animate={{ opacity: isPartition ? [1, 0.4, 1] : 1 }}
              transition={{ repeat: isPartition ? Infinity : 0, duration: 1 }}
            />
            <text x="55" y="53" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">P</text>
          </svg>
          <div className="text-[9px] text-slate-500">AP</div>
        </div>
      </div>
    </div>
  );
}
