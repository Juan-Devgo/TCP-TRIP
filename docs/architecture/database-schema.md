# Schema de Base de Datos — TCP-TRIP (PostgreSQL)

**Versión:** 1.1  
**Fecha:** 2026-04-14  
**Estado:** Aceptado  
**Motiva:** TC-002, TC-004, TC-014, TC-015, TC-016, T-004

---

## 1. Decisiones de Diseño

### 1.1 Motor y acceso
- **Motor:** PostgreSQL 15+
- **Cliente:** `Bun.sql` (tagged template literals nativos de Bun). No se usa ningún ORM.
- **Archivo de conexión:** `src/lib/sql.ts` (reemplaza a `src/lib/db.ts`).

### 1.2 Convenciones de nomenclatura
- Nombres de tablas: `snake_case`, plural (e.g., `protocols`, `messages`, `role_requests`).
- Nombres de columnas: `snake_case` (e.g., `user_id`, `created_at`, `share_code`).
- Primary keys: `uuid` generado por PostgreSQL con `gen_random_uuid()`, excepto en casos donde la PK viene de un sistema externo.
- User IDs: `TEXT NOT NULL` — son strings opacos de Clerk (formato `user_XXXXX`). La base de datos **no genera IDs de usuario**.
- Timestamps: `TIMESTAMPTZ` (con zona horaria). Se almacena siempre en UTC.
- Campos JSON: `JSONB` (indexable, eficiente para búsquedas parciales).
- Booleans: `BOOLEAN` nativo de PostgreSQL.

### 1.3 Integridad referencial
PostgreSQL provee foreign keys reales. Las referencias entre tablas usan `ON DELETE SET NULL` para `protocol_id` en `messages` (el protocolo puede eliminarse sin borrar los mensajes, que tienen snapshot). Las filas de usuarios no existen en la BD; su integridad se garantiza a través de Clerk (TC-003).

---

## 2. Diagrama de Relaciones

```mermaid
erDiagram
    protocols {
        uuid id PK
        text user_id
        text name
        text description
        jsonb fields
        timestamptz created_at
        timestamptz updated_at
        boolean is_public
        text share_code
    }

    messages {
        uuid id PK
        text from_user_id
        text to_user_id
        uuid protocol_id FK
        jsonb header_values
        text payload
        timestamptz created_at
        timestamptz read_at
        jsonb protocol_snapshot
        text from_display_name
        text to_display_name
    }

    users {
        text clerk_user_id PK
        boolean is_banned
        text ban_reason
        timestamptz banned_at
        text banned_by
        timestamptz created_at
    }

    role_requests {
        uuid id PK
        text user_id
        text status
        timestamptz requested_at
        text reviewed_by
        timestamptz reviewed_at
        text comment
    }

    protocols ||--o{ messages : "referencia opcional"
    users ||--o{ role_requests : "solicita"
```

**Nota:** `users` no almacena perfil completo (nombre, email) — esos datos viven en Clerk. `users` solo persiste el estado de control de acceso (baneo) que el middleware necesita verificar en cada request autenticado.

---

## 3. Scripts SQL de Creación de Tablas

### 3.1 Extensiones requeridas

```sql
-- Ejecutar una sola vez al provisionar la base de datos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- provee gen_random_uuid()
```

### 3.2 Tabla `protocols`

```sql
CREATE TABLE IF NOT EXISTS protocols (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  fields       JSONB       NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_public    BOOLEAN     NOT NULL DEFAULT FALSE,
  share_code   TEXT        UNIQUE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_protocols_user_id
  ON protocols (user_id);

CREATE INDEX IF NOT EXISTS idx_protocols_share_code
  ON protocols (share_code)
  WHERE share_code IS NOT NULL;

-- Índice GIN sobre fields para búsquedas por tipo de campo en el futuro
CREATE INDEX IF NOT EXISTS idx_protocols_fields
  ON protocols USING GIN (fields);
```

**Nota (D-06):** No existe migración de datos desde SQLite. El schema de PostgreSQL se crea desde cero. Los datos existentes en `tcp-trip.db` se descartan. No hay script de migración de IDs ni de registros previos.

### 3.3 Tabla `messages`

```sql
CREATE TABLE IF NOT EXISTS messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id      TEXT        NOT NULL,
  to_user_id        TEXT        NOT NULL,
  protocol_id       UUID        REFERENCES protocols(id) ON DELETE SET NULL,
  header_values     JSONB       NOT NULL DEFAULT '{}',
  payload           TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at           TIMESTAMPTZ,
  protocol_snapshot JSONB,
  from_display_name TEXT,
  to_display_name   TEXT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_messages_to_user_id
  ON messages (to_user_id);

CREATE INDEX IF NOT EXISTS idx_messages_from_user_id
  ON messages (from_user_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON messages (created_at DESC);

-- Índice compuesto para contar no leídos (US-024: badge)
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (to_user_id, read_at)
  WHERE read_at IS NULL;
```

**Notas:**
- `protocol_snapshot` es `JSONB NULLABLE`. Almacena una copia inmutable del protocolo en el momento del envío del mensaje. Una vez insertado, no se modifica (TC-015).
- `header_values` es `JSONB`: mapeo `{ [fieldId: string]: string | number | boolean }` con los valores que el remitente completó en cada campo del protocolo.
- Si `protocol_id` se elimina, la columna queda en `NULL` pero el mensaje se preserva íntegro gracias a `protocol_snapshot`.

### 3.4 Tabla `users`

Tabla para control de acceso (baneo). No almacena perfil completo.

