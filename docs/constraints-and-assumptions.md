# Restricciones y Suposiciones — TCP-TRIP

**Versión:** 1.2  
**Fecha:** 2026-04-14  
**Destinatarios:** Arquitecto de Software, Desarrollador, QA

---

## 1. Restricciones Técnicas

### 1.1 Stack y Runtime

| ID | Restricción | Impacto |
|----|-------------|---------|
| TC-001 | El proyecto usa **Astro 6.1.4** con modo SSR (`@astrojs/node`). Las páginas se renderizan en el servidor, lo que implica que el estado de React solo existe en el cliente tras la hidratación (`client:load`). | Los componentes con estado (ProtocolBuilder, calculadoras) deben usar `client:load` o `client:idle`. No usar `client:only` a menos que sea imprescindible. |
| TC-002 | El runtime es **Bun**. Toda la lógica de servidor usa APIs nativas de Bun: `bun:sqlite` quedó descartado; la base de datos es **PostgreSQL** accedida mediante `Bun.sql`. No se usa `pg`, `postgres.js` ni `better-sqlite3`. | El Arquitecto debe asegurarse de que el adaptador de Astro (`@astrojs/node`) funcione correctamente en el runtime de Bun. Toda query a base de datos debe usar `Bun.sql` (tagged template literals). |
| TC-003 | La autenticación está completamente delegada a **Clerk** (`@clerk/astro`). No existe un sistema de autenticación propio. | Todas las funcionalidades de auth (registro, login, sesiones, recuperación de contraseña, OAuth) dependen de la disponibilidad del servicio de Clerk. La plataforma falla en autenticación si Clerk no está disponible. |
| TC-004 | La base de datos es **PostgreSQL**. Se accede exclusivamente mediante `Bun.sql`. No existe un archivo de base de datos local (se elimina la referencia a `tcp-trip.db`). | El esquema debe definirse con migraciones versionadas. PostgreSQL soporta escrituras concurrentes, por lo que el límite de instancia única de SQLite ya no aplica. El equipo debe provisionar una instancia de PostgreSQL (puede ser local para desarrollo, o un servicio cloud para producción). |
| TC-005 | Los tipos de campo del Constructor de Protocolos soportados en V1 son: `uint`, `flags`, `ascii`, `hex`, `ipv4`, `enum`, `padding`, `composite`. Los sub-campos de tipo `composite` no pueden contener otros `composite` (restricción de diseño explícita en `types.ts`). | Cualquier funcionalidad de ejercicios o mensajes que dependa de tipos de campo debe respetar esta lista. Agregar nuevos tipos de campo requiere: actualizar el tipo `FieldType`, implementar su editor y actualizar `HeaderVisualization`. |
| TC-006 | **Tailwind CSS v4** está en uso. Su API de configuración es diferente a v3 (no usa `tailwind.config.js` por defecto; usa directivas CSS). | Los desarrolladores deben conocer la API de Tailwind v4. No usar patrones de configuración de v3. |
| TC-007 | **React 19.2.4** está en uso. Algunas librerías de terceros pueden no ser compatibles con React 19. | Verificar compatibilidad de cualquier librería React antes de instalarla. Especialmente librerías de UI (Radix, Headless UI, etc.). |

---

### 1.2 Autenticación, Autorización y Roles

