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

// Inicializa la base de datos: constraint, limpieza, seed y verificación
async function initDatabase() {
  const d = getDriver();
  if (!d) {
    console.warn('[Neo4j] Saltando inicialización — sin conexión.');
    return { initialized: false, error: 'Sin conexión' };
  }

  try {
    await runQuery(
      'CREATE CONSTRAINT cuenta_titular_unique IF NOT EXISTS FOR (c:Cuenta) REQUIRE c.titular IS UNIQUE'
    );
    console.log('[Neo4j] Constraint de unicidad creado/verificado.');

    await runQuery('MATCH (n:Cuenta) DETACH DELETE n');
    console.log('[Neo4j] Datos anteriores eliminados.');

    await runQuery('CREATE (:Cuenta {titular: $name, saldo: $balance})', { name: 'Ana', balance: neo4j.int(1000) });
    await runQuery('CREATE (:Cuenta {titular: $name, saldo: $balance})', { name: 'Luis', balance: neo4j.int(500) });
    console.log('[Neo4j] Cuentas seed creadas: Ana=1000, Luis=500.');

    const verification = await runQuery('MATCH (c:Cuenta) RETURN c.titular AS titular, c.saldo AS saldo ORDER BY c.titular');
    console.log('[Neo4j] Verificación:', verification.map(r => `${r.titular}=${r.saldo}`).join(', '));

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
