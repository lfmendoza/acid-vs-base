// Lógica de orquestación de escenarios (referencia documentada).
// El frontend orquesta las llamadas a los endpoints directamente,
// pero estas funciones documentan la secuencia esperada de cada escenario.

/**
 * Escenario 1: Transferencia Normal
 * - POST /api/acid/transfer  { from: "Ana", to: "Luis", amount: 200 }
 * - POST /api/base/transfer  { from: "Ana", to: "Luis", amount: 200 }
 * - Poll GET /api/base/state cada 500ms por 10s para ver convergencia
 * 
 * Resultado esperado:
 * - ACID: transferencia atómica, saldos actualizados al instante
 * - BASE: primario actualizado de inmediato, secundarios convergen en 2-4s
 */

/**
 * Escenario 2: Crash a Mitad
 * - POST /api/acid/transfer-with-crash  { from: "Ana", to: "Luis", amount: 200 }
 * - POST /api/base/transfer-with-crash  { from: "Ana", to: "Luis", amount: 200 }
 * 
 * Resultado esperado:
 * - ACID: rollback automático, saldos sin cambios (total = 1500)
 * - BASE: primario actualizado pero secundarios desactualizados (inconsistencia)
 */

/**
 * Escenario 3: Lecturas Concurrentes
 * - POST /api/acid/concurrent-read  { from: "Ana", to: "Luis", amount: 200 }
 * - POST /api/base/transfer { from: "Ana", to: "Luis", amount: 200 }
 *   + inmediatamente POST /api/base/read-from { account: "Ana", replicaId: "node-2" }
 * 
 * Resultado esperado:
 * - ACID: lectura concurrente ve estado consistente (aislamiento)
 * - BASE: lectura de secundario puede ver datos antiguos (stale read)
 */

/**
 * Escenario 4: Partición de Red
 * - POST /api/base/partition { nodeId: "node-3" }
 * - POST /api/base/transfer { from: "Ana", to: "Luis", amount: 200 }
 * - Poll GET /api/base/state para ver que node-3 no se actualiza
 * - POST /api/base/heal { nodeId: "node-3" } — convergencia
 * 
 * ACID no tiene partición simulable con un solo nodo Neo4j,
 * pero se puede mostrar que Neo4j prefiere consistencia (CP).
 */

module.exports = {
  SCENARIOS: ['normal-transfer', 'crash', 'concurrent-read', 'network-partition'],
};