```sql
CREATE TABLE IF NOT EXISTS users (
  clerk_user_id  TEXT        PRIMARY KEY,
  is_banned      BOOLEAN     NOT NULL DEFAULT FALSE,
  ban_reason     TEXT,
  banned_at      TIMESTAMPTZ,
  banned_by      TEXT,               -- clerk_user_id del admin que aplicó el baneo
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para la verificación rápida de baneo en el middleware
CREATE INDEX IF NOT EXISTS idx_users_is_banned
  ON users (clerk_user_id)
  WHERE is_banned = TRUE;
```

**Cuándo se crea una fila en `users`:** No en el registro (Clerk lo gestiona). Se crea bajo demanda cuando el middleware necesita registrar un evento de control de acceso: cuando un admin banea a un usuario, o cuando un usuario envía una solicitud de rol docente (también puede crearse allí si aún no existe). Esto evita sincronización activa con Clerk.

**Estrategia de verificación de baneo (TC-013):**
La tabla `users` es pequeña y el índice parcial `WHERE is_banned = TRUE` hace que la consulta de verificación sea O(log n) sobre el subconjunto de baneados. El middleware verifica el baneo en cada request autenticado:

```sql
SELECT is_banned FROM users
WHERE clerk_user_id = $1
LIMIT 1;
```

Si no existe fila, el usuario no está baneado. Si existe y `is_banned = TRUE`, se rechaza el request con 403.

### 3.5 Tabla `role_requests`

Nueva tabla para el flujo de solicitud de rol docente (E-007, E-009).

```sql
CREATE TYPE role_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS role_requests (
  id           UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT                 NOT NULL,
  status       role_request_status  NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  reviewed_by  TEXT,                          -- clerk_user_id del admin
  reviewed_at  TIMESTAMPTZ,
  comment      TEXT                           -- nota del admin al aprobar/rechazar
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_role_requests_user_id
  ON role_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_role_requests_status
  ON role_requests (status)
  WHERE status = 'pending';

-- Restricción: un usuario no puede tener más de una solicitud pending simultánea
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_requests_one_pending_per_user
  ON role_requests (user_id)
  WHERE status = 'pending';
```

**Notas:**
- El índice único parcial `WHERE status = 'pending'` garantiza que un usuario solo puede tener una solicitud pendiente a la vez. Permite múltiples solicitudes históricas (approved/rejected).
- Al aprobar, el middleware actualiza `publicMetadata.role = 'teacher'` en Clerk via la API de Clerk Backend SDK, y luego actualiza `status = 'approved'` en esta tabla. Estas dos operaciones deben tratarse como una transacción lógica: si la actualización en Clerk falla, no se marca como approved en la BD.
- `reviewed_by` y `reviewed_at` garantizan auditoría completa del flujo de aprobación.

---

## 4. Resumen de Tablas

| Tabla | Descripción | Versión |
|-------|-------------|---------|
| `protocols` | Protocolos personalizados creados por usuarios | V1.0 |
| `messages` | Mensajes entre usuarios con snapshot de protocolo | V1.1 |
| `users` | Estado de baneo de usuarios | V2.0 |
| `role_requests` | Solicitudes de rol docente y su estado | V2.0 |

---

## 5. Archivo `src/lib/sql.ts` (reemplaza `db.ts`)

El siguiente es el patrón de implementación que debe seguir el desarrollador al migrar `src/lib/db.ts`:

```typescript
// src/lib/sql.ts
// NO importar better-sqlite3 ni node:path.
// Bun.sql es global en el runtime de Bun — no requiere import.

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Bun.sql usa la variable de entorno DATABASE_URL automáticamente.
// Se puede usar también: const sql = new Bun.SQL(process.env.DATABASE_URL);
export const sql = Bun.sql;

// Ejemplo de uso en una API Route:
// import { sql } from "../../lib/sql";
// const rows = await sql`SELECT * FROM protocols WHERE user_id = ${userId}`;
```

**Variable de entorno requerida:**
```
DATABASE_URL=postgresql://user:password@host:5432/tcptrip
```

---

## 6. Estrategia de Migraciones

Para un proyecto small-team con contexto académico, se adopta **migraciones versionadas como scripts SQL planos** almacenados en `/db/migrations/`:

```
db/
└── migrations/
    ├── 001_initial_schema.sql      -- Crea todas las tablas del esquema inicial
    ├── 002_add_users_table.sql     -- Agrega tabla users (V2.0)
    └── 003_add_role_requests.sql   -- Agrega tabla role_requests (V2.0)
```

**Procedimiento de migración:**
1. El desarrollador ejecuta el script manualmente contra la instancia de PostgreSQL objetivo.
2. No se usa herramienta de migración automática (Flyway, Liquibase, Drizzle Kit) en V1.0–V2.0 para mantener simplicidad.
3. Cada script es idempotente: usa `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE TYPE IF NOT EXISTS`.

---

## 7. Preguntas Abiertas con Impacto en el Schema

| ID | Pregunta | Impacto en BD |
|----|----------|---------------|
| Q-004 | ¿Los ejercicios (V2.0) son corregidos automáticamente? | Si sí, requiere nuevas tablas `exercises` y `exercise_submissions`. Diseño pendiente para V2.0. |

---

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-04-14 | Versión inicial — schema PostgreSQL |
| 1.1 | 2026-04-14 | D-06: eliminación de notas de migración desde SQLite. El schema se crea desde cero sin migración de datos. Q-006 resuelta (ver ADR-006). |
