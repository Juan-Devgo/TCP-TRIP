# Roadmap del Producto — TCP-TRIP

**Versión:** 1.2  
**Fecha:** 2026-04-14  
**Estado:** Aprobado

---

## Filosofía del Roadmap

Este roadmap está organizado en releases temáticos con objetivos de valor claros. Dado que TCP-TRIP es un Trabajo de Grado desarrollado por un equipo pequeño (1-2 personas), los releases son secuenciales y el alcance de cada uno está acotado para garantizar entregables de calidad.

Los semestres universitarios colombianos se abrevian así: **S1** = enero–junio, **S2** = julio–diciembre.

La versión que se presenta ante el jurado de Trabajo de Grado es **V2.0**. La **V2.1** incorpora correcciones y mejoras posteriores al feedback del jurado.

---

## V1.0 — Fundamentos

**Objetivo:** Consolidar y completar todo lo que ya existe o está casi terminado. Al final de V1.0 la plataforma tiene un flujo de estudiante funcional de punta a punta: explorar TCP/IP, usar herramientas, construir protocolos y gestionar su cuenta. No incluye mensajes entre usuarios, docentes ni administrador.

**Segmento impactado:** Estudiante universitario de redes (usuario autónomo).

**Fecha objetivo:** 2026-S1 (enero–junio 2026)

**Épicas cubiertas:** E-001, E-002, E-003, E-008

---

### Backlog V1.0

| ID | Historia | Épica | Prioridad | Complejidad | Estado |
|----|----------|-------|-----------|-------------|--------|
| US-001 | Landing page con propuesta de valor | E-008 | Must | S | Hecho |
| US-002 | Navegación desde el menú principal | E-008 | Must | S | Hecho |
| US-003 | Registro e inicio de sesión con Clerk | E-008 | Must | S | Hecho |
| US-004 | Vista general del modelo TCP/IP | E-001 | Must | S | Por hacer |
| US-005 | Detalle Capa de Aplicación | E-001 | Must | S | Por hacer |
| US-006 | Detalle Capa de Transporte | E-001 | Must | S | Por hacer |
| US-007 | Detalle Capa de Red | E-001 | Must | S | Por hacer |
| US-008 | Detalle Capa de Enlace y Física | E-001 | Should | S | Por hacer |
| US-009 | Conversor de bases numéricas | E-002 | Must | S | Hecho |
| US-010 | Conversor ASCII | E-002 | Must | S | Hecho |
| US-011 | Calculadora IPv4 | E-002 | Must | M | Hecho |
| US-012 | Crear protocolo con campos personalizados | E-003 | Must | L | Hecho |
| US-013 | Editar campo existente en el protocolo | E-003 | Must | M | Hecho |
| US-014 | Reordenar y eliminar campos | E-003 | Must | S | Hecho |
| US-015 | Diagrama de bits en tiempo real | E-003 | Must | L | Hecho |
| US-016 | Guardar protocolo en cuenta (PostgreSQL) | E-003 | Must | M | Hecho |
| US-017 | Exportar protocolo como JSON | E-003 | Should | S | Hecho |
| US-018 | Compartir protocolo con código único | E-003 | Should | M | Hecho |
| US-019 | Ver y gestionar mis protocolos | E-003 | Must | M | Hecho |
| US-020 | Ver protocolo compartido y clonarlo | E-003 | Could | M | Parcialmente implementado |

**Leyenda de complejidad:** S = Small (< 4h), M = Medium (4-8h), L = Large (1-3 días)

---

### Tareas Técnicas Transversales V1.0

| # | Tarea | Prioridad | Estado |
|---|-------|-----------|--------|
| T-001 | Auditoría completa de cobertura i18n (ES/EN en todos los componentes React y páginas Astro) | Must | Por hacer |
| T-002 | Verificar y completar rutas `/es/*` para todas las páginas sin equivalente en español | Must | Por hacer |
| T-003 | Validar responsividad mobile en todas las páginas (viewport < 768px) | Should | Por hacer |
| T-004 | Migrar base de datos a PostgreSQL con `Bun.sql` — reemplazar toda referencia a SQLite/better-sqlite3 | Must | Por hacer |
| T-005 | Agregar manejo global de errores en las API routes (respuestas 500 descriptivas) | Should | Por hacer |
| T-006 | Revisar flujo completo de edición por `/protocol-creator/header/[id]` | Must | Por hacer |
| T-007 | Agregar contenido pedagógico a los componentes de capa TCP/IP (AppLayer, TransportLayer, NetworkLayer, DataLinkLayer, PhysicalLayer) | Must | Por hacer |

