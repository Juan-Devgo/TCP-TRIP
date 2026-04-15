---
id: ADR-007
title: "Resiliencia Clerk ↔ PostgreSQL: retry con backoff exponencial + reconciliación al arranque"
status: accepted
date: 2026-04-14
deciders: [SA, Desarrollador]
motiva: [TC-012, D-02]
---

# ADR-007: Mecanismo de Resiliencia para la Sincronización Clerk ↔ PostgreSQL

**Estado:** Aceptado  
**Fecha:** 2026-04-14  
**Deciders:** Equipo TCP-TRIP  
**Motiva:** TC-012, D-02

---

## Contexto

El flujo de aprobación de solicitudes de rol docente (TC-012) involucra dos operaciones secuenciales en sistemas externos independientes:

1. Actualizar `publicMetadata.role = 'teacher'` en Clerk via `clerkClient.users.updateUserMetadata()`.
2. Actualizar `role_requests.status = 'approved'` en PostgreSQL.

Estas dos operaciones **no son atómicas**: no existe un mecanismo de transacción distribuida que garantice que ambas se completan o ninguna. Los escenarios de fallo posibles son:

| Escenario | Efecto |
|-----------|--------|
| Clerk falla en el paso 1 | El paso 2 no se ejecuta. La BD permanece correcta (`pending`). El admin reintenta. Sin inconsistencia. |
| Clerk exitoso, BD falla en el paso 2 | **Escenario crítico:** El usuario tiene `role = 'teacher'` en Clerk pero `role_requests.status` sigue en `pending` en la BD. El rol ya es efectivo en la plataforma pero el registro de auditoría es incorrecto. |
| Clerk exitoso, BD exitosa, email falla | El usuario no recibe notificación. El rol fue asignado correctamente. Impacto bajo. |

El equipo ha validado que **no acepta que Clerk y la BD queden desincronizados de forma permanente**. Se requiere un mecanismo automático de corrección.

### Opciones analizadas

**Opción A — Reconciliación al arranque del servidor:**
Al iniciar la aplicación, se ejecuta una función que detecta solicitudes en estado `pending` cuyo `userId` ya tiene `role = 'teacher'` en Clerk, y las marca como `approved` en la BD.

**Opción B — Job de fondo periódico (cron):**
Un proceso de fondo corre periódicamente (e.g., cada 5 minutos) y ejecuta la misma lógica de reconciliación.

**Opción C — Retry con backoff exponencial en el endpoint de aprobación:**
El handler del endpoint reintenta la escritura en BD hasta N veces antes de declarar fallo, con una pausa exponencial entre intentos.

Las opciones no son mutuamente excluyentes. La pregunta es cuál combinación es la más simple y robusta para un proyecto small-team.

---

## Decisión

Se adopta la combinación **Opción C + Opción A**:

1. **Primera línea de defensa — Retry con backoff exponencial en el endpoint** (Opción C):
   - Si la escritura en BD falla tras la actualización exitosa en Clerk, el handler reintenta hasta **3 veces** con delays de **100ms, 200ms y 400ms**.
   - Esta combinación (3 intentos, tiempo total máximo ~700ms más el tiempo de red) cubre los fallos transitorios de BD (conexión momentáneamente saturada, failover de PostgreSQL, etc.).
   - Si los 3 reintentos fallan, el handler retorna HTTP 500 al cliente admin y registra el evento en el log del servidor con el `userId` y `requestId` para revisión manual.

2. **Segunda línea de defensa — Reconciliación al arranque del servidor** (Opción A):
   - Al iniciar el proceso de Astro/Bun, se ejecuta `reconcileRoleRequests()` una vez.
   - Esta función consulta todas las solicitudes en estado `pending` en la BD, verifica el rol actual en Clerk para cada una, y actualiza automáticamente a `approved` las que ya tienen `role = 'teacher'` en Clerk.
   - Cubre el escenario donde el fallo de BD ocurrió entre reinicios del servidor y no hubo admin que reintentara manualmente.

**Por qué se descarta la Opción B (job de fondo periódico) como mecanismo principal:**
- Para el volumen académico esperado (AS-007), la desincronización es un evento raro (fallo de red o BD en el momento exacto de la aprobación). Un cron periódico agrega complejidad de implementación (manejo de estado, señales de Bun, gestión del ciclo de vida del worker) sin beneficio proporcional.
- La reconciliación al arranque es suficiente porque: (a) los reinicios del servidor son el mecanismo natural de recuperación ante fallos de proceso, y (b) el número de solicitudes pendientes a reconciliar es pequeño.
- Si en V3.0 el volumen escala, la Opción B puede implementarse usando `Bun.cron()` o un scheduler externo.

---

## Implementación

### Módulo `retry.ts`

```typescript
// src/shared/lib/retry.ts

/**
 * Ejecuta una función async con reintentos y backoff exponencial.
 * @param fn           Función a reintentar en caso de error.
 * @param maxAttempts  Número máximo de intentos (default: 3).
 * @param baseDelayMs  Delay base en ms para el backoff (default: 100ms).
 *                     Delay efectivo por intento: baseDelayMs * 2^(attempt-1)
 *                     Intentos: 100ms, 200ms, 400ms (con defaults)
 */
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
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

### Módulo `reconcile.ts`

```typescript
// src/shared/lib/reconcile.ts
import { sql } from './sql';
import { clerkClient } from '@clerk/astro/server';

