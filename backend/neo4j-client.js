const neo4j = require('neo4j-driver');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const URI = process.env.NEO4J_URI;
const USER = process.env.NEO4J_USER;
const PASSWORD = process.env.NEO4J_PASSWORD;

let driver = null;
let connected = false;

function getDriver() {
  if (!driver && URI && USER && PASSWORD) {
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
  }
  return driver;
}

async function verifyConnectivity() {
  const d = getDriver();
  if (!d) {
    console.warn('[Neo4j] No se configuraron credenciales. Solo el lado BASE funcionará.');
    return { connected: false, error: 'Credenciales no configuradas' };
  }
  try {
    await d.verifyConnectivity();
    connected = true;
    console.log('[Neo4j] Conexión verificada exitosamente.');
    return { connected: true };
  } catch (err) {
    console.warn(`[Neo4j] No se pudo conectar: ${err.message}`);
    return { connected: false, error: err.message };
  }
}

function isConnected() {
  return connected;
}

async function runQuery(cypher, params = {}) {
  const d = getDriver();
  if (!d) throw new Error('Neo4j no está configurado');
  const session = d.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}

async function runTransaction(txFunction) {
  const d = getDriver();
  if (!d) throw new Error('Neo4j no está configurado');
  const session = d.session();
  try {
    return await session.executeWrite(txFunction);
  } finally {
    await session.close();
  }
}

async function runReadTransaction(txFunction) {
  const d = getDriver();
  if (!d) throw new Error('Neo4j no está configurado');
  const session = d.session();
  try {
    return await session.executeRead(txFunction);
  } finally {
    await session.close();
  }
}

/*
 * Modelo de grafo:
 *
 *   (:Banco {nombre: "Bank of Neo4j"})
 *       ↑ [:PERTENECE_A]
 *   (:Cuenta {numero: "C-001", saldo: 5000})
 *       ↑ [:TIENE_CUENTA]
 *   (:Persona {nombre: "Ana"})
 *
 *   Transferencias crean relaciones:
 *   (:Cuenta)-[:TRANSFERENCIA {monto, fecha, estado}]->(:Cuenta)
 */
async function initDatabase() {
  const d = getDriver();
  if (!d) {
    console.warn('[Neo4j] Saltando inicialización — sin conexión.');
    return { initialized: false, error: 'Sin conexión' };
  }

  try {
    // Constraints
    await runQuery('CREATE CONSTRAINT cuenta_numero_unique IF NOT EXISTS FOR (c:Cuenta) REQUIRE c.numero IS UNIQUE');
    await runQuery('CREATE CONSTRAINT persona_nombre_unique IF NOT EXISTS FOR (p:Persona) REQUIRE p.nombre IS UNIQUE');
    console.log('[Neo4j] Constraints creados/verificados.');

    // Limpiar todo
    await runQuery('MATCH (n) DETACH DELETE n');
    console.log('[Neo4j] Datos anteriores eliminados.');

    // Crear banco
    await runQuery('CREATE (:Banco {nombre: $nombre, fundado: date("2026-01-15")})', {
      nombre: 'Bank of Neo4j',
    });

    // Crear personas y cuentas con relaciones
    await runQuery(`
      MATCH (b:Banco {nombre: "Bank of Neo4j"})
      CREATE (ana:Persona {nombre: "Ana", email: "ana@uvg.edu.gt"})
      CREATE (cAna:Cuenta {numero: "C-001", saldo: $saldoAna, tipo: "Ahorro", creada: datetime()})
      CREATE (ana)-[:TIENE_CUENTA {desde: date("2026-01-20")}]->(cAna)
      CREATE (cAna)-[:PERTENECE_A]->(b)
    `, { saldoAna: neo4j.int(5000) });

    await runQuery(`
      MATCH (b:Banco {nombre: "Bank of Neo4j"})
      CREATE (luis:Persona {nombre: "Luis", email: "luis@uvg.edu.gt"})
      CREATE (cLuis:Cuenta {numero: "C-002", saldo: $saldoLuis, tipo: "Ahorro", creada: datetime()})
      CREATE (luis)-[:TIENE_CUENTA {desde: date("2026-02-10")}]->(cLuis)
      CREATE (cLuis)-[:PERTENECE_A]->(b)
    `, { saldoLuis: neo4j.int(3000) });

    console.log('[Neo4j] Grafo seed creado:');
    console.log('  Banco: Bank of Neo4j');
    console.log('  Persona(Ana) -[:TIENE_CUENTA]-> Cuenta(C-001, saldo=5000) -[:PERTENECE_A]-> Banco');
    console.log('  Persona(Luis) -[:TIENE_CUENTA]-> Cuenta(C-002, saldo=3000) -[:PERTENECE_A]-> Banco');

    // Verificación
    const verification = await runQuery(`
      MATCH (p:Persona)-[:TIENE_CUENTA]->(c:Cuenta)-[:PERTENECE_A]->(b:Banco)
      RETURN p.nombre AS persona, c.numero AS cuenta, c.saldo AS saldo, b.nombre AS banco
      ORDER BY p.nombre
    `);
    console.log('[Neo4j] Verificación:', verification.map(r =>
      `${r.persona} -> ${r.cuenta} (Q${r.saldo}) -> ${r.banco}`
    ).join(' | '));

    return { initialized: true, accounts: verification };
  } catch (err) {
    console.error(`[Neo4j] Error en inicialización: ${err.message}`);
    return { initialized: false, error: err.message };
  }
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
    connected = false;
  }
}

module.exports = {
  getDriver,
  verifyConnectivity,
  isConnected,
  runQuery,
  runTransaction,
  runReadTransaction,
  initDatabase,
  closeDriver,
  neo4j,
};
