# Notas para la Presentación (10 minutos)

## Estructura sugerida

### 1. Introducción (2 min)
- Qué es ACID: Atomicity, Consistency, Isolation, Durability
- Qué es BASE: Basically Available, Soft state, Eventually consistent
- Por qué importa: diferentes necesidades → diferentes modelos
- Neo4j como ejemplo de sistema ACID (grafo transaccional)

### 2. Demo de la arquitectura (1 min)
- Mostrar el diagrama: Frontend → Backend → Neo4j / Simulador
- ACID usa transacciones REALES de Neo4j AuraDB
- BASE es simulado con 3 réplicas en memoria y delays artificiales para hacer visible el comportamiento

### 3. Escenario 1: Transferencia Normal (1.5 min)
- Hacer clic en el botón verde
- Señalar: ACID actualiza todo al instante (atómico)
- Señalar: BASE actualiza el primario y luego los secundarios uno por uno
- Punto clave: Ambos llegan al mismo resultado, pero BASE toma más tiempo

### 4. Escenario 2: Crash a Mitad (2 min) — EL MÁS IMPORTANTE
- Hacer clic en el botón rojo
- ACID: señalar el log — debitó, crasheó, ROLLBACK. Saldos iguales, total = 1500
- BASE: señalar que el primario cambió pero los secundarios no. Totales diferentes entre réplicas
- Punto clave: ACID sacrifica disponibilidad por consistencia; BASE sacrifica consistencia por disponibilidad

### 5. Escenario 3: Lecturas Concurrentes (1.5 min)
- Hacer clic en el botón azul
- ACID: la lectura concurrente siempre ve un estado consistente (aislamiento)
- BASE: la lectura de un secundario puede ver datos viejos (stale read)
- Punto clave: Aislamiento vs disponibilidad

### 6. Escenario 4: Partición de Red (1.5 min)
- Hacer clic en el botón naranja
- Mostrar el nodo desconectado (gris)
- La transferencia se ejecuta pero node-3 no la recibe
- A los 6 segundos se reconecta y sincroniza
- Señalar el diagrama CAP: ACID = CP, BASE = AP

### 7. Conclusión (0.5 min)
- No hay un modelo "mejor" — depende del caso de uso
- Bancos, inventario → ACID
- Redes sociales, streaming, IoT → BASE
- Neo4j ofrece garantías ACID completas como base de datos de grafos

## Tips para la demo
- Hacer RESET antes de cada escenario
- Hablar pausado mientras las animaciones corren
- Señalar los colores: verde = consistente, amarillo = propagando, rojo = inconsistente
- Si Neo4j no conecta, igual funciona el lado BASE — mencionarlo como resiliencia