| ID | Restricción | Impacto |
|----|-------------|---------|
| TC-008 | Clerk provee el `userId` de cada usuario. Los roles (`student`, `teacher`, `admin`) se almacenan en `publicMetadata` de Clerk (roles visibles al middleware del servidor). El estado de solicitudes de rol (pending/approved/rejected) se persiste en la tabla `role_requests` de PostgreSQL. | Para V2.0, la decisión de arquitectura de roles debe tomarse antes de iniciar el desarrollo de E-007 y E-009. El middleware de Astro debe leer `publicMetadata.role` para determinar el nivel de acceso. |
| TC-009 | La búsqueda de usuarios por correo (`GET /api/users/search`) usa la API de Clerk. Esta API tiene límites de rate (requests por minuto según el plan). | No implementar búsqueda en tiempo real (debounce mínimo de 500ms antes de llamar a la API de Clerk). |
| TC-010 | El middleware de Astro (`middleware.ts`) usa `clerkMiddleware()`. Este middleware corre en el servidor y puede verificar autenticación y rol. El control de acceso por rol debe implementarse extendiendo este middleware. | Al implementar E-007 (V2.0), extender el middleware para verificar `publicMetadata.role` antes de dejar pasar requests a rutas de docente (`/class-mode/*`) y de admin (`/admin/*`). |
| TC-011 | El administrador de la plataforma se identifica mediante el rol `admin` en `privateMetadata` de Clerk, o mediante una variable de entorno `ADMIN_USER_ID`. Solo existe un administrador (superadmin). No hay jerarquía de roles de administración ni en V2.0 ni en V2.1. | Las rutas `/admin/*` deben validar el rol `admin` en el middleware antes de renderizar cualquier contenido. Un acceso no autorizado devuelve 403. No exponer endpoints de admin sin verificación. |
| TC-012 | La asignación del rol de docente **no es autoservicio**. El flujo obligatorio es: (1) el usuario solicita el rol desde su perfil → (2) se crea un registro `pending` en `role_requests` de PostgreSQL → (3) el administrador aprueba o rechaza desde el panel → (4) en caso de aprobación, se actualiza `publicMetadata.role` de Clerk a `teacher`. | Ningún endpoint de la API puede elevar un usuario a rol `teacher` sin que exista una aprobación registrada en `role_requests` por parte del admin. Esta restricción aplica incluso en entornos de desarrollo (documentar el procedimiento de seeding para tests). |
| TC-013 | Los usuarios baneados deben ser bloqueados en el middleware antes de que cualquier handler de ruta se ejecute. El estado de baneo se almacena en PostgreSQL (tabla `users` o campo en `role_requests`) y/o en `privateMetadata` de Clerk. | El middleware debe consultar el estado de baneo en cada request autenticado. Evaluar el impacto en latencia y cachear el resultado por sesión si es necesario. |

---

### 1.3 Base de Datos

| ID | Restricción | Impacto |
|----|-------------|---------|
| TC-014 | Los campos del protocolo se almacenan en PostgreSQL como `jsonb`. La estructura del JSON es la definida en `src/types/ProtocolBuilder.ts`. | Si la estructura del tipo `ProtocolField` cambia en el futuro, los protocolos guardados con la estructura antigua pueden ser incompatibles. Se necesita una estrategia de migración de datos (p. ej., script de transformación sobre la columna `jsonb`). |
| TC-015 | El snapshot del protocolo en los mensajes (`protocol_snapshot`) también se almacena como `jsonb` en PostgreSQL, en la tabla `messages`. | Este snapshot es inmutable una vez guardado. Cualquier edición posterior del protocolo original no afecta los mensajes ya enviados. |
| TC-016 | Los IDs generados por `generateId()` en `src/lib/db.ts` usan `Math.random()` combinado con `Date.now()`. No son UUID v4 estrictamente. | Para el volumen esperado (contexto académico), la probabilidad de colisión es negligible. Si se escala a producción real, reemplazar por `crypto.randomUUID()`. Para PostgreSQL se puede usar el tipo `uuid` con `gen_random_uuid()` directamente en la BD. |
| TC-018 | La generación de ejercicios (E-006, V2.0) requiere una librería de producción de PDF compatible con Bun. El candidato principal es `pdf-lib` (manipulación de PDF puro, sin dependencias de navegador). La alternativa de renderizado HTML → PDF mediante navegador headless (p. ej., Puppeteer) **no está soportada** en el entorno de Bun sin configuración adicional significativa. | La decisión sobre la librería de PDF debe tomarse como primera tarea técnica de E-006 antes de iniciar el desarrollo. Si `pdf-lib` no cubre los requisitos de maquetación, se debe evaluar una solución de servidor dedicada. No implementar la exportación de PDF sin validar primero la librería en el entorno de Bun. |
| TC-019 | Los ejercicios generados (E-006) no son corregidos automáticamente por la plataforma en V2.0 ni V2.1. La plataforma produce el documento del ejercicio con o sin solución; la corrección es manual por el docente. La corrección automática es candidata para V3.0. | No diseñar el modelo de datos de ejercicios con tablas de respuestas de estudiantes en V2.0. El esquema debe ser extensible para agregarlas en V3.0 sin migraciones destructivas. |
| TC-020 | Los ejercicios se distribuyen de forma externa a la plataforma en V2.0 (el docente descarga el PDF y lo comparte por sus canales habituales: correo, LMS, impresión). No existe un flujo de asignación directa de ejercicio a estudiante en V2.0. | No construir en V2.0 funcionalidades de asignación, buzón de entrega o calificación de ejercicios. Documentar explícitamente este límite en la interfaz del docente para gestionar las expectativas. |