let reconciled = false; // Flag para ejecutar solo una vez por proceso

/**
 * Detecta solicitudes de rol que siguen en 'pending' en la BD pero cuyo
 * usuario ya tiene role = 'teacher' en Clerk. Las marca como 'approved'.
 *
 * Llamar una vez al iniciar el servidor.
 */
export async function reconcileRoleRequests(): Promise<void> {
  if (reconciled) return;
  reconciled = true;

  try {
    const pendingRequests = await sql`
      SELECT id, user_id FROM role_requests
      WHERE status = 'pending'
    `;

    for (const request of pendingRequests) {
      try {
        const user = await clerkClient.users.getUser(request.user_id);
        const currentRole = (user.publicMetadata as any)?.role;

        if (currentRole === 'teacher') {
          await sql`
            UPDATE role_requests
            SET
              status     = 'approved',
              reviewed_at = NOW(),
              comment    = 'Auto-reconciliado al arranque — rol ya asignado en Clerk'
            WHERE id = ${request.id}
          `;
          console.info(
            `[reconcile] Solicitud ${request.id} sincronizada: ` +
            `usuario ${request.user_id} ya era teacher en Clerk.`
          );
        }
      } catch (userError) {
        // Si falla la consulta de un usuario específico, continuar con el siguiente.
        console.warn(
          `[reconcile] No se pudo verificar usuario ${request.user_id}:`,
          userError
        );
      }
    }
  } catch (error) {
    // La reconciliación es un proceso de fondo; no debe bloquear el arranque.
    console.error('[reconcile] Error durante la reconciliación de role_requests:', error);
  }
}
```

### Integración en el middleware

```typescript
// src/middleware.ts — llamar reconcileRoleRequests al primer request
import { clerkMiddleware } from "@clerk/astro/server";
import { reconcileRoleRequests } from "./shared/lib/reconcile";

let startupDone = false;

export const onRequest = clerkMiddleware(async (auth, context) => {
  // Reconciliación de arranque: se ejecuta una sola vez por proceso
  if (!startupDone) {
    startupDone = true;
    reconcileRoleRequests().catch(err =>
      console.error('[startup] Reconciliación fallida:', err)
    );
    // No await: no bloquear el primer request
  }

  // ... resto del middleware (verificación de auth, baneo, roles)
});
```

**Nota:** `reconcileRoleRequests()` se llama sin `await` en el middleware para que no bloquee el tiempo de respuesta del primer request. Se ejecuta en paralelo al primer request pero completará antes de que lleguen requests de aprobación adicionales en condiciones normales.

---

## Consecuencias

### Positivas

- **Consistencia eventual garantizada:** En el peor caso, la BD se reconcilia al próximo reinicio del servidor. El rol es funcional en Clerk inmediatamente tras la aprobación.
- **Simplicidad de implementación:** Dos funciones (`withRetry`, `reconcileRoleRequests`) de menos de 60 líneas cada una. Sin dependencias adicionales.
- **Sin overhead en operaciones normales:** El retry solo se activa si la BD falla. La reconciliación al arranque solo corre si hay solicitudes `pending` con `role = 'teacher'` en Clerk (caso raro).
- **Auditabilidad:** Los logs de reconciliación dejan trazabilidad de qué solicitudes fueron auto-corregidas y cuándo.

### Negativas / Trade-offs

- **Ventana de inconsistencia:** Si la BD falla y el servidor no se reinicia, la inconsistencia persiste hasta el próximo reinicio. En un contexto académico con un único administrador, esto es aceptable.
- **Carga de Clerk API al arranque:** Si hay muchas solicitudes `pending` en la BD, la reconciliación hace N llamadas a Clerk. Para el volumen esperado (< 20 solicitudes históricas en contexto académico), esto es negligible.
- **No cubre fallos de Clerk en la reconciliación:** Si Clerk está caído durante el arranque del servidor, la reconciliación no puede verificar roles y se salta. Se registra como warning. La próxima ejecución (próximo reinicio) lo intentará de nuevo.

---

## Alternativas Evaluadas

| Alternativa | Razón de descarte |
|-------------|-------------------|
| Transacción distribuida (2PC) | Innecesariamente compleja. Clerk no expone un API de transacciones. Overkill para el volumen y contexto del proyecto. |
| Saga con compensación | Similar al problema de 2PC. La "compensación" sería eliminar el rol de Clerk si la BD falla — pero esto penalizaría al admin (tendría que reintentar manualmente). El retry en el endpoint es menos invasivo. |
| Job de fondo periódico como único mecanismo | Sin el retry en el endpoint, la ventana de inconsistencia es el período del cron (e.g., 5 minutos). Con el retry, la ventana se reduce a la duración de un reinicio del servidor. El retry es la primera línea de defensa más efectiva. |
| Almacenar un "outbox" de eventos en BD | Patrón Transactional Outbox: escribir la intención de actualizar Clerk en una tabla antes de hacerlo, y procesarla asincrónicamente. Válido pero agrega complejidad significativa (tabla adicional, worker de procesamiento). YAGNI para este contexto. |
