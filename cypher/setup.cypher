// ============================================================
// Setup: Modelo de grafo bancario completo
// Este script se ejecuta automáticamente al iniciar el backend
// ============================================================

// Constraints de unicidad
CREATE CONSTRAINT cuenta_numero_unique IF NOT EXISTS
FOR (c:Cuenta) REQUIRE c.numero IS UNIQUE;

CREATE CONSTRAINT persona_nombre_unique IF NOT EXISTS
FOR (p:Persona) REQUIRE p.nombre IS UNIQUE;

// Limpiar datos anteriores
MATCH (n) DETACH DELETE n;

// Crear el banco
CREATE (:Banco {nombre: "Bank of Neo4j", fundado: date("2026-01-15")});

// Crear persona Ana con su cuenta
MATCH (b:Banco {nombre: "Bank of Neo4j"})
CREATE (ana:Persona {nombre: "Ana", email: "ana@uvg.edu.gt"})
CREATE (cAna:Cuenta {numero: "C-001", saldo: 5000, tipo: "Ahorro", creada: datetime()})
CREATE (ana)-[:TIENE_CUENTA {desde: date("2026-01-20")}]->(cAna)
CREATE (cAna)-[:PERTENECE_A]->(b);

// Crear persona Luis con su cuenta
MATCH (b:Banco {nombre: "Bank of Neo4j"})
CREATE (luis:Persona {nombre: "Luis", email: "luis@uvg.edu.gt"})
CREATE (cLuis:Cuenta {numero: "C-002", saldo: 3000, tipo: "Ahorro", creada: datetime()})
CREATE (luis)-[:TIENE_CUENTA {desde: date("2026-02-10")}]->(cLuis)
CREATE (cLuis)-[:PERTENECE_A]->(b);

// Verificar el grafo completo
MATCH (p:Persona)-[:TIENE_CUENTA]->(c:Cuenta)-[:PERTENECE_A]->(b:Banco)
RETURN p.nombre AS persona, c.numero AS cuenta, c.saldo AS saldo, b.nombre AS banco
ORDER BY p.nombre;
// Total esperado: 8000
