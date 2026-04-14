import { motion } from 'framer-motion';
import CAPIndicator from './CAPIndicator';

const scenarios = [
  {
    id: 'normal',
    label: 'Transferencia Normal',
    color: 'from-emerald-600 to-emerald-500',
    hoverColor: 'hover:from-emerald-500 hover:to-emerald-400',
    description: 'Transferencia exitosa en ambos sistemas',
  },
  {
    id: 'crash',
    label: 'Crash a Mitad',
    color: 'from-red-600 to-red-500',
    hoverColor: 'hover:from-red-500 hover:to-red-400',
    description: 'Fallo durante la transacción',
  },
  {
    id: 'concurrent',
    label: 'Lecturas Concurrentes',
    color: 'from-blue-600 to-blue-500',
    hoverColor: 'hover:from-blue-500 hover:to-blue-400',
    description: 'Lectura durante una escritura',
  },
  {
    id: 'partition',
    label: 'Partición de Red',
    color: 'from-amber-600 to-amber-500',
    hoverColor: 'hover:from-amber-500 hover:to-amber-400',
    description: 'Un nodo se desconecta',
  },
];

export default function ScenarioPanel({ onRunScenario, running, activeScenario }) {
  return (
    <div className="flex flex-col h-full gap-4">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider text-center">
        Escenarios
      </h2>

      <div className="flex flex-col gap-3 flex-1">
        {scenarios.map((s) => {
          const isActive = activeScenario === s.id;
          return (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => onRunScenario(s.id)}
              disabled={running}
              className={`
                relative w-full py-3 px-4 rounded-xl text-left transition-all cursor-pointer
                bg-gradient-to-r ${s.color} ${s.hoverColor}
                disabled:opacity-40 disabled:cursor-not-allowed
                text-white font-medium text-sm shadow-lg
              `}
            >
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-white/50"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}
              <div>{s.label}</div>
              <div className="text-xs opacity-75 mt-0.5">{s.description}</div>
            </motion.button>
          );
        })}
      </div>

      <CAPIndicator activeScenario={activeScenario} />
    </div>
  );
}
