// ============================================================
// Setup: Limpieza y creación de cuentas iniciales
// Este script se ejecuta automáticamente al iniciar el backend
// ============================================================

// Crear constraint de unicidad (idempotente)
CREATE CONSTRAINT cuenta_titular_unique IF NOT EXISTS
FOR (c:Cuenta) REQUIRE c.titular IS UNIQUE;

// Eliminar datos anteriores
MATCH (n:Cuenta) DETACH DELETE n;

// Crear cuentas iniciales
CREATE (:Cuenta {titular: 'Ana', saldo: 1000});
CREATE (:Cuenta {titular: 'Luis', saldo: 500});

// Verificar
MATCH (c:Cuenta)
RETURN c.titular AS titular, c.saldo AS saldo
ORDER BY c.titular;