---

### 1.4 API y Comunicación

| ID | Restricción | Impacto |
|----|-------------|---------|
| TC-017 | No existe WebSocket implementado hasta V2.1. Los mensajes son consultados bajo demanda (polling manual del usuario). | La notificación en tiempo real de mensajes nuevos (US-024 badge) requiere polling periódico o un endpoint de `long-polling`. Para V1.1, se acepta que el usuario refresque manualmente. WebSocket real es candidato para V3.0 usando `Bun.serve` nativo. |

---

## 2. Restricciones de UX y Diseño

| ID | Restricción | Impacto |
|----|-------------|---------|
| UX-001 | La plataforma debe funcionar en español e inglés. El idioma por defecto es **español** (`defaultLang = 'es'` en `translations.ts`). | Ningún texto visible al usuario puede estar hardcodeado en el componente. Todas las cadenas deben estar en `translations.ts`. Aplica a componentes Astro y React. |
| UX-002 | Para V2.0 (Modo Clase), la interfaz en modo presentación debe ser **legible en proyectores estándar** de aula universitaria: fondo blanco o muy claro, tipografía mínima de 18px, contraste alto, sin elementos distractores en los bordes de la pantalla. | El diseño del Modo Clase debe validarse en un proyector físico antes de considerarse terminado. No es suficiente validarlo en monitor. |
| UX-003 | El diagrama de bits del Constructor de Protocolos (US-015) sigue el formato de los RFC (filas de 32 bits con bit-ruler). Este formato es una decisión pedagógica deliberada y no debe cambiarse aunque sea visualmente denso. | Cualquier mejora estética al diagrama debe preservar la alineación a 32 bits por fila y la numeración de bits visible. |
| UX-004 | La plataforma es web-first. No existe una aplicación móvil nativa. Sin embargo, la experiencia en móvil debe ser funcional para las páginas informativas (explorador TCP/IP, landing). El Constructor de Protocolos en móvil puede requerir scroll horizontal en el diagrama, lo cual es aceptable y debe indicarse al usuario. | No bloquear el acceso al Constructor de Protocolos en móvil, pero sí indicar que la experiencia óptima es en escritorio. |
| UX-005 | El Panel de Administración (`/admin/*`) no tiene requisitos de responsividad móvil. Se asume que el administrador opera desde escritorio. | No es necesario diseñar el panel admin para móvil en V2.0. Documentar este límite explícitamente en la interfaz si es necesario. |

---

## 3. Restricciones de Proyecto (Contexto Académico)

| ID | Restricción | Impacto |
|----|-------------|---------|
| PR-001 | TCP-TRIP es un **Trabajo de Grado**. La fecha límite de entrega está determinada por el calendario académico de la Universidad del Quindío. No hay flexibilidad para negociar con stakeholders externos. | El scope de cada versión debe ser realista para el tiempo disponible. El backlog debe priorizarse agresivamente. Las funcionalidades "Could Have" se mueven a versiones posteriores sin culpa. |
| PR-002 | El equipo de desarrollo es de **1-2 personas** con dedicación parcial (no full-time). | Las estimaciones de complejidad en el roadmap asumen velocidad reducida. Las historias XL no entran en ninguna versión sin subdivisión previa. |
| PR-003 | La documentación técnica y de producto es un **criterio de evaluación académica**. Los archivos en `/docs` son parte del entregable evaluado por el jurado. | La documentación debe mantenerse actualizada a lo largo del desarrollo. No es un entregable que se hace al final; evoluciona con el proyecto. |
| PR-004 | El código fuente está en un repositorio Git y es parte del entregable. La calidad del historial de commits es evaluada. | Usar mensajes de commit descriptivos. No hacer commits gigantes. Preferir commits atómicos por historia o tarea. |

