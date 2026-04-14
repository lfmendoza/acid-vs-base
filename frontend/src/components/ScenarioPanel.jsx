import { motion } from 'framer-motion';
import CAPIndicator from './CAPIndicator';

const scenarios = [
  {
    id: 'normal',
    label: 'Transferencia Normal',
    icon: '💸',
    color: 'from-emerald-600 to-emerald-500',
    hoverColor: 'hover:from-emerald-500 hover:to-emerald-400',
    description: 'Ana → Luis: Q200',
    expect: 'ACID: instantáneo | BASE: gradual',
  },
  {
    id: 'crash',
    label: 'Crash a Mitad',
    icon: '💥',
    color: 'from-red-600 to-red-500',
    hoverColor: 'hover:from-red-500 hover:to-red-400',
    description: 'El sistema falla durante la transferencia',
    expect: 'ACID: rollback | BASE: inconsistencia',
  },
  {
    id: 'concurrent',
    label: 'Lecturas Concurrentes',
    icon: '👀',
    color: 'from-blue-600 to-blue-500',
    hoverColor: 'hover:from-blue-500 hover:to-blue-400',
    description: 'Leer saldos durante una escritura',
    expect: 'ACID: aislamiento | BASE: stale read',
  },
  {
    id: 'partition',
    label: 'Partición de Red',
    icon: '✂️',
    color: 'from-amber-600 to-amber-500',
    hoverColor: 'hover:from-amber-500 hover:to-amber-400',
    description: 'Un nodo se desconecta',
    expect: 'ACID: CP | BASE: AP',
  },
];

export default function ScenarioPanel({ onRunScenario, running, activeScenario }) {
  return (
    <div className="flex flex-col h-full gap-3">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
        Escenarios
      </h2>

      <div className="flex flex-col gap-2.5 flex-1">
        {scenarios.map((s) => {
          const isActive = activeScenario === s.id;
          return (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => onRunScenario(s.id)}
              disabled={running}
              className={`
                relative w-full py-2.5 px-3 rounded-xl text-left transition-all cursor-pointer
                bg-gradient-to-r ${s.color} ${s.hoverColor}
                disabled:opacity-30 disabled:cursor-not-allowed
                text-white shadow-lg
              `}
            >
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-white/60"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
              )}
              <div className="flex items-center gap-2">
                <span className="text-lg">{s.icon}</span>
                <div className="min-w-0">
                  <div className="font-bold text-sm leading-tight">{s.label}</div>
                  <div className="text-[10px] opacity-80 leading-tight mt-0.5">{s.description}</div>
                </div>
              </div>
              {!running && (
                <div className="text-[9px] opacity-60 mt-1 font-mono">{s.expect}</div>
              )}
            </motion.button>
          );
        })}
      </div>

      <CAPIndicator activeScenario={activeScenario} />
    </div>
  );
}
