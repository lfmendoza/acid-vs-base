import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const actionColors = {
  // Flujo transaccional (simétrico ACID ↔ BASE)
  BEGIN: 'text-teal-400',
  REQUEST: 'text-slate-300',
  ROUTING: 'text-slate-400',
  READ: 'text-blue-400',
  VALIDATE: 'text-blue-300',
  DEBIT: 'text-amber-400',
  CREDIT: 'text-emerald-400',
  WRITE: 'text-purple-400',
  ACK: 'text-amber-300',
  COMMIT: 'text-emerald-300',
  VERIFY: 'text-cyan-400',
  CONSISTENT: 'text-emerald-300',

  // ACID específico
  TX_BEGIN: 'text-teal-400',
  TX_DEBIT: 'text-amber-400',
  TX_CREDIT: 'text-emerald-400',
  TX_COMMIT: 'text-emerald-300',
  READ_START: 'text-blue-400',
  READ_RESULT: 'text-blue-300',
  ISOLATION: 'text-teal-300',
  ROLLBACK: 'text-red-400',

  // Errores / crash
  CRASH: 'text-red-500',
  ERROR: 'text-red-400',
  VALIDATE_FAIL: 'text-red-400',

  // BASE propagación
  PROPAGATION: 'text-amber-300',
  STALE: 'text-orange-400',
  SYNC: 'text-emerald-400',
  SYNC_FAILED: 'text-red-400',
  STALE_READ: 'text-orange-400',
  READ_ROUTING: 'text-slate-400',
  INCONSISTENT: 'text-red-400',
  CONVERGED: 'text-emerald-300',

  // Partición
  NETWORK: 'text-yellow-400',
  TOPOLOGY: 'text-slate-400',
  AVAILABILITY: 'text-amber-300',
  PARTITION: 'text-red-400',
  HEAL: 'text-emerald-400',

  // Recovery
  RECOVERY: 'text-cyan-300',
  ANTI_ENTROPY: 'text-cyan-400',

  // Otros
  RESET: 'text-slate-500',
  INFO: 'text-slate-400',
};

const actionIcons = {
  BEGIN: '▶', REQUEST: '→', ROUTING: '⤷', READ: '📖',
  VALIDATE: '✓', DEBIT: '−', CREDIT: '+', WRITE: '✎',
  ACK: '✓', COMMIT: '✓✓', VERIFY: '🔍', CONSISTENT: '✅',
  TX_BEGIN: '▶', TX_DEBIT: '−', TX_CREDIT: '+', TX_COMMIT: '✓✓',
  READ_START: '📖', READ_RESULT: '📖', ISOLATION: '🔒',
  ROLLBACK: '↩', CRASH: '💥', ERROR: '✗', VALIDATE_FAIL: '✗',
  PROPAGATION: '📡', STALE: '⚠', SYNC: '⇄', SYNC_FAILED: '✗',
  STALE_READ: '👁', READ_ROUTING: '⤷', INCONSISTENT: '≠', CONVERGED: '✅',
  NETWORK: '🌐', TOPOLOGY: '◎', AVAILABILITY: '✓', PARTITION: '✂', HEAL: '🔗',
  RECOVERY: '🔄', ANTI_ENTROPY: '🔄', RESET: '↻', INFO: 'ℹ',
};

function LogColumn({ title, entries, accent }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className={`text-sm font-bold ${accent} px-4 py-2 border-b border-slate-800 uppercase tracking-wider flex items-center justify-between`}>
        <span>{title}</span>
        {entries.length > 0 && (
          <span className="text-slate-600 font-normal normal-case text-xs">{entries.length}</span>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5">
        <AnimatePresence>
          {entries.map((entry, i) => {
            const color = actionColors[entry.action] || 'text-slate-400';
            const icon = actionIcons[entry.action] || '•';
            return (
              <motion.div
                key={`${entry.time}-${i}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.1 }}
                className="flex gap-2 text-[13px] leading-relaxed py-0.5"
              >
                <span className="text-slate-600 flex-shrink-0 tabular-nums w-[70px]">
                  {entry.time ? new Date(entry.time).toLocaleTimeString() : ''}
                </span>
                <span className={`flex-shrink-0 w-5 text-center ${color}`}>{icon}</span>
                <span className={`font-mono font-bold flex-shrink-0 ${color}`} style={{ minWidth: '110px' }}>
                  {entry.action}
                </span>
                <span className="text-slate-300 break-words">{entry.detail}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {entries.length === 0 && (
          <div className="text-slate-600 text-sm italic py-3">
            Ejecuta un escenario para ver el log...
          </div>
        )}
      </div>
    </div>
  );
}

export default function TransactionLog({ acidLog, baseLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border-t border-slate-800 bg-slate-900/95 backdrop-blur flex-shrink-0 flex flex-col transition-all duration-300 ${expanded ? 'h-[80vh]' : 'h-44'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 py-1.5 hover:bg-slate-800/60 transition-colors cursor-pointer group"
      >
        <div className="w-10 h-1 rounded-full bg-slate-700 group-hover:bg-slate-500 transition-colors" />
        <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors uppercase tracking-wider font-medium">
          {expanded ? '▼ Minimizar logs' : '▲ Expandir logs'}
        </span>
        <div className="w-10 h-1 rounded-full bg-slate-700 group-hover:bg-slate-500 transition-colors" />
      </button>

      <div className="flex divide-x divide-slate-800 flex-1 min-h-0">
        <LogColumn title="Log ACID — Neo4j" entries={acidLog} accent="text-teal-400" />
        <LogColumn title="Log BASE — Simulado" entries={baseLog} accent="text-amber-400" />
      </div>
    </div>
  );
}