---

### Criterio de salida de V1.0

- Todas las historias Must de V1.0 en estado "Hecho".
- Migración a PostgreSQL con `Bun.sql` completada (T-004).
- Cobertura i18n ES/EN verificada (T-001).
- Al menos una sesión informal de validación con un usuario real (compañero o docente conocido).
- Sin errores críticos en las rutas de API de protocolos.

---

## V1.1 — Colaboración Estudiantil

**Objetivo:** Habilitar la comunicación entre estudiantes usando los protocolos que construyeron. Al final de V1.1 un estudiante puede enviar un mensaje estructurado a otro usando su propio protocolo como plantilla, ver sus mensajes recibidos y enviados, y clonar protocolos compartidos por otros.

**Segmento impactado:** Estudiantes que interactúan entre sí dentro de la plataforma.

**Fecha objetivo:** 2026-S2 (julio–diciembre 2026)

**Prerrequisitos:** V1.0 completa con PostgreSQL en producción.

**Épicas cubiertas:** E-004

---

### Backlog V1.1

| ID | Historia | Épica | Prioridad | Complejidad | Estado |
|----|----------|-------|-----------|-------------|--------|
| US-021 | Componer y enviar mensaje con protocolo | E-004 | Should | L | Por hacer |
| US-022 | Bandeja de entrada de mensajes | E-004 | Should | M | Hecho |
| US-023 | Bandeja de enviados | E-004 | Should | S | Hecho |
| US-024 | Badge de mensajes no leídos en Navbar | E-004 | Could | S | Por hacer |

---

### Criterio de salida de V1.1

- Flujo completo de envío y recepción de mensajes funcional (US-021 a US-023).
- Cobertura i18n completa en la sección de mensajes.
- Al menos una ronda de prueba con dos usuarios reales intercambiando mensajes.
- Sin regresiones en las funcionalidades de V1.0.

---

## V2.0 — MVP Completo (Presentación inicial ante jurado)

**Objetivo:** Entregar el producto completo según el alcance del Trabajo de Grado. Incluye la experiencia docente, el rol con validación por administrador y el panel de administración. Esta versión se presenta en la **sustentación inicial de Trabajo de Grado en el primer período académico de 2027 (2027-S1)**.

**Segmento impactado:** Estudiantes, docentes universitarios, administrador de la plataforma.

**Fecha objetivo:** 2027-S1 (enero–junio 2027)

**Prerrequisitos:** V1.1 completa y validada con al menos un grupo de usuarios reales.

**Épicas cubiertas:** E-005 (Modo Clase), E-006 (Generación de Ejercicios), E-007 (Gestión de Roles), E-009 (Panel de Administración)

---

### Backlog V2.0

| ID | Historia | Épica | Prioridad | Complejidad | Estado |
|----|----------|-------|-----------|-------------|--------|
| US-025 | Solicitar el rol de docente desde el perfil | E-007 | Must | M | Por hacer |
| US-026 | Ver y gestionar la lista de usuarios | E-009 | Must | M | Por hacer |
| US-027 | Banear y desbanear una cuenta de usuario | E-009 | Should | M | Por hacer |
| US-028 | Revisar y aprobar solicitudes de rol docente | E-009 | Must | M | Por hacer |
| US-029 | Resumen del estado de la plataforma (panel admin) | E-009 | Should | S | Por hacer |
| US-030 | Activar el modo clase / presentación para docentes | E-005 | Should | L | Por hacer |
| US-032 | Generar ejercicios desde el conversor de bases numéricas | E-006 | Could | L | Por hacer |
| US-033 | Generar ejercicios desde la calculadora IPv4 | E-006 | Could | L | Por hacer |
| US-034 | Generar ejercicios desde el conversor ASCII | E-006 | Could | L | Por hacer |
| US-035 | Generar ejercicio basado en un protocolo del constructor | E-006 | Could | XL | Por hacer |
| US-036 | Exportar ejercicios como documento con presentación profesional (PDF) | E-006 | Could | L | Por hacer |
| US-037 | Crear ejercicio personalizado con pregunta redactada por el docente | E-006 | Could | M | Por hacer |

