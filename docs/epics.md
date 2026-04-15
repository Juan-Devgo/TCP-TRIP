# Épicas del Producto — TCP-TRIP

**Versión:** 1.2  
**Fecha:** 2026-04-14  
**Estado:** Aprobado

---

## Convención de IDs

Las épicas se numeran `E-XXX`. Las historias de usuario derivadas de cada épica siguen el formato `US-XXX` (ver `user-stories.md`).

**Niveles de prioridad MoSCoW:**
- **Must Have:** Indispensable para la versión objetivo indicada.
- **Should Have:** Importante, se incluye si el tiempo lo permite en la versión objetivo.
- **Could Have:** Deseable para versiones posteriores.
- **Won't Have (versión actual):** Explícitamente fuera de la versión actual.

**Estado de implementación:**
- **Construido:** Implementado y funcional en la rama actual.
- **Parcialmente construido:** Existe infraestructura o componentes, pero faltan funcionalidades clave.
- **Por construir:** No existe ninguna implementación.

---

## E-001: Explorador del Modelo TCP/IP

**Título:** Explorador interactivo del modelo TCP/IP por capas  
**Descripción:** Sección informativa y visual que presenta el modelo TCP/IP con sus cuatro capas (Aplicación, Transporte, Red, Acceso a Red / Enlace de datos, Física). Cada capa tiene su propia página con descripción, protocolos principales, rol en la comunicación y recursos pedagógicos. Sirve como referencia teórica integrada dentro de la misma plataforma.

**Roles involucrados:** Estudiante (consulta), Docente (referencia durante exposición en clase)

**Valor de negocio:** Ancla la plataforma como recurso educativo completo, no solo una colección de herramientas. Permite que el estudiante consulte teoría y practique con las herramientas en el mismo entorno.

**Prioridad MoSCoW:** Must Have  
**Estado de implementación:** Parcialmente construido  
**Versión objetivo:** V1.0

**Notas de implementación:**
- Existen componentes Astro para cada capa: `AppLayer.astro`, `TransportLayer.astro`, `NetworkLayer.astro`, `DataLinkLayer.astro`, `PhysicalLayer.astro`.
- Rutas disponibles en `/tcp-ip/*` y `/es/tcp-ip/*`.
- Los componentes existen pero **no tienen contenido aún**. Las páginas de cada capa están por completar.
- Pendiente: agregar contenido pedagógico real a cada componente de capa y asegurar cobertura bilingüe completa.

**Historias relacionadas:** US-004, US-005, US-006, US-007, US-008

---

## E-002: Herramientas de Conversión y Cálculo

**Título:** Conversor de bases numéricas, conversor ASCII y calculadora de subredes IPv4  
**Descripción:** Conjunto de herramientas interactivas de uso frecuente en el dominio de redes. Incluye: (1) conversor de números entre bases binaria, octal, decimal y hexadecimal; (2) conversor ASCII ↔ texto; (3) calculadora de subredes IPv4 que determina dirección de red, broadcast, máscara, rango de hosts y número de subredes. Cada herramienta tiene contexto pedagógico integrado que explica para qué se usa en el contexto de protocolos de red.

**Roles involucrados:** Estudiante (uso principal), Docente (demostración en clase)

**Valor de negocio:** Elimina la necesidad de herramientas externas genéricas. El contexto pedagógico integrado diferencia TCP-TRIP de calculadoras online sin propósito educativo.

**Prioridad MoSCoW:** Must Have  
**Estado de implementación:** Parcialmente construido  
**Versión objetivo:** V1.0

**Notas de implementación:**
- `NumberBaseConverter.astro` — conversor de bases numéricas, implementado.
- `AsciiConverter.astro` — conversor ASCII, implementado.
- `Ipv4Calculator.tsx` — calculadora IPv4 en React, implementada.
- Rutas: `/converters/base-converter`, `/converters/ascii-converter`, `/calculators/Ipv4Calculator`.
- Pendiente: validar que todas las rutas tengan equivalente en español (`/es/...`) y que el contenido pedagógico contextual esté presente en cada herramienta.
- **Fuera de V1.0–V2.1:** Calculadora IPv6 (objetivo V3.0).

