import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const actionColors = {
  BEGIN: 'text-teal-400',
  READ: 'text-blue-400',
  DEBIT: 'text-amber-400',
  CREDIT: 'text-emerald-400',
  COMMIT: 'text-emerald-300',
  TX_BEGIN: 'text-teal-400',
  TX_DEBIT: 'text-amber-400',
  TX_CREDIT: 'text-emerald-400',
  TX_COMMIT: 'text-emerald-300',
  READ_START: 'text-blue-400',
  READ_RESULT: 'text-blue-300',
  ISOLATION: 'text-teal-300',
  ROLLBACK: 'text-red-400',
  CRASH: 'text-red-500',
  ERROR: 'text-red-400',
  WRITE: 'text-amber-400',
  WRITE_PRIMARY: 'text-amber-400',
  SYNC: 'text-emerald-400',
  SYNC_FAILED: 'text-red-400',
  PROPAGATION_STARTED: 'text-amber-300',
  INCONSISTENCY: 'text-red-400',
  STALE_READ: 'text-orange-400',
  PARTITION: 'text-red-400',
  HEAL: 'text-emerald-400',
  INFO: 'text-slate-400',
};

function LogColumn({ title, entries, colorAccent }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className={`text-xs font-semibold ${colorAccent} px-3 py-1.5 border-b border-slate-800`}>
        {title}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1 max-h-40">
        <AnimatePresence>
          {entries.map((entry, i) => (
            <motion.div
              key={`${entry.time}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex gap-2 text-[11px] leading-relaxed"
            >
              <span className="text-slate-600 flex-shrink-0">
                {entry.time ? new Date(entry.time).toLocaleTimeString() : ''}
              </span>
              <span className={`font-mono font-semibold flex-shrink-0 ${actionColors[entry.action] || 'text-slate-400'}`}>
                [{entry.action}]
              </span>
              <span className="text-slate-300 truncate">{entry.detail}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {entries.length === 0 && (
          <div className="text-slate-600 text-xs italic">Sin actividad</div>
        )}
      </div>
    </div>
  );
}

export default function TransactionLog({ acidLog, baseLog }) {
  return (
    <div className="border-t border-slate-800 bg-slate-900/80 flex divide-x divide-slate-800 h-48">
      <LogColumn title="Log ACID — Neo4j" entries={acidLog} colorAccent="text-teal-400" />
      <LogColumn title="Log BASE — Simulado" entries={baseLog} colorAccent="text-amber-400" />
    </div>
  );
}