> US-031 (marcador de alcance previo para generación de ejercicios de subnetting) queda subsumida por US-033 (generación desde ipv4-calculator) con mayor detalle. US-038 y US-039 (biblioteca y registro de uso) se trasladan a V2.1.

**Dependencias internas de E-006 en V2.0:**
- US-032, US-033, US-034, US-035 requieren que el motor de generación esté implementado (T-012).
- US-036 (exportación PDF) requiere resolución de Q-008 (librería PDF compatible con Bun) como prerequisito técnico.
- US-037 (ejercicio personalizado) puede desarrollarse en paralelo con el motor, ya que no depende de generación automática.

---

### Tareas Técnicas Transversales V2.0

| # | Tarea | Prioridad | Estado |
|---|-------|-----------|--------|
| T-008 | Implementar middleware de verificación de rol `teacher` y `admin` en rutas protegidas | Must | Por hacer |
| T-009 | Diseñar y crear tabla `role_requests` en PostgreSQL | Must | Por hacer |
| T-010 | Proteger rutas `/admin/*` en middleware verificando rol `admin` | Must | Por hacer |
| T-011 | Configurar identificación del administrador via Clerk `privateMetadata` o variable de entorno | Must | Por hacer |
| T-012 | Diseñar y construir el motor de generación de ejercicios: módulo de servidor que recibe parámetros (componente, cantidad, nivel, incluir solución) y produce ejercicios con soluciones estructuradas | Could | Por hacer |
| T-013 | Diseñar y crear tablas `exercises` y `exercise_usage_log` en PostgreSQL con los campos de trazabilidad definidos en E-006 | Could | Por hacer |
| T-014 | Evaluar y seleccionar librería de generación de PDF compatible con Bun (Q-008). Prototipar la exportación de un ejercicio simple antes de integrar en el flujo completo | Could | Por hacer |

---

### Criterio de salida de V2.0

- El flujo de solicitud y aprobación de rol docente funciona de punta a punta.
- El panel de administración permite listar usuarios y resolver solicitudes de docente.
- El modo clase es funcional y validado en al menos una demostración con proyector.
- El motor de generación de ejercicios produce ejercicios válidos para al menos dos componentes (base-converter e ipv4-calculator como mínimo).
- La exportación de ejercicios como PDF es funcional con la librería seleccionada (Q-008 resuelta).
- Sin errores críticos en ninguna funcionalidad Must.
- Documentación técnica y de producto actualizada para la sustentación.

---

## V2.1 — Versión para Jurado (Post-presentación)

**Objetivo:** Incorporar correcciones, mejoras y observaciones derivadas de la presentación inicial de V2.0 ante el jurado. Adicionalmente, completar las funcionalidades de gestión avanzada de la biblioteca de ejercicios (US-038 y US-039) que se trasladaron de V2.0. Esta versión es la que queda como entregable final del Trabajo de Grado.

**Segmento impactado:** Jurado evaluador, comunidad de usuarios existente, docentes (gestión de biblioteca de ejercicios).

**Fecha objetivo:** 2027-S2 (julio–diciembre 2027)

**Prerrequisitos:** V2.0 presentada. Feedback del jurado documentado.

**Alcance base (independiente del feedback del jurado):**

| ID | Historia | Épica | Prioridad | Complejidad | Estado |
|----|----------|-------|-----------|-------------|--------|
| US-038 | Ver y gestionar la biblioteca de ejercicios con metadatos de trazabilidad | E-006 | Could | M | Por hacer |
| US-039 | Registrar el uso de un ejercicio en una clase o grupo | E-006 | Could | M | Por hacer |

**Alcance adicional determinado por el feedback del jurado:** Puede incluir:
- Correcciones de errores identificados en la presentación.
- Mejoras de UX solicitadas.
- Features adicionales especificados como criterio de aprobación por el jurado.
- Mejora de cobertura de pruebas si se requiere.
- Refinamiento de documentación técnica.
- Extensión del motor de generación de ejercicios a componentes adicionales (ascii-converter o protocol-builder) si no quedaron completamente cubiertos en V2.0.