---

## 4. Suposiciones

### 4.1 Sobre los Usuarios

| ID | Suposición | Consecuencia si es incorrecta |
|----|-----------|-------------------------------|
| AS-001 | Los estudiantes acceden a la plataforma desde un computador de escritorio o portátil con un navegador moderno (Chrome, Firefox, Edge). | Si el acceso es mayoritariamente desde móvil, el Constructor de Protocolos necesita rediseño para pantallas pequeñas. |
| AS-002 | Los estudiantes ya tienen cuenta de correo electrónico universitario que pueden usar para registrarse en Clerk. | Si Clerk no acepta dominios institucionales específicos, se debe verificar la configuración de Clerk antes del despliegue. |
| AS-003 | Los docentes tienen acceso a un proyector con conexión HDMI o Wi-Fi en el aula donde enseñan. | Si la conectividad a internet en el aula es limitada, el Modo Clase necesita un mecanismo de caché o versión offline. |
| AS-004 | Los usuarios entienden conceptos básicos de redes (qué es un protocolo, qué es un campo) antes de usar el Constructor de Protocolos. La plataforma complementa la enseñanza, no la reemplaza. | Si los usuarios son completamente nuevos en el tema, se necesitan más ayudas contextuales (tooltips, ejemplos guiados) dentro del Constructor. |
| AS-005 | El administrador de la plataforma es el mismo equipo de desarrollo del Trabajo de Grado. No se necesita un proceso de incorporación de admin. | Si el proyecto continúa post-grado con otro mantenedor, se debe documentar el proceso de configuración del admin (variable de entorno o metadata en Clerk). |

### 4.2 Sobre la Infraestructura

| ID | Suposición | Consecuencia si es incorrecta |
|----|-----------|-------------------------------|
| AS-006 | El despliegue se realiza con una única instancia de servidor Bun. PostgreSQL puede ser una instancia gestionada (p. ej., Supabase, Railway, Neon) o autoalojada. | Si se requieren múltiples instancias de Bun, se debe usar un mecanismo de sesión compartido (Redis u otro). La BD en PostgreSQL ya soporta concurrencia. |
| AS-007 | El volumen de usuarios concurrentes en V1.0–V2.0 es bajo: < 100 usuarios simultáneos (contexto de uno o dos grupos de clase universitaria). | Si el uso escala, se deben revisar los índices de PostgreSQL y el plan de conexiones de `Bun.sql`. |
| AS-008 | Clerk está disponible en el plan gratuito para el volumen de usuarios esperado (< 10,000 usuarios activos mensuales). | Si el uso supera los límites del plan gratuito de Clerk, los costos de autenticación pueden ser un impedimento para la continuidad del proyecto post-tesis. |
| AS-009 | Hay conexión a internet estable dentro del aula donde el docente usa la plataforma en Modo Clase (E-005) o genera ejercicios (E-006). La plataforma **no requiere modo offline**. | Si la conectividad en el aula es inestable, el Modo Clase necesitaría un mecanismo de caché local (Service Worker) y la generación de ejercicios quedaría inutilizable. Para V2.0 esta situación se acepta como riesgo fuera de alcance. Si el problema se reporta como frecuente por los docentes, se reconsiderará en V3.0. |

### 4.3 Sobre el Dominio

| ID | Suposición | Consecuencia si es incorrecta |
|----|-----------|-------------------------------|
| AS-009 | Los campos de protocolo se almacenan en PostgreSQL como `jsonb`. La estructura del JSON de campos es la definida en `src/types/ProtocolBuilder.ts`. | Si la estructura del tipo `ProtocolField` cambia en el futuro, los protocolos guardados con la estructura antigua pueden ser incompatibles. Se necesita una estrategia de migración de datos. |
| AS-010 | Un protocolo compartido vía `share_code` es de acceso público (sin autenticación). No existe una opción de compartición privada (solo con usuarios específicos) hasta V3.0. | Si se necesita compartición con acceso restringido (p. ej., solo para estudiantes de una clase), hay que implementar listas de control de acceso adicionales. |

---

## 5. Riesgos y Preguntas Abiertas

