# Contratos de API — TCP-TRIP

**Versión:** 1.1  
**Fecha:** 2026-04-14  
**Estado:** Aceptado  
**Convención base:** REST sobre HTTP. Todas las rutas bajo `/api/`. Respuestas en JSON.

---

## Convenciones Generales

### Autenticación
Todas las rutas protegidas usan la sesión de Clerk verificada en el middleware de Astro. El cliente no envía tokens manualmente; Clerk gestiona las cookies de sesión.

**Niveles de acceso:**
- `public` — Cualquier visitante, sin autenticación.
- `authenticated` — Usuario con sesión activa de Clerk.
- `teacher` — Usuario con `publicMetadata.role === 'teacher'` en Clerk.
- `admin` — Usuario con `publicMetadata.role === 'admin'` en Clerk (o `ADMIN_USER_ID` env var).

### Formato de errores

Todos los errores siguen esta estructura:

```typescript
interface ApiError {
  error: string;       // Mensaje legible por el desarrollador
  code?: string;       // Código de error interno opcional (e.g., "PROTOCOL_NOT_FOUND")
}
```

### Códigos de estado HTTP usados

| Código | Significado |
|--------|-------------|
| 200 | OK — operación exitosa con cuerpo de respuesta |
| 201 | Created — recurso creado exitosamente |
| 204 | No Content — operación exitosa sin cuerpo |
| 400 | Bad Request — parámetros o body inválidos |
| 401 | Unauthorized — sin sesión activa |
| 403 | Forbidden — sesión activa pero sin permisos suficientes |
| 404 | Not Found — recurso no encontrado o no pertenece al usuario |
| 409 | Conflict — violación de unicidad (e.g., ya existe solicitud pendiente) |
| 500 | Internal Server Error — error inesperado del servidor |

---

## Dominio: Protocols (E-003)

### `GET /api/protocols`

Lista todos los protocolos del usuario autenticado.

**Acceso:** `authenticated`

**Query params:** ninguno

**Response 200:**
```typescript
interface ProtocolListItem {
  id: string;           // UUID
  name: string;
  description: string;
  fields: ProtocolField[];
  createdAt: string;    // ISO 8601 UTC
  updatedAt: string;    // ISO 8601 UTC
  isPublic: boolean;
  shareCode: string | null;
}

type Response = ProtocolListItem[];
```

**Errores posibles:** 401

---

### `POST /api/protocols`

Crea un nuevo protocolo para el usuario autenticado.

**Acceso:** `authenticated`

**Request body:**
```typescript
interface CreateProtocolBody {
  name: string;           // Requerido. Max 100 caracteres.
  description?: string;   // Opcional. Max 500 caracteres.
  fields: ProtocolField[]; // Requerido. Array puede ser vacío [].
}
```

**Response 201:**
```typescript
interface CreateProtocolResponse {
  id: string;
  name: string;
  description: string;
  fields: ProtocolField[];
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  shareCode: null;
}
```

**Errores posibles:** 400 (name o fields ausentes), 401

---

### `GET /api/protocols/[id]`

Obtiene un protocolo específico del usuario autenticado.

**Acceso:** `authenticated` (solo el dueño puede acceder a sus propios protocolos por ID)

**Path params:** `id` — UUID del protocolo

**Response 200:**
```typescript
interface ProtocolDetail {
  id: string;
  name: string;
  description: string;
  fields: ProtocolField[];
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  shareCode: string | null;
}
```

**Errores posibles:** 401, 403 (el protocolo existe pero pertenece a otro usuario), 404 (no encontrado)

---

### `PUT /api/protocols/[id]`

Actualiza un protocolo existente del usuario autenticado.

**Acceso:** `authenticated` (solo el dueño)

**Path params:** `id` — UUID del protocolo

**Request body:**
```typescript
interface UpdateProtocolBody {
  name: string;
  description?: string;
  fields: ProtocolField[];
}
```

**Response 200:**
```typescript
interface UpdateProtocolResponse {
  ok: true;
  updatedAt: string;
}
```

**Errores posibles:** 400, 401, 403 (el protocolo existe pero pertenece a otro usuario), 404

---

### `DELETE /api/protocols/[id]`

Elimina un protocolo del usuario autenticado.

**Acceso:** `authenticated` (solo el dueño)

**Path params:** `id` — UUID del protocolo

**Response 200:**
```typescript
interface DeleteProtocolResponse {
  ok: true;
}
```

