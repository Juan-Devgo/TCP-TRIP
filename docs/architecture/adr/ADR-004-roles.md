# ADR-004: Roles almacenados en publicMetadata de Clerk (no en tabla propia de PostgreSQL)

**Estado:** Aceptado  
**Fecha:** 2026-04-14  
**Deciders:** Equipo TCP-TRIP  
**Motiva:** TC-008, TC-011, TC-012, E-007

---

## Contexto

TCP-TRIP define tres roles de usuario: `student`, `teacher`, `admin`. El sistema necesita verificar el rol en:

1. El middleware de Astro (servidor) — para proteger rutas.
2. Los componentes React (cliente) — para condicionar la UI.
3. Las API Routes (servidor) — para autorizar operaciones.

La pregunta clave es: **¿dónde se almacena el rol canónico?**

Las opciones analizadas son:

**Opción A:** Tabla `users` en PostgreSQL con columna `role`. El middleware consulta la BD en cada request para leer el rol.

**Opción B:** `publicMetadata` de Clerk. El rol se almacena en el perfil del usuario en Clerk y se incluye en las session claims del JWT. El middleware lee el rol del JWT sin consulta a la BD.

**Opción C:** `privateMetadata` de Clerk. Similar a B, pero el rol no es accesible desde el cliente JavaScript. Requiere una API Route adicional para exponer el rol al frontend.

---

## Decisión

Se elige **Opción B: `publicMetadata` de Clerk**.

El rol del usuario se almacena en `publicMetadata.role` como string: `"student"`, `"teacher"` o `"admin"`. 

El middleware de Astro lee el rol desde `sessionClaims.metadata.role` (disponible en el JWT emitido por Clerk) **sin consultar la base de datos** en cada request.

Los componentes React acceden al rol via `user.publicMetadata.role` del hook `useUser()` de Clerk, disponible en el cliente sin fetch adicional.

**La excepción de la BD:** El estado de baneo (`is_banned`) SÍ se almacena en la tabla `users` de PostgreSQL y requiere una consulta SQL en el middleware (TC-013). El razonamiento es que el baneo es un estado de control de acceso a nivel de plataforma, no un atributo de identidad del usuario en Clerk. Clerk no tiene un concepto nativo de "usuario baneado de una aplicación específica".

Las solicitudes de rol docente (estado: pending/approved/rejected) se almacenan en la tabla `role_requests` de PostgreSQL porque requieren historial y auditoría que `publicMetadata` no puede proveer.

---

## Consecuencias

### Positivas

- **Sin consulta SQL para verificar rol:** El rol viene en el JWT de Clerk. El middleware no necesita una query adicional para verificar si el usuario es teacher o admin. Esto reduce la latencia de cada request autenticado.
- **Disponible en el cliente:** `publicMetadata` es accesible desde `useUser().user.publicMetadata` en el cliente React. Los componentes pueden condicionar su UI sin un fetch adicional al servidor para obtener el rol.
- **Consistencia con el modelo de Clerk:** Clerk está diseñado para que `publicMetadata` almacene atributos del usuario que la aplicación necesita. No es un uso forzado.
- **Eliminación de sincronización:** No se necesita sincronizar el estado de rol entre la BD y Clerk. La BD no tiene columna `role`; Clerk es la única fuente de verdad del rol.

### Negativas / Trade-offs

- **Depende de Clerk como fuente de verdad del rol:** Si Clerk tiene un outage, no solo falla la autenticación sino también la verificación de rol. Este riesgo ya existe por usar Clerk como proveedor (ver ADR-003, R-005).
- **El rol no se refleja inmediatamente en sesiones existentes:** Cuando el admin aprueba el rol docente y actualiza `publicMetadata` en Clerk, el usuario ya logueado no ve el cambio hasta que refresca su sesión (cierra y abre sesión). Esto es un comportamiento inherente a los sistemas basados en JWT. Documentar como comportamiento esperado.
- **Limitación de `publicMetadata`:** `publicMetadata` es un objeto JSON sin tipado en Clerk. Si la estructura cambia (e.g., se agrega un campo `permissions` además de `role`), se debe actualizar el código del middleware y los componentes que lo leen. El casting `(sessionClaims?.metadata as any)?.role` es necesario pero frágil.
- **Vendor lock-in en datos de rol:** Si se migra de Clerk a otro proveedor, los roles almacenados en `publicMetadata` deben migrarse. El script de migración necesitaría usar la API de Clerk para exportar todos los usuarios y sus `publicMetadata`, y luego importarlos al nuevo sistema.

### Riesgos

- **Modificación accidental de `publicMetadata`:** Si un bug en el código envía `publicMetadata: {}` (vacío) al API de Clerk, se borrarían los roles de todos los usuarios afectados. Mitigación: la función `updateUserRole(userId, role)` en `src/lib/auth.ts` debe hacer un PATCH (no PUT) de `publicMetadata`, y debe validar que el role a asignar es uno de los tres válidos (`student`, `teacher`, `admin`) antes de hacer la llamada a Clerk.

---

## Alternativas Evaluadas

| Alternativa | Razón de descarte |
|-------------|-------------------|
| Tabla `users` con columna `role` en PostgreSQL (Opción A) | Requiere una consulta SQL en cada request para leer el rol, además de la consulta de baneo. Duplica la fuente de verdad: el rol vive tanto en la BD como en Clerk (si Clerk también lo almacena para el cliente). Si se mantiene solo en la BD, los componentes React necesitan un fetch adicional para obtener el rol. |
| `privateMetadata` de Clerk (Opción C) | El rol no es accesible desde el cliente. Requiere un endpoint `/api/me` que exponga el rol al frontend en cada carga de página. Agrega una llamada HTTP extra sin beneficio de seguridad para un dato tan simple como el nombre del rol. |
| Roles en `privateMetadata` para admin y `publicMetadata` para teacher | Dividir la lógica de lectura de roles entre dos fuentes en el mismo middleware incrementa la complejidad sin beneficio. |