**Historias relacionadas:** US-009, US-010, US-011

---

## E-003: Constructor de Protocolos — Estudiantes

**Título:** Creación, edición, guardado y compartición de encabezados de protocolo personalizados  
**Descripción:** Funcionalidad central de la plataforma. Permite al estudiante diseñar un encabezado de protocolo de red de forma visual: agregar campos con tipo de dato (uint, flags, ascii, hex, ipv4, enum, padding, composite), definir su tamaño en bytes o bits, asignar un significado pedagógico, reordenar campos y visualizar el encabezado en un diagrama de bits en tiempo real. El protocolo diseñado se puede guardar en la cuenta del usuario, editarse posteriormente, exportarse como JSON y compartirse con otros usuarios mediante un código único.

**Roles involucrados:** Estudiante (creación y uso), Docente (revisión y uso como material pedagógico)

**Valor de negocio:** Es la propuesta de valor diferenciadora de TCP-TRIP. No existe otra herramienta educativa en español que permita construir encabezados de protocolo de forma visual e interactiva.

**Prioridad MoSCoW:** Must Have  
**Estado de implementación:** Parcialmente construido  
**Versión objetivo:** V1.0

**Notas de implementación:**
- `ProtocolBuilder.tsx` — editor principal con 27 sub-componentes, implementado.
- Tipos de campo soportados: `uint`, `flags`, `ascii`, `hex`, `ipv4`, `enum`, `padding`, `composite`.
- Diagrama visual de bits: `HeaderVisualization.tsx`, implementado.
- API: `GET/POST /api/protocols`, `GET/PUT/DELETE /api/protocols/[id]`, `POST /api/protocols/[id]/share`, `GET /api/protocols/shared/[shareCode]`.
- `MyProtocolsList.tsx` — gestión de protocolos guardados, implementado.
- Ruta pública: `/protocols/[shareCode]` para ver protocolos compartidos.
- Pendiente: flujo completo de edición vía `/protocol-creator/header/[id]` y verificar integración con `HeaderCreator.tsx`.
- Pendiente: internacionalización de textos dentro de `ProtocolBuilder.tsx` y sus sub-componentes.
- La base de datos usa **PostgreSQL** via `Bun.sql`. Los campos del protocolo se almacenan como JSON en una columna de tipo `jsonb`.

**Historias relacionadas:** US-012, US-013, US-014, US-015, US-016, US-017, US-018, US-019, US-020

---

## E-004: Sistema de Mensajes con Protocolos

**Título:** Envío y recepción de mensajes estructurados usando encabezados de protocolo  
**Descripción:** Permite a los usuarios autenticados enviarse mensajes entre sí usando un protocolo previamente creado como plantilla. El remitente selecciona un protocolo, completa los valores de cada campo del encabezado (según el tipo de campo definido) y adjunta un payload de texto libre. El receptor puede ver el mensaje recibido con el encabezado completo y decodificado. Se dispone de bandeja de entrada y bandeja de enviados. Los mensajes incluyen un snapshot del protocolo en el momento del envío para garantizar consistencia aunque el protocolo sea editado después.

**Roles involucrados:** Estudiante (envío y recepción), Docente (puede usar para enviar ejercicios)

**Valor de negocio:** Convierte el aprendizaje pasivo (construir un protocolo) en aprendizaje activo (usarlo para comunicarse), reforzando la comprensión del ciclo completo de un protocolo de red.

**Prioridad MoSCoW:** Should Have  
**Estado de implementación:** Parcialmente construido  
**Versión objetivo:** V1.1