**Errores posibles:** 401, 403 (el protocolo existe pero pertenece a otro usuario), 404

**Nota:** Si el protocolo tiene mensajes asociados, `messages.protocol_id` se pondrá a `NULL` automáticamente (ON DELETE SET NULL). Los mensajes y sus `protocol_snapshot` se preservan.

---

### `POST /api/protocols/[id]/share`

Genera o regenera el `share_code` de un protocolo y lo marca como público.

**Acceso:** `authenticated` (solo el dueño)

**Path params:** `id` — UUID del protocolo

**Request body:** vacío `{}`

**Response 200:**
```typescript
interface ShareProtocolResponse {
  shareCode: string;   // Código único alfanumérico (8-12 chars)
  shareUrl: string;    // URL completa: /protocols/[shareCode]
}
```

**Errores posibles:** 401, 403 (el protocolo existe pero pertenece a otro usuario), 404

**Implementación del `share_code`:** usar `crypto.randomUUID().slice(0, 8)` o similar. Verificar unicidad contra la BD antes de insertar.

---

### `GET /api/protocols/shared/[shareCode]`

Obtiene un protocolo compartido por su código único. Acceso público.

**Acceso:** `public`

**Path params:** `shareCode` — código de compartición

**Response 200:**
```typescript
interface SharedProtocolResponse {
  id: string;
  name: string;
  description: string;
  fields: ProtocolField[];
  createdAt: string;
  shareCode: string;
}
```

**Errores posibles:** 404 (no existe o no es público)

---

## Dominio: Messages (E-004)

### `GET /api/messages`

Obtiene la bandeja de entrada o enviados del usuario autenticado.

**Acceso:** `authenticated`

**Query params:**
```
box: "inbox" | "sent"   — Por defecto "inbox"
```

**Response 200:**
```typescript
interface MessageItem {
  id: string;
  fromUserId: string;
  toUserId: string;
  protocolId: string | null;
  headerValues: Record<string, string | number | boolean>;
  payload: string;
  createdAt: string;
  readAt: string | null;
  protocolSnapshot: ProtocolSnapshot | null;
  fromDisplayName: string | null;
  toDisplayName: string | null;
}

interface ProtocolSnapshot {
  id: string;
  name: string;
  description: string;
  fields: ProtocolField[];
}

type Response = MessageItem[];
```

**Errores posibles:** 401

---

### `POST /api/messages`

Envía un nuevo mensaje a otro usuario.

**Acceso:** `authenticated`

**Request body:**
```typescript
interface SendMessageBody {
  toUserId: string;                                            // Requerido. Clerk user ID del destinatario.
  protocolId?: string;                                        // Opcional. UUID del protocolo usado.
  headerValues: Record<string, string | number | boolean>;    // Requerido. Valores de los campos del encabezado.
  payload?: string;                                           // Opcional. Texto libre del mensaje.
  protocolSnapshot?: ProtocolSnapshot;                        // Recomendado. Snapshot del protocolo al momento del envío.
  fromDisplayName?: string;                                   // Nombre visible del remitente.
  toDisplayName?: string;                                     // Nombre visible del destinatario.
}
```

**Response 201:**
```typescript
interface SendMessageResponse {
  id: string;
  createdAt: string;
}
```

**Errores posibles:** 400 (toUserId o headerValues ausentes), 401

**Validaciones de negocio a implementar (T-005):**
- El `toUserId` debe ser distinto al `userId` del remitente (no se puede enviar mensajes a uno mismo).
- Si se provee `protocolId`, verificar que el protocolo existe (no necesariamente del remitente — puede ser un protocolo compartido).

---

### `PUT /api/messages/[id]/read`

Marca un mensaje como leído.

**Acceso:** `authenticated` (solo el destinatario puede marcar como leído)

**Path params:** `id` — UUID del mensaje

**Request body:** vacío `{}`

**Response 200:**
```typescript
interface MarkReadResponse {
  ok: true;
  readAt: string;
}
```

**Errores posibles:** 401, 403 (no es el destinatario), 404

---

### `GET /api/messages/unread-count` *(nuevo — US-024)*

Retorna el conteo de mensajes no leídos del usuario. Usado para el badge en Navbar.

**Acceso:** `authenticated`

**Response 200:**
```typescript
interface UnreadCountResponse {
  count: number;
}
```

**Errores posibles:** 401

**Implementación sugerida:**
```sql
SELECT COUNT(*) FROM messages
WHERE to_user_id = $1 AND read_at IS NULL;
```

