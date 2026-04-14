import { useState, useCallback, useRef, useEffect } from 'react';
import ACIDPanel from './ACIDPanel';
import BASEPanel from './BASEPanel';
import ScenarioPanel from './ScenarioPanel';
import StepNarrator from './StepNarrator';
import { api, pollState } from '../api';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function SplitView({ setAcidLog, setBaseLog }) {
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

  function formatSyncLog(syncLog) {
    return syncLog.map(e => ({ time: e.time, action: e.event, detail: e.details }));
  }

  // Sync both logs from backend
  const syncLogs = useCallback(async () => {
    const [acidLogRes, baseRes] = await Promise.all([api.acidLog(), api.baseState()]);
    if (acidLogRes.data?.log) setAcidLog(acidLogRes.data.log.map(e => ({ time: e.time, action: e.event, detail: e.details })));
    if (baseRes.data?.syncLog) setBaseLog(formatSyncLog(baseRes.data.syncLog));
    return baseRes;
  }, [setAcidLog, setBaseLog]);

  const startPolling = useCallback((duration = 8000) => {
    if (cancelPoll.current) cancelPoll.current();
    cancelPoll.current = pollState(async ({ acid, base, done }) => {
      if (acid) setAcidData(acid);
      if (base) {
        setBaseData(base);
        if (base.syncLog) setBaseLog(formatSyncLog(base.syncLog));
      }
      // Also sync ACID log during polling
      const acidLogRes = await api.acidLog();
      if (acidLogRes.data?.log) setAcidLog(acidLogRes.data.log.map(e => ({ time: e.time, action: e.event, detail: e.details })));
      if (done && cancelPoll.current) cancelPoll.current = null;
    }, duration, 500);
  }, [setAcidLog, setBaseLog]);

  const fetchState = useCallback(async () => {
    const [acid, base, acidLogRes] = await Promise.all([api.acidBalances(), api.baseState(), api.acidLog()]);
    if (acid.data) setAcidData(acid.data);
    if (base.data) {
      setBaseData(base.data);
      if (base.data.syncLog) setBaseLog(formatSyncLog(base.data.syncLog));
    }
    if (acidLogRes.data?.log) setAcidLog(acidLogRes.data.log.map(e => ({ time: e.time, action: e.event, detail: e.details })));
  }, [setAcidLog, setBaseLog]);

  // --- SCENARIO: Normal Transfer ---
  const runNormal = useCallback(async () => {
    setTotalSteps(7);

    setCurrentStep(1);
    narrate('Ana le transfiere Q200 a Luis. Veamos cómo lo maneja cada sistema. Observa los logs de cada lado.', 'info');
    await sleep(5000);

    setCurrentStep(2);
    setActiveSide('acid');
    narrate('ACID: Abriendo transacción en Neo4j... BEGIN → READ → VALIDATE → DEBIT → CREDIT → WRITE → COMMIT → VERIFY. Todo atómico.', 'acid');
    setAcidStatus('in_progress');
    await sleep(3000);

    const acidRes = await api.acidTransfer('Ana', 'Luis', 200);
    if (acidRes.data) setAcidData({ balances: acidRes.data.balances, total: acidRes.data.total });
    await syncLogs();

    setCurrentStep(3);
    setAcidStatus('committed');
    narrate('ACID: COMMIT confirmado. Revisa el log: cada paso se ejecutó dentro de una transacción atómica. VERIFY confirma integridad global.', 'success');
    await sleep(7000);

    setCurrentStep(4);
    setActiveSide('base');
    narrate('BASE: Misma operación pero SIN transacción global. Compara: los mismos pasos (READ, VALIDATE, DEBIT, CREDIT) pero solo en el primario.', 'base');
    setBaseStatus('in_progress');
    await sleep(4000);

    await api.baseTransfer('Ana', 'Luis', 200);
    await syncLogs();
    setBaseStatus('propagating');

    setCurrentStep(5);
    narrate('BASE: El primario confirmó (ACK), pero los secundarios aún tienen datos viejos (STALE). Observa el log: INCONSISTENT aparece.', 'warning');
    startPolling(10000);
    await sleep(7000);

    setCurrentStep(6);
    await fetchState();
    narrate('BASE: Los secundarios recibieron la copia (SYNC). Observa en el log: CONSISTENT aparece cuando todas las réplicas convergen.', 'base');
    await sleep(6000);

    setCurrentStep(7);
    setActiveSide(null);
    await fetchState();
    narrate('Compara ambos logs lado a lado: los mismos pasos, pero ACID tiene COMMIT atómico y BASE tiene ACK local + propagación gradual.', 'success');
    await sleep(6000);

    setAcidStatus('idle');
    setBaseStatus('idle');
  }, [narrate, fetchState, startPolling, syncLogs]);

  // --- SCENARIO: Crash ---
  const runCrash = useCallback(async () => {
    setTotalSteps(9);

    setCurrentStep(1);
    narrate('¿Qué pasa si el sistema FALLA a mitad de una transferencia? Compara cómo cada sistema maneja el mismo fallo.', 'info');
    await sleep(5000);

    setCurrentStep(2);
    setActiveSide('acid');
    narrate('ACID: Observa el log — READ, VALIDATE, DEBIT se ejecutan... pero CRASH ocurre antes del CREDIT.', 'acid');
    setAcidStatus('in_progress');
    await sleep(4000);

    const acidRes = await api.acidTransferCrash('Ana', 'Luis', 200);
    await syncLogs();

    setCurrentStep(3);
    setAcidStatus('rolled_back');
    if (acidRes.data) setAcidData({ balances: acidRes.data.balances, total: acidRes.data.total });
    narrate('ACID: ROLLBACK automático. Lee el log: el DEBIT fue deshecho, VERIFY confirma Q8000 intactos. Ningún dinero perdido.', 'success');
    await sleep(7000);

    setCurrentStep(4);
    setActiveSide('base');
    narrate('BASE: Mismo fallo. Lee el log: los mismos pasos (READ, VALIDATE, DEBIT, CREDIT) se ejecutan en el primario... pero el crash impide la propagación.', 'base');
    setBaseStatus('in_progress');
    await sleep(5000);

    await api.baseTransferCrash('Ana', 'Luis', 200);
    await syncLogs();

    setCurrentStep(5);
    setBaseStatus('inconsistent');
    await fetchState();
    narrate('BASE: NO hay rollback. El DEBIT y CREDIT son permanentes en el primario. Los secundarios tienen datos ANTERIORES. Lee CRASH + STALE en el log.', 'error');
    await sleep(7000);

    setCurrentStep(6);
    setActiveSide(null);
    narrate('CONTRASTE CLAVE: ACID log tiene ROLLBACK → VERIFY (intacto). BASE log tiene CRASH → STALE → INCONSISTENT (réplicas divergen).', 'warning');
    await sleep(7000);

    setCurrentStep(7);
    setActiveSide('base');
    narrate('BASE es "Eventually Consistent": el daemon de anti-entropy detecta la divergencia. Observa SYNC apareciendo en el log...', 'base');
    setBaseStatus('propagating');
    startPolling(12000);
    await sleep(8000);
    await fetchState();

    setCurrentStep(8);
    narrate('Convergencia completada. El log muestra: SYNC → CONSISTENT → VERIFY. La inconsistencia fue temporal, no permanente.', 'success');
    setBaseStatus('idle');
    await fetchState();
    await sleep(6000);

    setCurrentStep(9);
    setActiveSide(null);
    narrate('ACID: atomicidad → rollback instantáneo, datos siempre íntegros. BASE: disponibilidad → inconsistencia temporal, convergencia eventual.', 'info');
    await sleep(6000);

    setAcidStatus('idle');
  }, [narrate, fetchState, startPolling, syncLogs]);

  // --- SCENARIO: Concurrent Reads ---
  const runConcurrent = useCallback(async () => {
    setTotalSteps(6);

    setCurrentStep(1);
    narrate('¿Qué ve otro usuario leyendo saldos MIENTRAS se ejecuta una transferencia? Esto demuestra la propiedad de AISLAMIENTO (la I de ACID).', 'info');
    await sleep(5000);

    setCurrentStep(2);
    setActiveSide('acid');
    narrate('ACID: Sesión A ejecuta transferencia. Sesión B lee concurrentemente. Observa en el log ambas sesiones en paralelo.', 'acid');
    setAcidStatus('in_progress');
    await sleep(4000);

    const acidRes = await api.acidConcurrentRead('Ana', 'Luis', 200);
    await syncLogs();

    setCurrentStep(3);
    setAcidStatus('committed');
    if (acidRes.data?.transferResult) setAcidData(acidRes.data.transferResult);
    const readTotal = acidRes.data?.concurrentRead?.total;
    narrate(`ACID: Sesión B vio total=Q${readTotal}. Lee CONSISTENT en el log: la lectura SIEMPRE ve un estado completo, nunca datos a medias.`, 'success');
    await sleep(7000);

    setCurrentStep(4);
    setActiveSide('base');
    narrate('BASE: Misma situación. Transferencia + lectura inmediata de un secundario. Observa el log: READ muestra de qué réplica leyó.', 'base');
    setBaseStatus('in_progress');
    await sleep(4000);

    await api.baseTransfer('Ana', 'Luis', 200);
    const staleRead = await api.baseReadFrom('Ana', 'node-2');
    await syncLogs();

    setCurrentStep(5);
    setBaseStatus('propagating');

    if (staleRead.data) {
      narrate(
        `BASE: node-2 devolvió Q${staleRead.data.balance} para Ana — ${staleRead.data.isStale ? 'DATO DESACTUALIZADO. Revisa STALE en el log: el primario ya tiene un valor diferente.' : 'dato actual.'}`,
        staleRead.data.isStale ? 'error' : 'success'
      );
    }
    await sleep(7000);

    setCurrentStep(6);
    setActiveSide(null);
    startPolling(6000);
    narrate('CONTRASTE: ACID garantiza aislamiento (snapshot consistente). BASE puede devolver datos obsoletos de cualquier réplica.', 'info');
    await sleep(6000);

    setAcidStatus('idle');
    setBaseStatus('idle');
  }, [narrate, fetchState, startPolling, syncLogs]);

  // --- SCENARIO: Network Partition ---
  const runPartition = useCallback(async () => {
    setTotalSteps(7);

    setCurrentStep(1);
    narrate('Simulemos una partición de red: un nodo pierde conectividad. Esto demuestra el Teorema CAP en acción.', 'info');
    await sleep(5000);

    setCurrentStep(2);
    setActiveSide('base');
    narrate('BASE: Desconectando Nodo 3. Observa el log: PARTITION muestra la topología y confirma que el sistema sigue disponible.', 'warning');
    await api.basePartition('node-3');
    setPartitionedNode('node-3');
    await syncLogs();
    await sleep(5000);

    setCurrentStep(3);
    narrate('BASE: Ejecutando transferencia con un nodo caído. Lee el log: los mismos pasos (READ, DEBIT, CREDIT) pero SYNC_FAILED para node-3.', 'base');
    setBaseStatus('in_progress');
    await sleep(4000);

    await api.baseTransfer('Ana', 'Luis', 200);
    await syncLogs();
    setBaseStatus('inconsistent');
    startPolling(8000);
    await sleep(3000);

    setCurrentStep(4);
    narrate('BASE: Nodo 3 tiene datos viejos. Nodo 1 y 2 se actualizaron. El sistema respondió (disponible) pero está inconsistente.', 'error');
    await sleep(7000);

    setCurrentStep(5);
    setActiveSide('acid');
    await api.acidLogPush([
      { event: 'PARTITION', details: 'Neo4j es un sistema CP (Consistency + Partition tolerance)' },
      { event: 'PARTITION', details: 'Ante una partición de red, RECHAZA operaciones para mantener consistencia' },
      { event: 'PARTITION', details: 'Prefiere NO responder a responder con datos incorrectos' },
    ]);
    await syncLogs();
    narrate('ACID (Neo4j): Sistema CP — ante partición, RECHAZA operaciones. Lee el log: prefiere no responder a dar datos incorrectos.', 'acid');
    await sleep(7000);

    setCurrentStep(6);
    setActiveSide('base');
    narrate('BASE: Reconectando Nodo 3. Lee el log: HEAL → SYNC (catch-up) → CONSISTENT. El nodo se pone al día automáticamente.', 'success');
    await api.baseHeal('node-3');
    setPartitionedNode(null);
    await syncLogs();
    setBaseStatus('propagating');
    await sleep(6000);

    setCurrentStep(7);
    setActiveSide(null);
    setBaseStatus('idle');
    await fetchState();
    narrate('Teorema CAP: no puedes tener C+A+P simultáneamente. ACID elige CP (consistencia). BASE elige AP (disponibilidad). No hay sistema perfecto.', 'info');
    await sleep(6000);

    setAcidStatus('idle');
  }, [narrate, fetchState, startPolling, syncLogs]);

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