**Notas de implementación:**
- `MessagesView.tsx` — vista de bandeja de entrada y enviados, implementado.
- API: `GET/POST /api/messages`, `PUT /api/messages/[id]/read`, `GET /api/users/search`.
- Tabla `messages` en **PostgreSQL** con columna `protocol_snapshot` de tipo `jsonb` para consistencia temporal.
- Búsqueda de destinatario por correo electrónico usando API de Clerk: `GET /api/users/search`.
- Pendiente: interfaz para componer un mensaje nuevo con selector de protocolo y editor de valores de campos.
- Pendiente: notificación visual de mensajes no leídos en navbar.
- Pendiente: internacionalización de la vista de mensajes.

**Historias relacionadas:** US-021, US-022, US-023, US-024

---

## E-005: Modo Clase / Presentación — Docentes

**Título:** Interfaz de presentación optimizada para proyección en aula  
**Descripción:** Modo alternativo de la plataforma activable por el docente que adapta la interfaz para su uso en proyector: fondo blanco o de alto contraste, tipografía grande, navegación tipo diapositiva (avanzar/retroceder), ocultamiento de elementos de navegación secundarios y enfoque en el contenido pedagógico. El docente puede recorrer cualquier sección de la plataforma (explorador de capas, herramientas, constructor de protocolos) en este modo sin modificar la experiencia de los estudiantes.

**Roles involucrados:** Docente (usuario principal)

**Valor de negocio:** Habilita el uso de TCP-TRIP como herramienta de clase activa, no solo como recurso de estudio autónomo. Amplía el mercado del producto de estudiantes individuales a instituciones educativas.

**Prioridad MoSCoW:** Should Have  
**Estado de implementación:** Por construir  
**Versión objetivo:** V2.0

**Notas de implementación:**
- Requiere definición del rol de docente (ver E-007) y aprobación por administrador (ver E-009).
- Implica una capa de presentación adicional sobre la UI existente, posiblemente implementada como un parámetro de URL o estado global.
- No requiere cambios en la base de datos ni en las APIs.
- Considerar impacto en el sistema de i18n: los textos del modo presentación deben estar cubiertos.

---

## E-006: Generación de Ejercicios — Docentes

**Título:** Creación, gestión y exportación de ejercicios evaluativos derivados de las herramientas de la plataforma  
**Descripción:** Permite al docente con rol aprobado generar ejercicios estructurados directamente desde los componentes de apoyo de la plataforma (conversor de bases, conversor ASCII, calculadora IPv4, constructor de protocolos). El docente especifica la cantidad de ejercicios a generar, el componente origen, si se incluye la solución con procedimiento paso a paso, y puede además redactar preguntas personalizadas (no solo auto-generadas). Cada ejercicio queda almacenado en la biblioteca del docente con metadatos de trazabilidad completos. El resultado final es un documento con presentación profesional (no un JSON crudo) listo para compartir digitalmente, copiar al portapapeles o descargar como PDF.

**Roles involucrados:** Docente (creación y gestión), Estudiante (resolución — fuera del alcance de V2.0, ver V3.0)

**Valor de negocio:** Cierra el ciclo pedagógico completo: aprender → practicar → ser evaluado, todo dentro de la misma plataforma. Reduce significativamente el tiempo que el docente invierte en preparar materiales de evaluación, al generar automáticamente ejercicios con procedimiento de solución a partir de las mismas herramientas que los estudiantes usan para aprender.

**Prioridad MoSCoW:** Could Have  
**Estado de implementación:** Por construir  
**Versión objetivo:** V2.0

---

### Componentes soportados para generación de ejercicios en V2.0