**Nota:** El cliente debe hacer polling periódico (cada 60 segundos) a este endpoint para actualizar el badge. No existe WebSocket hasta V3.0 (TC-017).

---

## Dominio: Users (E-004, E-009)

### `GET /api/users/search`

Busca usuarios por email para seleccionar destinatario en la composición de mensajes.

**Acceso:** `authenticated`

**Query params:**
```
q: string   — Requerido. Mínimo 3 caracteres. Email o nombre parcial.
```

**Response 200:**
```typescript
interface UserSearchResult {
  id: string;           // Clerk user ID
  displayName: string;
  email: string;
  imageUrl: string;
}

interface UserSearchResponse {
  users: UserSearchResult[];
}
```

**Errores posibles:** 401

**Restricción (TC-009):** Implementar debounce de mínimo 500ms en el cliente antes de llamar a este endpoint. La API de Clerk tiene rate limits.

---

## Dominio: Admin (E-009) — V2.0

Todas las rutas `/api/admin/*` requieren acceso `admin`. El middleware verifica el rol antes de que el handler se ejecute. Cualquier acceso sin rol `admin` devuelve 403.

---

### `GET /api/admin/users`

Lista todos los usuarios registrados en la plataforma.

**Acceso:** `admin`

**Query params:**
```
page?: number      — Número de página. Default 1.
limit?: number     — Resultados por página. Default 20. Máximo 100.
search?: string    — Búsqueda por email o nombre (via Clerk API).
```

**Response 200:**
```typescript
interface AdminUserItem {
  clerkUserId: string;
  displayName: string;
  email: string;
  imageUrl: string;
  role: "student" | "teacher" | "admin";
  isBanned: boolean;
  createdAt: string;    // Fecha de registro en Clerk
  protocolCount: number;
}

interface AdminUserListResponse {
  users: AdminUserItem[];
  total: number;
  page: number;
  limit: number;
}
```

**Errores posibles:** 401, 403

**Implementación:** Combina datos de Clerk (lista de usuarios via `clerkClient.users.getUserList()`) con datos de PostgreSQL (conteo de protocolos, estado de baneo). Join en memoria dado el volumen bajo esperado (AS-007).

---

### `POST /api/admin/users/[userId]/ban`

Banea a un usuario de la plataforma.

**Acceso:** `admin`

**Path params:** `userId` — Clerk user ID

**Request body:**
```typescript
interface BanUserBody {
  reason?: string;   // Motivo del baneo. Opcional pero recomendado.
}
```

**Response 200:**
```typescript
interface BanUserResponse {
  ok: true;
  bannedAt: string;
}
```

**Errores posibles:** 400, 401, 403, 404

**Comportamiento:** Inserta o actualiza la fila en `users` con `is_banned = true`. El middleware de Astro bloqueará el acceso del usuario baneado en el próximo request.

---

### `POST /api/admin/users/[userId]/unban`

Desbanea a un usuario previamente baneado.

**Acceso:** `admin`

**Path params:** `userId` — Clerk user ID

**Request body:** vacío `{}`

**Response 200:**
```typescript
interface UnbanUserResponse {
  ok: true;
}
```

**Errores posibles:** 401, 403, 404

---

### `GET /api/admin/role-requests`

Lista las solicitudes de rol docente.

**Acceso:** `admin`

**Query params:**
```
status?: "pending" | "approved" | "rejected"   — Filtrar por estado. Default "pending".
```

**Response 200:**
```typescript
interface RoleRequestItem {
  id: string;          // UUID de la solicitud
  userId: string;      // Clerk user ID del solicitante
  displayName: string; // Nombre del solicitante (desde Clerk)
  email: string;       // Email del solicitante (desde Clerk)
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  comment: string | null;
}

type Response = RoleRequestItem[];
```

**Errores posibles:** 401, 403

---

### `POST /api/admin/role-requests/[id]/approve`

Aprueba una solicitud de rol docente.

**Acceso:** `admin`

**Path params:** `id` — UUID de la solicitud

**Request body:**
```typescript
interface ApproveRoleRequestBody {
  comment?: string;   // Mensaje opcional para el solicitante
}
```

**Response 200:**
```typescript
interface ApproveRoleRequestResponse {
  ok: true;
  reviewedAt: string;
}
```

**Errores posibles:** 400 (solicitud no está en estado pending), 401, 403, 404, 500 (fallo en Clerk o BD tras reintentos)

**Flujo de aprobación con resiliencia (TC-012, D-02 — ADR-007):**

