import { useState, useCallback, useRef } from 'react';
import ACIDPanel from './ACIDPanel';
import BASEPanel from './BASEPanel';
import ScenarioPanel from './ScenarioPanel';
import { api, pollState } from '../api';

export default function SplitView({ addAcidLog, addBaseLog }) {
  const [acidData, setAcidData] = useState(null);
  const [baseData, setBaseData] = useState(null);
  const [acidStatus, setAcidStatus] = useState('idle');
  const [baseStatus, setBaseStatus] = useState('idle');
  const [running, setRunning] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);
  const [partitionedNode, setPartitionedNode] = useState(null);
  const cancelPoll = useRef(null);

  const startPolling = useCallback(() => {
    if (cancelPoll.current) cancelPoll.current();
    cancelPoll.current = pollState(({ acid, base, done }) => {
      if (acid) setAcidData(acid);
      if (base) setBaseData(base);
      if (done && cancelPoll.current) cancelPoll.current = null;
    }, 10000, 500);
  }, []);

  const fetchInitialState = useCallback(async () => {
    const [acid, base] = await Promise.all([api.acidBalances(), api.baseState()]);
    if (acid.data) setAcidData(acid.data);
    if (base.data) setBaseData(base.data);
  }, []);

  const runScenario = useCallback(async (scenario) => {
    setRunning(true);
    setActiveScenario(scenario);

    try {
      switch (scenario) {
        case 'normal': {
          setAcidStatus('in_progress');
          setBaseStatus('in_progress');

          const [acidRes, baseRes] = await Promise.all([
            api.acidTransfer('Ana', 'Luis', 200),
            api.baseTransfer('Ana', 'Luis', 200),
          ]);

          if (acidRes.data?.log) addAcidLog(acidRes.data.log);
          if (acidRes.data) setAcidData({ balances: acidRes.data.balances, total: acidRes.data.total });
          setAcidStatus(acidRes.success ? 'committed' : 'error');

          if (baseRes.success) {
            addBaseLog([{ action: 'WRITE', detail: 'Primario actualizado, propagando a secundarios...' }]);
          }
          setBaseStatus(baseRes.success ? 'propagating' : 'error');
          startPolling();

          setTimeout(() => {
            setAcidStatus('idle');
            setBaseStatus('idle');
          }, 8000);
          break;
        }

        case 'crash': {
          setAcidStatus('in_progress');
          setBaseStatus('in_progress');

          const [acidRes, baseRes] = await Promise.all([
            api.acidTransferCrash('Ana', 'Luis', 200),
            api.baseTransferCrash('Ana', 'Luis', 200),
          ]);

          if (acidRes.data?.log) addAcidLog(acidRes.data.log);
          if (acidRes.data) setAcidData({ balances: acidRes.data.balances, total: acidRes.data.total });
          setAcidStatus('rolled_back');

          if (baseRes.data) {
            addBaseLog([
              { action: 'CRASH', detail: 'Primario actualizado, pero propagación interrumpida' },
              { action: 'INCONSISTENCY', detail: 'Secundarios tienen datos obsoletos' },
            ]);
          }
          setBaseStatus('inconsistent');
          startPolling();

          setTimeout(() => {
            setAcidStatus('idle');
          }, 8000);
          break;
        }

        case 'concurrent': {
          setAcidStatus('in_progress');
          setBaseStatus('in_progress');

          const acidRes = await api.acidConcurrentRead('Ana', 'Luis', 200);
          if (acidRes.data?.log) addAcidLog(acidRes.data.log);
          if (acidRes.data?.transferResult) {
            setAcidData(acidRes.data.transferResult);
          }
          setAcidStatus('committed');

          const baseTransfer = await api.baseTransfer('Ana', 'Luis', 200);
          if (baseTransfer.success) {
            addBaseLog([{ action: 'WRITE', detail: 'Transferencia BASE iniciada' }]);
          }

          const staleRead = await api.baseReadFrom('Ana', 'node-2');
          if (staleRead.data) {
            addBaseLog([{
              action: 'STALE_READ',
              detail: `Lectura de Ana desde node-2: ${staleRead.data.balance} (${staleRead.data.isStale ? 'DESACTUALIZADO' : 'actual'})`,
            }]);
          }
          setBaseStatus('propagating');
          startPolling();

          setTimeout(() => {
            setAcidStatus('idle');
            setBaseStatus('idle');
          }, 8000);
          break;
        }

        case 'partition': {
          setBaseStatus('in_progress');

          await api.basePartition('node-3');
          setPartitionedNode('node-3');
          addBaseLog([{ action: 'PARTITION', detail: 'node-3 desconectado' }]);

          const baseTransfer = await api.baseTransfer('Ana', 'Luis', 200);
          if (baseTransfer.success) {
            addBaseLog([{ action: 'WRITE', detail: 'Transferencia ejecutada — node-3 no recibió actualización' }]);
          }
          setBaseStatus('inconsistent');
          startPolling();

          addAcidLog([{
            action: 'INFO',
            detail: 'Neo4j (CP): en una partición real, prefiere consistencia sobre disponibilidad',
          }]);
          setAcidStatus('idle');

          setTimeout(async () => {
            await api.baseHeal('node-3');
            setPartitionedNode(null);
            addBaseLog([{ action: 'HEAL', detail: 'node-3 reconectado y sincronizado' }]);
            setBaseStatus('idle');
            startPolling();
          }, 6000);
          break;
        }
      }
    } catch (err) {
      addAcidLog([{ action: 'ERROR', detail: err.message }]);
    }

    setTimeout(() => {
      setRunning(false);
      setActiveScenario(null);
      fetchInitialState();
    }, 10000);
  }, [addAcidLog, addBaseLog, startPolling, fetchInitialState]);

  // Fetch initial state on mount
  useState(() => { fetchInitialState(); });

  return (
    <div className="flex h-full min-h-[500px]">
      <div className="flex-1 p-4 overflow-auto">
        <ACIDPanel data={acidData} status={acidStatus} />
      </div>
      <div className="w-64 flex-shrink-0 border-x border-slate-800 p-4">
        <ScenarioPanel onRunScenario={runScenario} running={running} activeScenario={activeScenario} />
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <BASEPanel data={baseData} status={baseStatus} partitionedNode={partitionedNode} />
      </div>
    </div>
  );
}