| Componente | Tipo de ejercicio generado | Ejemplo concreto |
|------------|---------------------------|-----------------|
| `base-converter` | Conversión entre bases numéricas | "Convierta 192 (decimal) a hexadecimal. Muestre el procedimiento de división sucesiva." |
| `ascii-converter` | Codificación y decodificación ASCII | "¿Cuál es la representación hexadecimal del carácter 'R' en ASCII? Justifique." |
| `ipv4-calculator` | Subnetting IPv4 | "Dada la dirección 172.16.5.0/20, determine: dirección de red, broadcast, rango de hosts y número de subredes posibles." |
| `protocol-builder` | Interpretación de encabezados de protocolo | "Dado el siguiente encabezado en formato de bits, identifique el valor del campo Puerto Origen." |

El diseño es extensible: nuevos componentes de la plataforma pueden incorporarse como fuentes de ejercicios en versiones futuras sin cambiar la arquitectura del motor de generación.

---

### Estructura de metadatos de trazabilidad de un ejercicio

Cada ejercicio almacenado en la biblioteca del docente incluye los siguientes metadatos:

| Campo | Descripción |
|-------|-------------|
| `id` | Identificador único del ejercicio |
| `title` | Título descriptivo asignado por el docente |
| `source_component` | Componente origen: `base-converter`, `ascii-converter`, `ipv4-calculator`, `protocol-builder` |
| `created_at` | Fecha y hora de creación |
| `status` | Estado del ejercicio: `draft` (borrador), `published` (publicado), `archived` (archivado) |
| `include_solution` | Booleano: indica si el ejercicio incluye la solución con procedimiento paso a paso |
| `parent_exercise_id` | Referencia al ejercicio padre si este fue creado como variación de uno existente (nullable) |
| `usage_log` | Historial de uso: registros de en qué clases o grupos fue utilizado (arreglo de entradas con fecha, grupo y descripción) |
| `is_custom` | Booleano: indica si la pregunta fue redactada manualmente por el docente (no auto-generada) |

---

### Formato del documento de salida

El documento generado debe cumplir los siguientes requisitos de presentación:

- Encabezado con: título del ejercicio, componente origen, fecha de generación y nombre del docente.
- Enunciado del ejercicio redactado en lenguaje claro, sin exponer la estructura interna del sistema.
- Si `include_solution = true`: sección de solución con cada paso del procedimiento explicado explícitamente (p. ej., cada división para conversión de bases, cada operación AND/OR para subnetting).
- Tipografía y maquetación de calidad equivalente a un material de clase imprimible.
- Opciones de exportación: descarga como PDF, copia al portapapeles en formato de texto enriquecido.

---

### Notas de implementación

- **Prerequisitos:** Rol de docente aprobado (E-007 + E-009). Sin rol `teacher` confirmado en `publicMetadata` de Clerk, las rutas de generación de ejercicios deben devolver 403.
- **Motor de generación:** Nuevo módulo del servidor que recibe parámetros de entrada (componente, cantidad, nivel de dificultad, incluir solución) y produce el conjunto de ejercicios con sus soluciones.
- **Modelo de datos:** Nueva tabla `exercises` en PostgreSQL con los campos de trazabilidad descritos arriba. Tabla `exercise_usage_log` para el historial de uso por clase o grupo.
- **Generación de PDF:** Requiere una librería de generación de documentos compatible con Bun. Candidatos: `pdf-lib` (manipulación de PDF puro, compatible con Bun) o renderizado HTML → PDF mediante un navegador headless. La decisión técnica concreta es responsabilidad del Arquitecto.
- **Corrección automática:** Fuera del alcance de V2.0. Los ejercicios se exportan para corrección manual por el docente. La corrección automatizada es candidata para V3.0.
- **Asignación directa a estudiantes:** Fuera del alcance de V2.0. La distribución del ejercicio es externa a la plataforma (el docente descarga el PDF y lo comparte por sus canales habituales).
- Alta complejidad de implementación. Requiere diseño arquitectónico dedicado antes de iniciar el desarrollo.
- Se recomienda iniciar con el componente `base-converter` como prueba de concepto del motor, y extender a los demás componentes de forma incremental.

**Historias relacionadas:** US-032, US-033, US-034, US-035, US-036, US-037, US-038, US-039

---

