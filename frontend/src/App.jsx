import { useState, useCallback } from 'react';
import { api } from './api';
import SplitView from './components/SplitView';
import TransactionLog from './components/TransactionLog';

export default function App() {
  const [acidLog, setAcidLog] = useState([]);
  const [baseLog, setBaseLog] = useState([]);
  const [resetting, setResetting] = useState(false);

  const addAcidLog = useCallback((entries) => {
    setAcidLog((prev) => [...prev, ...entries.map(e => ({ ...e, time: new Date().toISOString() }))]);
  }, []);

  const addBaseLog = useCallback((entries) => {
    setBaseLog((prev) => [...prev, ...entries.map(e => ({ ...e, time: new Date().toISOString() }))]);
  }, []);

  const handleReset = async () => {
    setResetting(true);
    await api.reset();
    setAcidLog([]);
    setBaseLog([]);
    setResetting(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-amber-400 flex items-center justify-center font-bold text-slate-900 text-sm">
            N4J
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              The Bank of Neo4j — <span className="text-teal-400">ACID</span> vs <span className="text-amber-400">BASE</span>
            </h1>
            <p className="text-xs text-slate-500">Equipo Somalia</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="px-4 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {resetting ? 'Reiniciando...' : 'Reiniciar Todo'}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <SplitView addAcidLog={addAcidLog} addBaseLog={addBaseLog} />
      </main>

      {/* Transaction Log */}
      <TransactionLog acidLog={acidLog} baseLog={baseLog} />
    </div>
  );
}