### 5.1 Riesgos Identificados

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|----|--------|-------------|---------|-----------|
| R-001 | Complejidad de la migración a PostgreSQL mayor de lo esperado (esquema, queries, tipos de Bun.sql) | Media | Alto | Hacer la migración como primera tarea técnica de V1.0 (T-004). Validar con un prototipo simple de CRUD antes de migrar todas las tablas. |
| R-002 | Scope creep: solicitud de funcionalidades de docente o admin antes de completar V1.0 | Media | Medio | Mantener el backlog de cada versión congelado. Toda nueva solicitud va a la versión siguiente. |
| R-003 | La interfaz del Constructor de Protocolos es demasiado compleja para usuarios nuevos | Media | Alto | Incluir un tutorial interactivo o tour guiado en V1.0 (agregar como historia Could Have). |
| R-004 | Cobertura i18n incompleta: textos hardcodeados descubiertos tarde en el desarrollo | Alta | Medio | Ejecutar T-001 (auditoría i18n) como primera tarea técnica del sprint de cierre de V1.0. |
| R-005 | Dependencia de Clerk: si Clerk cambia su API o planes de precios, la autenticación falla | Baja | Alto | Encapsular todas las llamadas a Clerk detrás de abstracciones locales. Documentar los puntos de integración con Clerk para facilitar una migración futura. |
| R-006 | El proceso de aprobación de rol docente genera cuellos de botella si el admin no responde a tiempo | Baja | Medio | Documentar un SLA informal (p. ej., el admin revisa solicitudes en < 48h). Si el proyecto escala, considerar criterios de aprobación automática para casos simples. |

### 5.2 Preguntas Abiertas Resueltas

| ID | Pregunta | Resolución | Fecha |
|----|----------|-----------|-------|
| Q-001 | ¿Se migra `better-sqlite3` a `bun:sqlite` antes de V1.0 o después? | Resuelta: la decisión arquitectónica es **PostgreSQL con `Bun.sql`**. No se migra a `bun:sqlite`. La migración a PostgreSQL es T-004 y es Must para V1.0. | 2026-04-14 |
| Q-002 | ¿Cómo se valida que un usuario tiene rol de docente? | Resuelta: proceso de solicitud manual desde el perfil del usuario → aprobación explícita del administrador desde el panel de admin (E-009, US-028). No hay autoservicio ni validación automática por correo institucional. | 2026-04-14 |
| Q-003 | ¿El Modo Clase (V2.0) necesita funcionar sin conexión a internet (modo offline), o se asume conectividad estable en el aula? | Resuelta: se asume conectividad a internet estable dentro del aula. El Modo Clase **no requiere modo offline** en V2.0 ni V2.1. Si el problema de conectividad se reporta como frecuente por docentes en producción, se evaluará un modo offline basado en Service Worker en V3.0. Esta decisión se documenta en AS-009. | 2026-04-14 |
| Q-004 | ¿Los ejercicios generados (V2.0) son corregidos automáticamente por la plataforma o solo se exportan para corrección manual del docente? | Resuelta: los ejercicios **no son corregidos automáticamente** por la plataforma en V2.0 ni V2.1. La plataforma genera el documento del ejercicio con o sin solución paso a paso; la corrección y calificación es manual por el docente. Los ejercicios se exportan como PDF o se copian al portapapeles. La asignación directa a estudiantes y la corrección automática son candidatas para V3.0. Esta decisión se formaliza en TC-019 y TC-020. | 2026-04-14 |
| Q-005 | ¿Existe un administrador de la plataforma en V1.0? | Resuelta: no existe panel de admin en V1.0 ni V1.1. El administrador se incorpora en V2.0. Solo existe un superadmin (sin jerarquía). | 2026-04-14 |

### 5.2.1 Preguntas adicionales resueltas (2026-04-14)