## E-007: Gestión de Usuarios y Roles

**Título:** Distinción entre roles de estudiante y docente; solicitud y control de acceso  
**Descripción:** Implementación del sistema de roles dentro de la plataforma: estudiante (por defecto) y docente. El rol determina el acceso a funcionalidades (el modo clase y la generación de ejercicios son exclusivos de docentes). Un usuario con cuenta de estudiante puede **solicitar el rol docente** desde su perfil; esa solicitud queda pendiente hasta que el administrador la apruebe o rechace desde el Panel de Administración (E-009). El sistema incluye: flujo de solicitud desde el perfil, almacenamiento del estado de solicitud, y control de acceso basado en rol en las rutas protegidas.

**Roles involucrados:** Estudiante (solicitante), Docente (rol resultante), Administrador (aprobador)

**Valor de negocio:** Prerequisito técnico para E-005 y E-006. Sin roles diferenciados no se puede construir la experiencia docente. La validación manual por admin previene el acceso no autorizado a funcionalidades de docente.

**Prioridad MoSCoW:** Should Have  
**Estado de implementación:** Por construir  
**Versión objetivo:** V2.0

**Notas de implementación:**
- Autenticación actual con Clerk ya provee `userId`. Clerk soporta metadata de usuario mediante `publicMetadata` o `privateMetadata`.
- El rol aprobado puede almacenarse en `publicMetadata` de Clerk (recomendado) para evitar una tabla de usuarios adicional.
- Las solicitudes de rol docente deben persistirse en **PostgreSQL** (tabla `role_requests`) con estado: `pending`, `approved`, `rejected`.
- El middleware de Astro (`middleware.ts`) usa `clerkMiddleware()` y puede extenderse para verificar roles desde `publicMetadata`.
- Las rutas de docente deben protegerse tanto en el servidor (middleware) como en el cliente (condicionales de UI).
- **Restricción de seguridad:** la asignación de rol de docente no es autoservicio. Es siempre resultado de aprobación explícita por el administrador. Un usuario no puede autoelevarse a rol docente.

**Historias relacionadas:** US-025 (en backlog V2.0, a crear)

**Dependencias:** E-009 (Panel de Administración) — la aprobación ocurre allí.

---

## E-008: Página de Inicio y Onboarding

**Título:** Landing page, navegación principal y experiencia de primer uso  
**Descripción:** Página de inicio que presenta la plataforma, sus funcionalidades principales y un llamado a la acción claro (registro/inicio de sesión). Incluye sección de características, vista del modelo TCP/IP y navegación principal (Navbar) con acceso a todas las secciones. El onboarding cubre la experiencia del usuario nuevo: primer acceso, creación de cuenta y orientación inicial.

**Roles involucrados:** Estudiante, Docente (visitante no autenticado y recién registrado)

**Valor de negocio:** Es la primera impresión del producto. Una landing page clara reduce la fricción de adopción.

**Prioridad MoSCoW:** Must Have  
**Estado de implementación:** Construido  
**Versión objetivo:** V1.0

**Notas de implementación:**
- `LandingPage.astro` implementado con secciones: hero, features, TCP/IP layers, CTA.
- `Navbar.astro` y `ui/` con componentes de UI, implementados.
- Rutas `/` y `/es` con soporte bilingüe.
- Pendiente: revisar que el CTA lleve correctamente al flujo de registro de Clerk.
- Pendiente: validar responsividad en móvil.

**Historias relacionadas:** US-001, US-002, US-003

---

## E-009: Panel de Administración

**Título:** Panel de superadministrador para gestión de usuarios y validación de roles docentes  
**Descripción:** Interfaz exclusiva del administrador que centraliza las tareas de gobierno de la plataforma: listar todos los usuarios registrados, ver su actividad, aplicar sanciones (banear/desbanear cuentas), y revisar las solicitudes de rol docente para aprobarlas o rechazarlas con comentario opcional. El administrador recibe notificaciones cuando hay solicitudes pendientes. Solo existe un tipo de administrador (superadmin); no hay jerarquía de admins.