1. Verificar que `role_requests.status === 'pending'`. Si no, retornar 400.
2. Actualizar `publicMetadata.role = 'teacher'` en Clerk via `clerkClient.users.updateUserMetadata()`.
   - Si Clerk falla: retornar 500 inmediatamente. No modificar la BD.
3. Si Clerk responde exitosamente, intentar actualizar `role_requests` con `status = 'approved'`, `reviewed_by`, `reviewed_at`, `comment`.
   - Si la escritura en BD falla: reintentar con **backoff exponencial** (máximo 3 intentos: 100ms, 200ms, 400ms).
   - Si los 3 reintentos fallan: registrar el error en el log del servidor con el `userId` y el `requestId`. Retornar 500 al cliente admin (el rol ya fue asignado en Clerk; el mecanismo de reconciliación al inicio del servidor lo resolverá).
4. Si paso 3 exitoso: enviar email de notificación al usuario via Clerk (D-05). El fallo del email **no revierte** la aprobación; se registra como warning en el log.
5. Retornar 200.

**Implementación del retry con backoff exponencial:**

```typescript
// src/shared/lib/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise(resolve =>
          setTimeout(resolve, baseDelayMs * Math.pow(2, attempt - 1))
        );
      }
    }
  }
  throw lastError;
}

// Uso en el handler:
await withRetry(() => sql`
  UPDATE role_requests
  SET status = 'approved', reviewed_by = ${adminId},
      reviewed_at = NOW(), comment = ${comment}
  WHERE id = ${requestId}
`);
```

**Nota de email (D-05):** La notificación al usuario se envía via `clerkClient.emails.createEmail()` después de la aprobación exitosa. Ver sección "Notificación de Email via Clerk" más adelante en este documento.

---

### `POST /api/admin/role-requests/[id]/reject`

Rechaza una solicitud de rol docente.

**Acceso:** `admin`

**Path params:** `id` — UUID de la solicitud

**Request body:**
```typescript
interface RejectRoleRequestBody {
  comment?: string;   // Motivo del rechazo. Recomendado para informar al solicitante.
}
```

**Response 200:**
```typescript
interface RejectRoleRequestResponse {
  ok: true;
  reviewedAt: string;
}
```

**Errores posibles:** 400 (solicitud no está en estado pending), 401, 403, 404

---

### `GET /api/admin/stats`

Métricas básicas de la plataforma para el dashboard del admin (US-029).

**Acceso:** `admin`

**Response 200:**
```typescript
interface AdminStatsResponse {
  totalProtocols: number;
  totalMessages: number;
  pendingRoleRequests: number;
  bannedUsers: number;
  // Nota: totalUsers requiere llamar a Clerk API y puede omitirse
  // en implementaciones iniciales para evitar latencia adicional.
}
```

**Errores posibles:** 401, 403

---

## Dominio: Auth / Roles (E-007) — V2.0

### `POST /api/roles/request-teacher`

Crea una solicitud de rol docente para el usuario autenticado.

**Acceso:** `authenticated`

**Request body:** vacío `{}`

**Response 201:**
```typescript
interface RoleRequestCreatedResponse {
  id: string;           // UUID de la solicitud creada
  status: "pending";
  requestedAt: string;
}
```

**Errores posibles:**
- 401 — sin sesión
- 409 — ya existe una solicitud pendiente para este usuario (restricción de unicidad en BD)
- 400 — el usuario ya tiene el rol `teacher` o `admin`

**Implementación:** Verificar que el usuario no tenga ya el rol y que no exista una solicitud `pending` activa. Insertar en `role_requests`.

---

## Tipos Compartidos (referencia)

Estos tipos se referencian en múltiples endpoints. Definidos en `src/types/ProtocolBuilder.ts`.

```typescript
type FieldType = 'uint' | 'flags' | 'ascii' | 'hex' | 'ipv4' | 'enum' | 'padding' | 'composite';

interface ProtocolField {
  id: string;
  name: string;
  type: FieldType;
  sizeBytes: number;
  sizeBits?: number;
  meaning: string;
  docLinks?: { label: string; url: string }[];
  uintValue?: number;
  flagBits?: { name: string; value: boolean; reserved: boolean }[];
  asciiValue?: string;
  asciiFixedSize?: boolean;
  hexValue?: string;
  ipv4Value?: [number, number, number, number];
  enumOptions?: { value: number; label: string }[];
  enumSelected?: number;
  paddingByte?: number;
  subFields?: SubField[];
}

interface SubField {
  id: string;
  name: string;
  type: 'uint' | 'flags' | 'ascii' | 'hex' | 'padding' | 'enum';
  sizeBits: number;
  meaning: string;
}
```

