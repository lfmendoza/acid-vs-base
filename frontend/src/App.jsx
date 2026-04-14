import { useState, useCallback } from 'react';
import { api } from './api';
import SplitView from './components/SplitView';
import TransactionLog from './components/TransactionLog';

export default function App() {
  const [acidLog, setAcidLog] = useState([]);
  const [baseLog, setBaseLog] = useState([]);
  const [resetting, setResetting] = useState(false);

  const addAcidLog = useCallback((entries) => {
    setAcidLog((prev) => [
      ...prev,
      ...entries.map(e => ({ ...e, time: e.time || new Date().toISOString() })),
    ]);
  }, []);

  // Replace BASE logs entirely from backend syncLog
  const setBaseLogFromSync = useCallback((entries) => {
    setBaseLog(entries);
  }, []);

  const handleReset = async () => {
    setResetting(true);
    await api.reset();
    setAcidLog([]);
    setBaseLog([]);
    setResetting(false);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900/90 border-b border-slate-800 flex-shrink-0 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-amber-400 flex items-center justify-center font-black text-slate-900 text-xs">
            N4J
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">
              The Bank of Neo4j — <span className="text-teal-400">ACID</span> vs <span className="text-amber-400">BASE</span>
            </h1>
            <p className="text-[11px] text-slate-500">CC3089 Base de Datos II &middot; Equipo Somalia</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="px-4 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer font-medium"
        >
          {resetting ? 'Reiniciando...' : '↻ Reiniciar Todo'}
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        <SplitView addAcidLog={addAcidLog} setBaseLogFromSync={setBaseLogFromSync} />
      </main>

      <TransactionLog acidLog={acidLog} baseLog={baseLog} />
    </div>
  );
}
