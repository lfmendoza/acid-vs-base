// ============================================================
// Ejemplos de transacciones ACID en Neo4j
// Modelo: (:Persona)-[:TIENE_CUENTA]->(:Cuenta)-[:PERTENECE_A]->(:Banco)
// Las transferencias crean: (:Cuenta)-[:TRANSFERENCIA]->(:Cuenta)
// ============================================================

// ----------------------------------------------------------
// Ejemplo 1: Transferencia atómica exitosa
// Atraviesa el grafo: Persona -> Cuenta, actualiza saldos
// y crea una relación TRANSFERENCIA entre cuentas
// ----------------------------------------------------------
:BEGIN
MATCH (pFrom:Persona {nombre: "Ana"})-[:TIENE_CUENTA]->(cFrom:Cuenta)
MATCH (pTo:Persona {nombre: "Luis"})-[:TIENE_CUENTA]->(cTo:Cuenta)
SET cFrom.saldo = cFrom.saldo - 200
SET cTo.saldo = cTo.saldo + 200
CREATE (cFrom)-[:TRANSFERENCIA {
  monto: 200,
  fecha: datetime(),
  estado: "completada"
}]->(cTo)
RETURN cFrom.saldo AS ana_nuevo, cTo.saldo AS luis_nuevo;
:COMMIT

// ----------------------------------------------------------
// Ejemplo 2: Consultar historial de transferencias (grafo)
// Aprovecha las relaciones para ver el flujo de dinero
// ----------------------------------------------------------
MATCH (pFrom:Persona)-[:TIENE_CUENTA]->(cFrom:Cuenta)
      -[t:TRANSFERENCIA]->(cTo:Cuenta)
      <-[:TIENE_CUENTA]-(pTo:Persona)
RETURN pFrom.nombre AS origen,
       pTo.nombre AS destino,
       t.monto AS monto,
       t.fecha AS fecha,
       t.estado AS estado
ORDER BY t.fecha DESC;

// ----------------------------------------------------------
// Ejemplo 3: Verificación de consistencia
// La suma total siempre debe ser 8000 (5000 + 3000)
// ----------------------------------------------------------
MATCH (p:Persona)-[:TIENE_CUENTA]->(c:Cuenta)
RETURN p.nombre AS titular, c.saldo AS saldo,
       sum(c.saldo) AS total;
// total siempre = 8000 gracias a las garantías ACID

// ----------------------------------------------------------
// Ejemplo 4: Visualizar el grafo completo del banco
// ----------------------------------------------------------
MATCH (p:Persona)-[r1:TIENE_CUENTA]->(c:Cuenta)-[r2:PERTENECE_A]->(b:Banco)
OPTIONAL MATCH (c)-[t:TRANSFERENCIA]->(cDest:Cuenta)
RETURN p, r1, c, r2, b, t, cDest;

// ----------------------------------------------------------
// Ejemplo 5: Rollback — fondos insuficientes
// Ana solo tiene 5000, no puede transferir 50000
// ----------------------------------------------------------
:BEGIN
MATCH (pFrom:Persona {nombre: "Ana"})-[:TIENE_CUENTA]->(cFrom:Cuenta)
WHERE cFrom.saldo >= 50000
SET cFrom.saldo = cFrom.saldo - 50000
// Esta línea nunca se ejecuta porque WHERE falla
MATCH (pTo:Persona {nombre: "Luis"})-[:TIENE_CUENTA]->(cTo:Cuenta)
SET cTo.saldo = cTo.saldo + 50000
:COMMIT
// Resultado: transacción no modifica nada