| ID | Pregunta | Resolución | Fecha |
|----|----------|-----------|-------|
| Q-006 | ¿Cuál es el proveedor de PostgreSQL para el despliegue de producción? | Resuelta: **Neon** (serverless PostgreSQL) como opción preferida junto con **Cloudflare Pages + Workers**. Docker Compose en servidor universitario como alternativa. Ver ADR-006 y `deployment.md`. | 2026-04-14 |
| Q-007 | ¿Se notifica al usuario por email al aprobar/rechazar su solicitud de rol docente? | Resuelta: **sí**, mediante `clerkClient.emails.createEmail()`. Solo usuarios registrados en Clerk pueden recibir el email. Ver D-05, `roles-and-permissions.md` sección 4.2. | 2026-04-14 |

### 5.3 Preguntas Abiertas Pendientes

| ID | Pregunta | Responsable | Deadline sugerido |
|----|----------|-------------|------------------|
| Q-008 | ¿Qué librería de generación de PDF es compatible con el entorno de Bun y cumple los requisitos de maquetación del documento de ejercicios? ¿`pdf-lib` cubre las necesidades o se requiere una solución alternativa? | Arquitecto | Primera tarea técnica de E-006 en V2.0 |

---

## 6. Restricciones Adicionales (D-01 al D-06)

Resultado de las decisiones validadas en 2026-04-14:

| ID | Restricción | Impacto |
|----|-------------|---------|
| TC-018 | El idioma por defecto del sitio es **español**. La ruta raíz `/` sirve contenido en español. Las rutas en inglés se ubican bajo `/en/`. `astro.config.mjs` debe tener `defaultLocale: "es"`. | Toda nueva página se crea primero en español (canónica) y luego su espejo en inglés bajo `/en/`. El middleware de i18n de Astro refleja esta configuración. |
| TC-019 | Los datos existentes en `tcp-trip.db` (SQLite) **se descartan**. El schema de PostgreSQL se crea desde cero con `gen_random_uuid()`. No hay script de migración de IDs. | No se puede confiar en que datos previamente creados en desarrollo local con SQLite sean compatibles con el nuevo schema. Los entornos de desarrollo deben reiniciarse con el nuevo schema. |
| TC-020 | El mecanismo de resiliencia para la sincronización Clerk ↔ BD es: **retry con backoff exponencial** (3 intentos, 100ms base) + **reconciliación al arranque** del servidor. Ver ADR-007 y `shared/lib/retry.ts`, `shared/lib/reconcile.ts`. | El desarrollador debe implementar `withRetry()` en el handler de aprobación de rol y llamar `reconcileRoleRequests()` al inicio del proceso (sin bloquear). |

---

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-04-14 | Versión inicial |
| 1.1 | 2026-04-14 | Reemplazo de SQLite/better-sqlite3 por PostgreSQL con `Bun.sql` en TC-002 y TC-004. Eliminación de la referencia a `tcp-trip.db`. Resolución de Q-001 y Q-002. Adición de TC-011 a TC-013 (restricciones de roles y administración). Adición de TC-014 a TC-016 (restricciones de base de datos). Adición de UX-005 (panel admin sin requisito de móvil). Adición de AS-005 (administrador es el mismo equipo). Actualización de riesgos: R-001 reemplaza la incompatibilidad de `better-sqlite3` por la complejidad de migración a PostgreSQL. Adición de R-006 (cuello de botella en aprobación de roles). Resolución de Q-005. Adición de Q-006 y Q-007. |
| 1.2 | 2026-04-14 | Resolución de Q-003 (modo offline no requerido; conectividad de aula asumida estable). Resolución de Q-004 (ejercicios no son corregidos automáticamente en V2.0/V2.1; corrección es manual). Adición de AS-009 (conectividad a internet en aula como suposición para Modo Clase y generación de ejercicios). Adición de TC-018 (restricción sobre librería PDF para exportación de ejercicios). Adición de TC-019 (sin corrección automática en V2.0/V2.1). Adición de TC-020 (distribución de ejercicios es externa a la plataforma en V2.0). Adición de Q-008 (selección de librería PDF compatible con Bun). |
| 1.3 | 2026-04-14 | Resolución de Q-006 (despliegue: Cloudflare + Neon preferido; Docker Compose como alternativa — ADR-006). Resolución de Q-007 (email via Clerk — D-05). Adición de restricciones TC-018 a TC-020 (idioma por defecto ES, sin migración SQLite, mecanismo de resiliencia Clerk↔BD). Adición de sección 6 con restricciones derivadas de D-01 a D-06. |
