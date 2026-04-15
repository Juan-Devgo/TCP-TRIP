# ADR-003: Clerk como proveedor de autenticación y gestión de sesiones

**Estado:** Aceptado  
**Fecha:** 2026-04-14  
**Deciders:** Equipo TCP-TRIP  
**Motiva:** TC-003, TC-008, TC-009, TC-010, R-005

---

## Contexto

TCP-TRIP requiere autenticación para proteger las funcionalidades de usuario (guardar protocolos, enviar mensajes, solicitar rol docente). Las opciones son:

1. **Autenticación propia:** Implementar registro, login, manejo de sesiones, recuperación de contraseña, hashing de contraseñas, OAuth desde cero.
2. **Clerk:** Servicio SaaS especializado en autenticación y gestión de usuarios. Tiene integración oficial con Astro (`@clerk/astro`).
3. **Auth.js (NextAuth):** Librería open-source, pero orientada a Next.js. La integración con Astro es menos madura.
4. **Supabase Auth:** Parte del ecosistema Supabase; excelente si se usa Supabase como base de datos también.

La decisión de usar Clerk ya está tomada y el código base la implementa. Este ADR documenta la justificación y registra los riesgos y restricciones identificadas.

---

## Decisión

Se usa **Clerk** (`@clerk/astro`) como proveedor exclusivo de autenticación y gestión de sesiones. Clerk gestiona:

- Registro de usuarios (email + contraseña, OAuth opcional).
- Inicio y cierre de sesión.
- Recuperación de contraseña.
- Sesiones y tokens JWT.
- Perfil básico del usuario (nombre, email, avatar).
- `publicMetadata` y `privateMetadata` para datos extendidos del usuario (rol, estado de ban referencial).

El middleware de Astro usa `clerkMiddleware()` de `@clerk/astro/server`. Los componentes React usan `useUser()`, `useAuth()`, `SignedIn`, `SignedOut` de `@clerk/astro/react`.

La API de Clerk Backend (`clerkClient`) se usa en las API Routes del servidor para:
- Buscar usuarios por email (`GET /api/users/search`).
- Actualizar `publicMetadata.role` al aprobar el rol docente.
- Listar usuarios en el panel de administración.

---

## Consecuencias

### Positivas

- **Velocidad de implementación:** Clerk provee UI Components preconstruidos (formularios de login/registro) y hooks de React. No se implementa autenticación desde cero, lo que es crítico dado el plazo académico (PR-001, PR-002).
- **Seguridad gestionada:** Clerk maneja hashing de contraseñas, gestión de sesiones, rotación de tokens y protección contra ataques comunes (brute force, credential stuffing). No se expone al equipo de desarrollo a implementar criptografía de forma incorrecta.
- **`publicMetadata`:** Permite extender el perfil del usuario con datos de la aplicación (rol) sin necesidad de una tabla `users` completa en PostgreSQL. Esto reduce la superficie de datos que el equipo debe gestionar.
- **Integración Astro nativa:** `@clerk/astro` es mantenida por Clerk. El middleware `clerkMiddleware()` se integra directamente con el sistema de contexto de Astro (`locals.auth()`).
- **Plan gratuito suficiente:** Para el volumen esperado (< 10,000 usuarios activos mensuales, AS-008), el plan gratuito de Clerk no tiene costo.

### Negativas / Trade-offs

- **Dependencia de servicio externo:** Si Clerk no está disponible, la autenticación falla completamente (TC-003). No existe fallback local.
- **Vendor lock-in:** Si Clerk cambia sus términos de servicio, precios o depreca su API, la migración sería costosa (R-005). Todos los registros de usuarios están en el sistema de Clerk, no en la BD propia.
- **Rate limits en API de Clerk:** Las llamadas a `clerkClient.users.getUserList()` (búsqueda de usuarios) tienen límites por plan. Implementar debounce de 500ms en el cliente (TC-009).
- **Latencia adicional:** Las llamadas al backend de Clerk (actualizar metadata, buscar usuarios) agregan latencia de red a las operaciones de administración. Para el volumen esperado, es aceptable.
- **`publicMetadata` es modificable desde el servidor:** Un bug en el código del servidor podría elevar accidentalmente el rol de un usuario. Mitigación: la única ruta que modifica `publicMetadata.role` a `teacher` es `POST /api/admin/role-requests/[id]/approve`, protegida por verificación de rol `admin`.

### Riesgos

- **R-005:** Clerk cambia precios o API. Mitigación documentada en `constraints-and-assumptions.md`: encapsular todas las llamadas a Clerk detrás de abstracciones locales. En la práctica, esto significa:
  - Crear una función `getAuthenticatedUser(locals)` en `src/lib/auth.ts` que abstrae `locals.auth()`.
  - Crear funciones `updateUserRole(userId, role)` y `searchUsersByEmail(query)` en `src/lib/auth.ts` que envuelven `clerkClient`.
  - Si Clerk cambia su API, solo se modifica `src/lib/auth.ts`, no todos los route handlers.

---

## Alternativas Evaluadas

| Alternativa | Razón de descarte |
|-------------|-------------------|
| Autenticación propia | Implementar autenticación segura requiere tiempo y experiencia criptográfica que no es el foco del trabajo de grado. El riesgo de vulnerabilidades de seguridad es alto. |
| Auth.js (NextAuth) | Diseñado para Next.js. La integración con Astro es menos madura y no tiene middleware nativo equivalente al de Clerk. |
| Supabase Auth | Válido si se usa Supabase como BD. Ya que la BD es PostgreSQL independiente (Q-006 pendiente), añadir Supabase Auth crea un acoplamiento innecesario. |
| Lucia Auth | Librería open-source reciente. Menor comunidad, menos documentación. Para un proyecto académico con plazo fijo, Clerk (más maduro) es preferible. |
