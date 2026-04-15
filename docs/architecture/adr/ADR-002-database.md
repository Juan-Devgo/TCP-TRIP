# ADR-002: PostgreSQL con Bun.sql como base de datos principal

**Estado:** Aceptado  
**Fecha:** 2026-04-14  
**Deciders:** Equipo TCP-TRIP  
**Reemplaza:** Decisión inicial de usar SQLite con `better-sqlite3`  
**Motiva:** TC-002, TC-004, T-004, Q-001 (resuelta)

---

## Contexto

La implementación inicial del proyecto usó SQLite a través de `better-sqlite3` con un archivo local `tcp-trip.db`. Esta elección fue pragmática para el arranque rápido, pero presenta las siguientes limitaciones:

1. **Concurrencia limitada:** SQLite tiene un modelo de escritura de un único writer. Aunque el volumen actual es bajo, el sistema operará en un servidor compartido con múltiples requests concurrentes.
2. **Tipos de datos limitados:** SQLite no tiene `JSONB` nativo, `UUID`, `TIMESTAMPTZ`, ni tipos enum. Los campos de protocolo (almacenados como JSON) se guardan como `TEXT`, perdiendo capacidad de indexación y validación.
3. **No escalable a V3.0:** Si el proyecto continúa post-grado (AS-006), una migración de SQLite a PostgreSQL sería más costosa que hacerla ahora.
4. **`better-sqlite3` usa binarios nativos de Node.js:** No es compatible nativamente con el runtime de Bun. Requiere `@types/better-sqlite3` y puede tener problemas de compilación de addon nativo en diferentes entornos.
5. **`Bun.sql` es el cliente PostgreSQL nativo de Bun:** Su uso elimina la dependencia de `pg`, `postgres.js` u otros clientes externos, manteniendo el stack alineado con el runtime elegido.

La migración a PostgreSQL con `Bun.sql` fue resuelta como decisión arquitectónica en la versión 1.1 de la documentación de producto (Q-001 resuelta, 2026-04-14).

---

## Decisión

Se migra la base de datos a **PostgreSQL 15+**, accedido exclusivamente mediante **`Bun.sql`** (tagged template literals nativos de Bun). 

- El archivo `src/lib/db.ts` se depreca y reemplaza por `src/lib/sql.ts`.
- `better-sqlite3` y `@types/better-sqlite3` se eliminan de `package.json`.
- El archivo `tcp-trip.db` se elimina del repositorio y se agrega a `.gitignore`.
- No se usa ningún ORM (Drizzle, Prisma, TypeORM). Las queries son SQL plano via `Bun.sql`.
- Las migraciones se gestionan como scripts SQL versionados en `/db/migrations/`.

**Proveedor para desarrollo local:** PostgreSQL local (Docker o instalación directa).  
**Proveedor para producción:** Por definir (Q-006). Candidatos: Supabase, Railway, Neon, autoalojado.

---

## Consecuencias

### Positivas

- **Tipos de datos ricos:** `JSONB` para los campos de protocolo y snapshots de mensajes permite índices GIN para búsquedas futuras, validación de estructura JSON en BD y mayor eficiencia de almacenamiento vs. `TEXT`.
- **UUIDs nativos:** `gen_random_uuid()` elimina la función `generateId()` con `Math.random()` que tiene riesgo teórico de colisión (TC-016).
- **`TIMESTAMPTZ`:** Las fechas se almacenan con zona horaria, eliminando ambigüedades de UTC vs. local.
- **Concurrencia real:** PostgreSQL soporta múltiples writers concurrentes sin degradación. El MVCC de PostgreSQL gestiona el aislamiento de transacciones.
- **Constraints y foreign keys reales:** La integridad referencial entre `messages.protocol_id` y `protocols.id` es garantizada por la BD, no por la lógica de la aplicación.
- **Enum de PostgreSQL:** `role_request_status` se define como tipo enum nativo, no como `TEXT` con validación en aplicación.
- **Stack alineado:** `Bun.sql` es una API nativa de Bun. No hay dependencia de adaptadores Node.js.

### Negativas / Trade-offs

- **Requiere instancia PostgreSQL en desarrollo:** El desarrollador necesita una instancia PostgreSQL local (Docker o instalada). SQLite era "zero config". Se mitiga documentando el setup de desarrollo.
- **Sin ORM:** Las queries son SQL plano. Más verboso que un ORM pero totalmente transparente. El equipo conoce SQL suficiente para el alcance del proyecto (PR-002). Si la complejidad de queries crece, se puede evaluar un query builder como `kysely` en V2.0.
- **Migración de datos existentes:** Los IDs actuales en SQLite no son UUIDs. La migración de datos de desarrollo (si existe data de prueba) requiere un script de transformación.
- **`Bun.sql` es relativamente nuevo:** La API de `Bun.sql` fue introducida en Bun 1.x. Hay menos documentación y ejemplos que para `pg` o `postgres.js`. Si se encuentra un bug de `Bun.sql`, el workaround puede ser complejo.

### Riesgos

- **R-001 (del PO doc):** La migración puede ser más compleja de lo esperado. Mitigación: realizar T-004 como primera tarea técnica de V1.0, antes de añadir nueva funcionalidad. Validar con un CRUD simple de protocolo antes de migrar todas las tablas.
- **`@astrojs/node` + `Bun.sql`:** Verificar que `Bun.sql` funciona correctamente cuando es invocado desde handlers de API Routes de Astro bajo el adaptador `@astrojs/node`. Si hay incompatibilidad, el fallback es usar el cliente `postgres` de npm que funciona en entornos Node.js/Bun.

---

## Alternativas Evaluadas

| Alternativa | Razón de descarte |
|-------------|-------------------|
| SQLite con `bun:sqlite` | Mantiene los problemas de tipos de datos y concurrencia. `bun:sqlite` no provee `JSONB` ni UUIDs. La arquitectura del proyecto asume PostgreSQL. |
| PostgreSQL con ORM (Drizzle, Prisma) | Los ORMs añaden una capa de abstracción que requiere aprendizaje adicional y puede ocultar problemas de rendimiento. Para el volumen esperado y el equipo small, SQL plano es más predecible. Drizzle puede evaluarse en V2.0 si la complejidad de queries lo justifica. |
| PostgreSQL con `pg` (node-postgres) | Válido, pero `Bun.sql` es el cliente nativo de Bun y elimina una dependencia externa. `pg` usa callbacks y su API de tagged templates no es tan ergonómica. |
| MongoDB | El modelo de datos de TCP-TRIP (protocolos con campos, mensajes con snapshot, solicitudes de rol) es relacional. No hay variabilidad de esquema que justifique un documento store. |