---

## V3.0 — Plataforma Avanzada (Futuro post-grado)

**Objetivo:** Convertir TCP-TRIP en una plataforma de referencia para la enseñanza de protocolos de red si el proyecto continúa post-tesis.

**Fecha objetivo:** Indefinida (post-grado)

**Funcionalidades candidatas:**
- Calculadora IPv6 (subnetting, notación compacta, tipos de direcciones).
- Notificaciones en tiempo real para mensajes nuevos (WebSocket via `Bun.serve`).
- Integración con LMS (Moodle/Canvas) para sincronización de calificaciones.
- Comentarios y anotaciones en protocolos públicos.
- Simulación básica de tráfico de red (animación de campos del protocolo en tránsito).
- Editor de protocolos basado en RFC reales (importar estructura desde RFC).
- Grupos/cursos: el docente crea un grupo y los estudiantes se inscriben.
- Jerarquía de roles de administración (más de un admin).

---

## Mapa Visual del Roadmap

```
2026-S1              2026-S2              2027-S1                    2027-S2              Futuro
──────────────────   ──────────────────   ────────────────────────   ──────────────────   ──────────
V1.0 Fundamentos     V1.1 Colaboración    V2.0 MVP Completo          V2.1 Jurado          V3.0+
──────────────────   ──────────────────   ────────────────────────   ──────────────────   ──────────
Landing / Navbar     Sistema mensajes     Rol docente (E-007)        Correcciones         Calc. IPv6
TCP/IP Explorer      (contenido E-004)    Solicitud de rol           post-jurado          WebSockets
Herramientas         Clonar protocolos    Panel admin (E-009)        Biblioteca ejerc.    LMS
Constructor          Badge no leídos      Aprobación manual          (US-038, US-039)     Simulación
Auth Clerk                                Modo clase (E-005)         + features jurado    Grupos/cursos
PostgreSQL + Bun.sql                      Generación ejerc. (E-006)                       Corrección auto
i18n completa                             base-converter                                  Asignación
                                          ascii-converter                                 estudiantes
                                          ipv4-calculator
                                          protocol-builder
                                          Exportación PDF
                                          Ejerc. personalizado
```

---

## Criterios de Paso entre Versiones

### V1.0 → V1.1
- Todas las historias Must de V1.0 en estado "Hecho".
- Migración a PostgreSQL con `Bun.sql` completada.
- Cobertura i18n ES/EN al 100 %.
- Al menos una sesión de validación con usuario real.
- Sin errores críticos en la API de protocolos.

### V1.1 → V2.0
- Flujo completo de mensajes funcional (envío, recepción, bandeja).
- Al menos una ronda de prueba con dos usuarios reales intercambiando mensajes.
- Sin regresiones en funcionalidades de V1.0.

### V2.0 → V2.1
- V2.0 presentada ante el jurado.
- Feedback del jurado documentado y procesado en el backlog de V2.1.
- Sin errores críticos bloqueadores identificados por el jurado.

---

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-04-14 | Versión inicial con estructura V1.0 → V1.1 → V1.2 → V2.0 |
| 1.1 | 2026-04-14 | Reestructuración completa del roadmap. V1.0 pasan a ser los fundamentos actuales. V1.1 es colaboración estudiantil (mensajes). V2.0 es el MVP completo para presentación inicial en 2027-S1. V2.1 es la versión para jurado. V3.0 es el horizonte post-grado. Migración de referencias de SQLite a PostgreSQL con Bun.sql. Adición de E-009 (Panel de Administración) en V2.0. Corrección de estados: las historias de /tcp-ip/* pasan a "Por hacer". |
| 1.2 | 2026-04-14 | Expansión del backlog de V2.0 con las historias completas de E-006 (US-032 a US-037): generación desde base-converter, ipv4-calculator, ascii-converter, protocol-builder; exportación PDF; ejercicio personalizado. US-031 (marcador previo) subsumida por US-033. US-038 y US-039 (biblioteca y registro de uso) posicionadas en V2.1 como alcance base junto con las correcciones post-jurado. Adición de tareas técnicas T-012 a T-014 (motor de generación, tablas de ejercicios, selección de librería PDF). Actualización del criterio de salida de V2.0 con entregables de E-006. Actualización del mapa visual del roadmap. |