---

## Notificación de Email via Clerk (D-05)

TCP-TRIP utiliza la API de emails de Clerk para notificar a los usuarios sobre el resultado de su solicitud de rol docente. No se usa un servicio SMTP externo.

### Restricciones del servicio de email de Clerk

- Solo se pueden enviar emails a usuarios que estén **registrados en Clerk** para la instancia de la aplicación.
- No es posible enviar emails a direcciones arbitrarias. El `toUserId` debe ser un `userId` de Clerk válido.
- El servicio de emails de Clerk está disponible en el plan gratuito para volúmenes bajos (contexto académico — AS-007, AS-008).

### Dónde se usa el email

| Evento | Destinatario | Cuándo se envía |
|--------|-------------|-----------------|
| Solicitud de rol docente aprobada | El usuario solicitante | Dentro del handler `POST /api/admin/role-requests/[id]/approve`, después de la actualización exitosa en BD |
| Solicitud de rol docente rechazada | El usuario solicitante | Dentro del handler `POST /api/admin/role-requests/[id]/reject`, después de la actualización en BD |

### Patrón de implementación

```typescript
// Notificación de aprobación (dentro del handler de /approve)
// Se ejecuta DESPUÉS de que Clerk y la BD han sido actualizados exitosamente.
try {
  await clerkClient.emails.createEmail({
    fromEmailName: "tcp-trip",
    subject: "Tu solicitud de rol Docente ha sido aprobada",
    body: `Hola ${displayName},\n\nTu solicitud de rol docente en TCP-TRIP ha sido aprobada. La próxima vez que inicies sesión, tendrás acceso al Modo Clase.`,
    emailAddressId: userEmailAddressId, // Obtenido desde clerkClient.users.getUser(userId)
  });
} catch (emailError) {
  // El fallo del email no revierte la aprobación.
  // Se registra como warning para revisión manual.
  console.warn(`[warn] Email de aprobación no enviado a userId=${userId}:`, emailError);
}
```

**Importante:** El `emailAddressId` se obtiene previamente del objeto de usuario de Clerk (`user.emailAddresses[0].id`). El desarrollador debe obtenerlo en el mismo handler antes de llamar a `createEmail`.

---

## Resumen de Endpoints

| Método | Ruta | Acceso | Versión |
|--------|------|--------|---------|
| GET | `/api/protocols` | authenticated | V1.0 |
| POST | `/api/protocols` | authenticated | V1.0 |
| GET | `/api/protocols/[id]` | authenticated | V1.0 |
| PUT | `/api/protocols/[id]` | authenticated | V1.0 |
| DELETE | `/api/protocols/[id]` | authenticated | V1.0 |
| POST | `/api/protocols/[id]/share` | authenticated | V1.0 |
| GET | `/api/protocols/shared/[shareCode]` | public | V1.0 |
| GET | `/api/messages` | authenticated | V1.1 |
| POST | `/api/messages` | authenticated | V1.1 |
| PUT | `/api/messages/[id]/read` | authenticated | V1.1 |
| GET | `/api/messages/unread-count` | authenticated | V1.1 |
| GET | `/api/users/search` | authenticated | V1.1 |
| GET | `/api/admin/users` | admin | V2.0 |
| POST | `/api/admin/users/[userId]/ban` | admin | V2.0 |
| POST | `/api/admin/users/[userId]/unban` | admin | V2.0 |
| GET | `/api/admin/role-requests` | admin | V2.0 |
| POST | `/api/admin/role-requests/[id]/approve` | admin | V2.0 |
| POST | `/api/admin/role-requests/[id]/reject` | admin | V2.0 |
| GET | `/api/admin/stats` | admin | V2.0 |
| POST | `/api/roles/request-teacher` | authenticated | V2.0 |

---

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-04-14 | Versión inicial — contratos de V1.0 + V1.1 + V2.0 |
| 1.1 | 2026-04-14 | D-02: flujo de aprobación de rol con retry backoff exponencial y reconciliación. D-05: sección de notificación de email via Clerk. |
| 1.2 | 2026-04-15 | Seguridad: 403 explícito en `GET/PUT/DELETE /api/protocols/[id]` y `POST /api/protocols/[id]/share` cuando el recurso pertenece a otro usuario. |
