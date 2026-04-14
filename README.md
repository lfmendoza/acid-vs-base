# The Bank of Neo4j — ACID vs BASE

Demostración interactiva que compara los modelos de consistencia **ACID** (usando transacciones reales de Neo4j) y **BASE** (simulado con réplicas en memoria) lado a lado.

## Equipo

| Nombre | Carné |
|---|---|
| Nicolás Concuá | 23197 |
| Fernando Mendoza | 19644 |
| June Herrera | 231038 |

**Curso:** CC3089 — Base de Datos II, Universidad del Valle de Guatemala, Semestre I 2026

**Tema:** ACID vs BASE — Modelos de Consistencia de Datos

---

## Arquitectura

```
Frontend (React + Vite)  →  Backend (Express REST API)  →  Neo4j AuraDB (ACID)
                                                         →  Simulador en memoria (BASE)
```

```
acid-vs-base/
├── README.md
├── .env.example
├── .gitignore
├── backend/
│   ├── package.json
│   ├── server.js           ← API REST (Express)
│   ├── neo4j-client.js     ← Conexión y seed automático de Neo4j
│   ├── base-simulator.js   ← Simulador BASE con 3 réplicas
│   └── scenarios.js        ← Documentación de escenarios
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js
│       └── components/
│           ├── SplitView.jsx
│           ├── ACIDPanel.jsx
│           ├── BASEPanel.jsx
│           ├── ScenarioPanel.jsx
│           ├── TransactionLog.jsx
│           ├── AccountNode.jsx
│           └── CAPIndicator.jsx
├── cypher/
│   ├── setup.cypher
│   └── transactions.cypher
└── docs/
    └── presentation-notes.md
```

---

## Prerrequisitos

- **Node.js 18+** ([descargar](https://nodejs.org/))
- Una instancia de **Neo4j AuraDB** (el tier gratuito funciona perfecto)

---

## Configuración de Neo4j AuraDB

Si no tienes una instancia de AuraDB, sigue estos pasos:

1. Ir a [https://console.neo4j.io](https://console.neo4j.io) e iniciar sesión (funciona con cuenta de Google o GitHub)
2. Hacer clic en **"New Instance"** (o **"Create Free Instance"** si es la primera vez)
3. Seleccionar **AuraDB Free** (no requiere tarjeta de crédito)
4. Configuración de la instancia:
   - **Instance Name:** `acid-vs-base-demo` (o cualquier nombre)
   - **Region:** la más cercana disponible
   - **Starting dataset:** "Empty" (la aplicación crea los datos automáticamente)
5. Hacer clic en **"Create"** y **guardar inmediatamente la contraseña generada** — solo se muestra una vez
6. Esperar ~60 segundos hasta que la instancia esté en estado "Running"
7. Desde la página de detalles de la instancia, copiar la **Connection URI** (tiene el formato `neo4j+s://xxxxxxxx.databases.neo4j.io`)

---

## Instalación y Ejecución

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd acid-vs-base
```

### 2. Configurar credenciales

```bash
cp .env.example .env
```

Editar `.env` con las credenciales de AuraDB:

```
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=tu-contraseña
PORT=3001
```

### 3. Instalar e iniciar el backend

```bash
cd backend
npm install
npm start
```

Al iniciar, el backend automáticamente:
- Verifica la conexión con AuraDB
- Crea el constraint de unicidad en nodos `Cuenta`
- Elimina datos previos y crea las cuentas iniciales (Ana=1000, Luis=500)
- Muestra un log de confirmación

### 4. Instalar e iniciar el frontend (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

### 5. Abrir la aplicación

Ir a [http://localhost:5173](http://localhost:5173)

---

## Uso — Escenarios Interactivos

La aplicación tiene 4 escenarios que se ejecutan simultáneamente en ambos sistemas:

### 1. Transferencia Normal (verde)
Transfiere Q200 de Ana a Luis. **ACID** lo hace atómicamente; **BASE** actualiza el primario de inmediato y los secundarios convergen en 2-4 segundos.

### 2. Crash a Mitad (rojo)
Simula un fallo después de debitar pero antes de acreditar. **ACID** hace rollback automático (saldos sin cambios); **BASE** queda con el primario actualizado pero secundarios desactualizados.

### 3. Lecturas Concurrentes (azul)
Lee saldos durante una transferencia en vuelo. **ACID** garantiza aislamiento (lectura consistente); **BASE** puede devolver datos desactualizados de un secundario.

### 4. Partición de Red (naranja)
Desconecta un nodo secundario y ejecuta una transferencia. El nodo desconectado no recibe la actualización. Al reconectarse (6 segundos después), se sincroniza con el primario.

---

## Ejemplos Cypher

### Transferencia atómica

```cypher
:BEGIN
MATCH (a:Cuenta {titular: 'Ana'})
SET a.saldo = a.saldo - 200
WITH a
MATCH (l:Cuenta {titular: 'Luis'})
SET l.saldo = l.saldo + 200
RETURN a.saldo AS ana_nuevo, l.saldo AS luis_nuevo;
:COMMIT
```

### Verificación de consistencia

```cypher
MATCH (c:Cuenta)
RETURN c.titular AS titular, c.saldo AS saldo, sum(c.saldo) AS total;
-- total siempre = 1500
```

---

## Referencias

- Neo4j Documentation — [Transactions](https://neo4j.com/docs/getting-started/appendix/graphdb-concepts/#graphdb-concepts-tx)
- Neo4j JavaScript Driver — [API Reference](https://neo4j.com/docs/javascript-manual/current/)
- Brewer, E. (2000). *Towards Robust Distributed Systems* (CAP Theorem)
- Pritchett, D. (2008). *BASE: An Acid Alternative*, ACM Queue
