// ============================================================
// Ejemplos de transacciones ACID en Neo4j
// Documentación del laboratorio
// ============================================================

// ----------------------------------------------------------
// Ejemplo 1: Transferencia atómica exitosa
// Ambas operaciones se ejecutan dentro de una transacción.
// Si alguna falla, ninguna se aplica.
// ----------------------------------------------------------
:BEGIN
MATCH (a:Cuenta {titular: 'Ana'})
SET a.saldo = a.saldo - 200
WITH a
MATCH (l:Cuenta {titular: 'Luis'})
SET l.saldo = l.saldo + 200
RETURN a.saldo AS ana_nuevo, l.saldo AS luis_nuevo;
:COMMIT

// ----------------------------------------------------------
// Ejemplo 2: Rollback por fondos insuficientes
// Ana solo tiene 1000, no puede transferir 5000.
// La transacción falla y ambos saldos quedan sin cambios.
// ----------------------------------------------------------
:BEGIN
MATCH (a:Cuenta {titular: 'Ana'})
WHERE a.saldo >= 5000
SET a.saldo = a.saldo - 5000
MATCH (l:Cuenta {titular: 'Luis'})
SET l.saldo = l.saldo + 5000
:COMMIT
// Resultado: la transacción falla, saldos intactos

// ----------------------------------------------------------
// Ejemplo 3: Verificación de consistencia
// La suma total siempre debe ser 1500 (1000 + 500)
// ----------------------------------------------------------
MATCH (c:Cuenta)
RETURN c.titular AS titular, c.saldo AS saldo, sum(c.saldo) AS total;
// total siempre = 1500 gracias a las garantías ACID