**Roles involucrados:** Administrador (único usuario con acceso)

**Valor de negocio:** Garantiza que el acceso al rol de docente —con sus privilegios extendidos— esté siempre validado por un humano responsable. Previene escalada de privilegios y permite responder a comportamientos abusivos en la comunidad.

**Prioridad MoSCoW:** Must Have (para V2.0)  
**Estado de implementación:** Por construir  
**Versión objetivo:** V2.0

**Notas de implementación:**
- El administrador se identifica por un `userId` de Clerk configurado como variable de entorno (`ADMIN_USER_ID`) o por un rol especial `admin` en `privateMetadata` de Clerk.
- Las rutas del panel (`/admin/*`) deben protegerse en el middleware de Astro verificando el rol `admin` antes de permitir el acceso. Cualquier acceso no autorizado redirige a 403.
- Tabla `role_requests` en PostgreSQL: `id`, `user_id`, `requested_at`, `status` (pending/approved/rejected), `reviewed_by`, `reviewed_at`, `comment`.
- La acción de baneo almacena el estado en la tabla `users` o en `privateMetadata` de Clerk. El middleware bloquea el acceso de usuarios baneados.
- **Restricción:** no existe panel de admin en V1.0 ni V1.1. Se construye en V2.0.
- El panel debe mostrar datos en tiempo real (o quasi-real con polling corto) dado que las solicitudes de rol son sensibles al tiempo.

**Historias relacionadas:** US-026, US-027, US-028, US-029 (ver `user-stories.md`)

**Dependencias:** E-007 (Gestión de Roles) — las solicitudes se originan allí.

---

## Resumen de Épicas

| ID | Título | Prioridad | Estado implementación | Versión objetivo |
|----|--------|-----------|----------------------|-----------------|
| E-001 | Explorador del Modelo TCP/IP | Must Have | Parcialmente construido | V1.0 |
| E-002 | Herramientas de Conversión y Cálculo | Must Have | Parcialmente construido | V1.0 |
| E-003 | Constructor de Protocolos — Estudiantes | Must Have | Parcialmente construido | V1.0 |
| E-004 | Sistema de Mensajes con Protocolos | Should Have | Parcialmente construido | V1.1 |
| E-005 | Modo Clase / Presentación — Docentes | Should Have | Por construir | V2.0 |
| E-006 | Generación de Ejercicios — Docentes | Could Have | Por construir | V2.0 (núcleo), V2.1 (biblioteca y gestión avanzada) |
| E-007 | Gestión de Usuarios y Roles | Should Have | Por construir | V2.0 |
| E-008 | Página de Inicio y Onboarding | Must Have | Construido | V1.0 |
| E-009 | Panel de Administración | Must Have (V2.0) | Por construir | V2.0 |

---

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-04-14 | Versión inicial |
| 1.1 | 2026-04-14 | Migración de referencias SQLite a PostgreSQL con Bun.sql en E-003 y E-004. Corrección del estado de implementación de E-001: los componentes de capa existen pero no tienen contenido. Actualización de versiones objetivo: E-004 se mueve a V1.1, E-005/E-006/E-007 se mueven a V2.0. Actualización de E-007 para reflejar que la validación de docente es manual por admin. Adición de E-009 (Panel de Administración). |
| 1.2 | 2026-04-14 | Expansión completa de E-006 (Generación de Ejercicios — Docentes): descripción detallada del feature, tabla de componentes soportados (base-converter, ascii-converter, ipv4-calculator, protocol-builder) con ejemplos concretos, estructura de metadatos de trazabilidad, requisitos del formato del documento de salida y notas de implementación técnica. Resolución de Q-004. Actualización de versión objetivo de E-006 para reflejar distribución V2.0 (núcleo) / V2.1 (gestión avanzada). |
