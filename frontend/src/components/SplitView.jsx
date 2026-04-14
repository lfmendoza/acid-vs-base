import { useState, useCallback, useRef, useEffect } from 'react';
import ACIDPanel from './ACIDPanel';
import BASEPanel from './BASEPanel';
import ScenarioPanel from './ScenarioPanel';
import StepNarrator from './StepNarrator';
import { api, pollState } from '../api';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function SplitView({ addAcidLog, addBaseLog, setBaseLogFromSync }) {
  const [acidData, setAcidData] = useState(null);
  const [baseData, setBaseData] = useState(null);
  const [acidStatus, setAcidStatus] = useState('idle');
  const [baseStatus, setBaseStatus] = useState('idle');
  const [running, setRunning] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);
  const [partitionedNode, setPartitionedNode] = useState(null);
  const [activeSide, setActiveSide] = useState(null);
  const [narratorText, setNarratorText] = useState('');
  const [narratorType, setNarratorType] = useState('info');
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const cancelPoll = useRef(null);

  const narrate = useCallback((text, type = 'info') => {
    setNarratorText(text);
    setNarratorType(type);
  }, []);

  // Sync BASE logs from backend syncLog
  const syncBaseLogs = useCallback(async () => {
    const res = await api.baseState();
    if (res.data?.syncLog) {
      setBaseLogFromSync(res.data.syncLog.map(e => ({
        time: e.time,
        action: e.event,
        detail: e.details,
      })));
    }
    return res;
  }, [setBaseLogFromSync]);

  const startPolling = useCallback((duration = 8000) => {
    if (cancelPoll.current) cancelPoll.current();
    cancelPoll.current = pollState(({ acid, base, done }) => {
      if (acid) setAcidData(acid);
      if (base) {
        setBaseData(base);
        if (base.syncLog) {
          setBaseLogFromSync(base.syncLog.map(e => ({
            time: e.time,
            action: e.event,
            detail: e.details,
          })));
        }
      }
      if (done && cancelPoll.current) cancelPoll.current = null;
    }, duration, 500);
  }, [setBaseLogFromSync]);

  const fetchState = useCallback(async () => {
    const [acid, base] = await Promise.all([api.acidBalances(), api.baseState()]);
    if (acid.data) setAcidData(acid.data);
    if (base.data) {
      setBaseData(base.data);
      if (base.data.syncLog) {
        setBaseLogFromSync(base.data.syncLog.map(e => ({
          time: e.time,
          action: e.event,
          detail: e.details,
        })));
      }
    }
  }, [setBaseLogFromSync]);

  // --- SCENARIO: Normal Transfer ---
  const runNormal = useCallback(async () => {
    setTotalSteps(6);

    setCurrentStep(1);
    narrate('Ana le transfiere Q200 a Luis. Veamos cómo lo maneja cada sistema.', 'info');
    await sleep(2500);

    // ACID
    setCurrentStep(2);
    setActiveSide('acid');
    narrate('ACID: Ejecutando transacción atómica en Neo4j...', 'acid');
    setAcidStatus('in_progress');
    await sleep(1000);

    const acidRes = await api.acidTransfer('Ana', 'Luis', 200);
    if (acidRes.data?.log) addAcidLog(acidRes.data.log);
    if (acidRes.data) setAcidData({ balances: acidRes.data.balances, total: acidRes.data.total });

    setCurrentStep(3);
    setAcidStatus('committed');
    narrate('ACID: Todo o nada. La transacción se aplicó completa al instante. Total = Q8000.', 'success');
    await sleep(3000);

    // BASE
    setCurrentStep(4);
    setActiveSide('base');
    narrate('BASE: Escribiendo en el nodo primario... los secundarios aún no lo saben.', 'base');
    setBaseStatus('in_progress');
    await sleep(800);

    await api.baseTransfer('Ana', 'Luis', 200);
    await syncBaseLogs();
    setBaseStatus('propagating');

    setCurrentStep(5);
    narrate('BASE: El primario ya cambió, pero los secundarios reciben la copia con delay... observa los logs y cómo se actualizan uno a uno.', 'warning');
    startPolling(8000);
    await sleep(5000);

    setCurrentStep(6);
    setActiveSide(null);
    await fetchState();
    narrate('Ambos llegaron al mismo resultado, pero ACID fue instantáneo y atómico, mientras BASE convergió gradualmente.', 'success');
    await sleep(3000);

    setAcidStatus('idle');
    setBaseStatus('idle');
  }, [addAcidLog, narrate, fetchState, startPolling, syncBaseLogs]);

  // --- SCENARIO: Crash ---
  const runCrash = useCallback(async () => {
    setTotalSteps(9);

    setCurrentStep(1);
    narrate('Vamos a simular un CRASH del sistema a mitad de una transferencia. ¿Qué pasa con el dinero?', 'info');
    await sleep(3000);

    // ACID crash
    setCurrentStep(2);
    setActiveSide('acid');
    narrate('ACID: Debitando Q200 de Ana... pero el sistema FALLA antes de acreditar a Luis.', 'acid');
    setAcidStatus('in_progress');
    await sleep(2000);

    const acidRes = await api.acidTransferCrash('Ana', 'Luis', 200);
    if (acidRes.data?.log) addAcidLog(acidRes.data.log);

    setCurrentStep(3);
    setAcidStatus('rolled_back');
    if (acidRes.data) setAcidData({ balances: acidRes.data.balances, total: acidRes.data.total });
    narrate('ACID: ROLLBACK automático. El dinero de Ana nunca se perdió. Total sigue siendo Q8000.', 'success');
    await sleep(4000);

    // BASE crash
    setCurrentStep(4);
    setActiveSide('base');
    narrate('BASE: Mismo escenario... el primario se actualiza pero el crash impide la propagación inmediata.', 'base');
    setBaseStatus('in_progress');
    await sleep(2000);

    await api.baseTransferCrash('Ana', 'Luis', 200);
    await syncBaseLogs();

    setCurrentStep(5);
    setBaseStatus('inconsistent');
    await fetchState();
    narrate('BASE: El primario tiene datos nuevos, pero los secundarios se quedaron con los viejos. ¡INCONSISTENCIA! Revisa los logs para ver cada detalle.', 'error');
    await sleep(4000);

    setCurrentStep(6);
    setActiveSide(null);
    narrate('Compara los totales: ACID = Q8000 (siempre consistente). BASE tiene totales DIFERENTES entre réplicas.', 'warning');
    await sleep(4000);

    // Eventual convergence
    setCurrentStep(7);
    setActiveSide('base');
    narrate('Pero BASE es "Eventually Consistent"... el anti-entropy daemon detecta la divergencia y sincroniza...', 'base');
    setBaseStatus('propagating');
    startPolling(10000);
    await sleep(5000);
    await fetchState();

    setCurrentStep(8);
    narrate('Los secundarios convergieron con el primario. La inconsistencia fue TEMPORAL, no permanente.', 'success');
    setBaseStatus('idle');
    await fetchState();
    await sleep(4000);

    setCurrentStep(9);
    setActiveSide(null);
    narrate('ACID: nunca hay inconsistencia (rollback). BASE: inconsistencia temporal que converge eventualmente. Dos filosofías diferentes.', 'info');
    await sleep(3000);

    setAcidStatus('idle');
  }, [addAcidLog, narrate, fetchState, startPolling, syncBaseLogs]);

  // --- SCENARIO: Concurrent Reads ---
  const runConcurrent = useCallback(async () => {
    setTotalSteps(6);

    setCurrentStep(1);
    narrate('¿Qué ve otro usuario que lee los saldos MIENTRAS se ejecuta una transferencia?', 'info');
    await sleep(3000);

    // ACID
    setCurrentStep(2);
    setActiveSide('acid');
    narrate('ACID: Transferencia en curso + lectura concurrente desde otra sesión...', 'acid');
    setAcidStatus('in_progress');
    await sleep(1500);

    const acidRes = await api.acidConcurrentRead('Ana', 'Luis', 200);
    if (acidRes.data?.log) addAcidLog(acidRes.data.log);

    setCurrentStep(3);
    setAcidStatus('committed');
    if (acidRes.data?.transferResult) setAcidData(acidRes.data.transferResult);
    const readTotal = acidRes.data?.concurrentRead?.total;
    narrate(`ACID: La lectura concurrente vio total = Q${readTotal}. Siempre un estado consistente gracias al AISLAMIENTO.`, 'success');
    await sleep(4000);

    // BASE
    setCurrentStep(4);
    setActiveSide('base');
    narrate('BASE: Ejecutando transferencia... e inmediatamente leyendo de un secundario.', 'base');
    setBaseStatus('in_progress');
    await sleep(1500);

    await api.baseTransfer('Ana', 'Luis', 200);
    const staleRead = await api.baseReadFrom('Ana', 'node-2');
    await syncBaseLogs();

    setCurrentStep(5);
    setBaseStatus('propagating');

    if (staleRead.data) {
      narrate(
        `BASE: El secundario devolvió Q${staleRead.data.balance} para Ana — ${staleRead.data.isStale ? 'un DATO DESACTUALIZADO' : 'dato actual'}. Sin aislamiento.`,
        staleRead.data.isStale ? 'error' : 'success'
      );
    }
    await sleep(4000);

    setCurrentStep(6);
    setActiveSide(null);
    startPolling(6000);
    narrate('ACID garantiza que siempre lees un estado consistente. BASE puede devolverte datos viejos.', 'info');
    await sleep(3000);

    setAcidStatus('idle');
    setBaseStatus('idle');
  }, [addAcidLog, narrate, fetchState, startPolling, syncBaseLogs]);

  // --- SCENARIO: Network Partition ---
  const runPartition = useCallback(async () => {
    setTotalSteps(7);

    setCurrentStep(1);
    narrate('Simulemos una partición de red: un nodo se desconecta. ¿Cómo reaccionan ACID y BASE?', 'info');
    await sleep(3000);

    setCurrentStep(2);
    setActiveSide('base');
    narrate('BASE: Desconectando Nodo 3 de la red...', 'warning');
    await api.basePartition('node-3');
    setPartitionedNode('node-3');
    await syncBaseLogs();
    await sleep(2500);

    setCurrentStep(3);
    narrate('BASE: Ejecutando transferencia... el Nodo 3 no recibirá esta actualización.', 'base');
    setBaseStatus('in_progress');
    await sleep(1000);

    await api.baseTransfer('Ana', 'Luis', 200);
    await syncBaseLogs();
    setBaseStatus('inconsistent');
    startPolling(8000);
    await sleep(1000);

    setCurrentStep(4);
    narrate('BASE: El Nodo 3 (gris) sigue con datos viejos. Los otros nodos ya se actualizaron. El sistema sigue DISPONIBLE pero INCONSISTENTE.', 'error');
    await sleep(4000);

    setCurrentStep(5);
    setActiveSide('acid');
    addAcidLog([{
      action: 'INFO',
      detail: 'Neo4j es un sistema CP: ante una partición, rechaza operaciones para mantener consistencia.',
    }]);
    narrate('ACID (Neo4j): Es un sistema CP — ante una partición, RECHAZA operaciones para no comprometer la consistencia.', 'acid');
    await sleep(4000);

    setCurrentStep(6);
    setActiveSide('base');
    narrate('BASE: Reconectando Nodo 3... se sincroniza con el primario automáticamente.', 'success');
    await api.baseHeal('node-3');
    setPartitionedNode(null);
    await syncBaseLogs();
    setBaseStatus('propagating');
    await sleep(3000);

    setCurrentStep(7);
    setActiveSide(null);
    setBaseStatus('idle');
    await fetchState();
    narrate('BASE = AP (disponible + tolerante a particiones). ACID = CP (consistente + tolerante a particiones). Es una elección, no hay sistema perfecto.', 'info');
    await sleep(3000);

    setAcidStatus('idle');
  }, [addAcidLog, narrate, fetchState, startPolling, syncBaseLogs]);

  // --- Main runner ---
  const runScenario = useCallback(async (scenario) => {
    setRunning(true);
    setActiveScenario(scenario);
    setCurrentStep(0);
    setPartitionedNode(null);

    narrate('Reiniciando saldos para el escenario...', 'info');
    await api.reset();
    await fetchState();
    await sleep(800);

    try {
      switch (scenario) {
        case 'normal': await runNormal(); break;
        case 'crash': await runCrash(); break;
        case 'concurrent': await runConcurrent(); break;
        case 'partition': await runPartition(); break;
      }
    } catch (err) {
      narrate(`Error: ${err.message}`, 'error');
    }

    setRunning(false);
    setActiveScenario(null);
    setActiveSide(null);
    setCurrentStep(0);
    setTotalSteps(0);
    narrate('', 'info');
  }, [runNormal, runCrash, runConcurrent, runPartition, narrate, fetchState]);

  useEffect(() => { fetchState(); }, [fetchState]);

  return (
    <div className="flex flex-col h-full">
      <StepNarrator
        text={narratorText}
        type={narratorType}
        currentStep={currentStep}
        totalSteps={totalSteps}
      />

      <div className="flex flex-1 min-h-0">
        <div className={`flex-1 p-4 overflow-auto transition-all duration-500 ${activeSide === 'base' ? 'opacity-40' : ''} ${activeSide === 'acid' ? 'ring-2 ring-teal-500/30 rounded-xl m-1' : ''}`}>
          <ACIDPanel data={acidData} status={acidStatus} active={activeSide === 'acid'} />
        </div>
        <div className="w-56 flex-shrink-0 border-x border-slate-800 p-3">
          <ScenarioPanel onRunScenario={runScenario} running={running} activeScenario={activeScenario} />
        </div>
        <div className={`flex-1 p-4 overflow-auto transition-all duration-500 ${activeSide === 'acid' ? 'opacity-40' : ''} ${activeSide === 'base' ? 'ring-2 ring-amber-500/30 rounded-xl m-1' : ''}`}>
          <BASEPanel data={baseData} status={baseStatus} partitionedNode={partitionedNode} active={activeSide === 'base'} />
        </div>
      </div>
    </div>
  );
}
