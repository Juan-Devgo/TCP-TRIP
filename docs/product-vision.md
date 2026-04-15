# Visión del Producto — TCP-TRIP

**Versión:** 1.1  
**Fecha:** 2026-04-14  
**Estado:** Aprobado

---

## Nombre y Tagline

**Nombre:** TCP-TRIP  
**Tagline:** *Tu viaje interactivo al mundo de los protocolos de red.*

---

## Elevator Pitch

TCP-TRIP es una plataforma web educativa bilingüe (español/inglés) orientada a estudiantes universitarios de redes y comunicaciones. Permite explorar el modelo TCP/IP por capas, construir encabezados de protocolos de forma visual, enviar mensajes estructurados usando esos encabezados, y utilizar herramientas de conversión y cálculo propias del dominio de redes. Para los docentes, ofrece un modo de presentación optimizado para proyector y la generación de ejercicios evaluativos derivados de las mismas herramientas de la plataforma. La plataforma incluye un panel de administración para gestión de usuarios y validación manual del rol docente.

---

## Declaración del Problema

Los estudiantes de ingeniería que cursan asignaturas de redes de computadores enfrentan una brecha significativa entre la teoría presentada en libros y la comprensión práctica de cómo funcionan los protocolos de comunicación. Los RFC son documentos densos y difíciles de interpretar sin contexto visual. Las herramientas existentes (Wireshark, calculadoras de subred en línea) están diseñadas para profesionales, no para aprendizaje guiado. Los docentes, por su parte, carecen de plataformas especializadas para preparar y exponer contenido sobre protocolos en el salón de clase con materiales interactivos.

**Consecuencias del problema:**
- Alta tasa de dificultad en temas como subnetting, campos de encabezado TCP/IP, y codificación.
- Clases magistrales poco interactivas porque no existen herramientas pedagógicas específicas del dominio.
- Falta de ejercicios prácticos evaluables que conecten teoría y construcción de protocolos.

---

## Usuarios Objetivo

### Rol 1: Estudiante

**Perfil:** Estudiante universitario de pregrado cursando asignaturas de redes de computadores, telecomunicaciones o afines. Nivel técnico básico-intermedio. Usa la plataforma de forma autónoma o como complemento de clase.

**Objetivos:**
- Entender la estructura de los protocolos de red de forma visual.
- Practicar con herramientas interactivas (calculadoras, conversores) sin necesidad de software externo.
- Crear sus propios protocolos personalizados para reforzar el aprendizaje.
- Compartir protocolos con compañeros y enviar mensajes estructurados para simular comunicación real.

**Puntos de dolor:**
- Los encabezados de protocolo son abstractos y difíciles de visualizar solo con texto.
- No existe una herramienta integrada que combine teoría (capa TCP/IP), construcción (campos de encabezado) y práctica (envío de mensajes).
- Las calculadoras en línea genéricas no tienen contexto pedagógico.

---

### Rol 2: Docente

**Perfil:** Profesor universitario de asignaturas de redes. Necesita preparar y exponer contenido técnico en clase, idealmente con herramientas que los estudiantes también puedan usar. Para obtener el rol de docente en la plataforma, el usuario solicita el rol desde su perfil y un administrador lo aprueba manualmente.

**Objetivos:**
- Presentar protocolos y herramientas de red directamente desde la plataforma en clase (proyector).
- Generar ejercicios y actividades evaluativas a partir de las herramientas existentes.
- Compartir material pedagógico con sus estudiantes de forma estructurada.

**Puntos de dolor:**
- Las diapositivas estáticas no son suficientes para explicar conceptos dinámicos como subnetting o construcción de encabezados.
- No existe un "modo docente" en herramientas educativas de redes que simplifique la interfaz para proyección.
- Crear ejercicios desde cero es costoso en tiempo.

---

### Rol 3: Administrador

**Perfil:** Superadministrador único de la plataforma (no existe jerarquía de admins). Responsable de mantener la salud operativa de la comunidad: gestionar usuarios, aprobar o rechazar solicitudes de rol docente, y actuar ante comportamientos inapropiados.

**Objetivos:**
- Revisar y resolver solicitudes de rol docente de forma expedita.
- Gestionar la comunidad de usuarios (listar, banear/desbanear, ver actividad).
- Mantener la integridad de los datos y el funcionamiento de la plataforma.

**Restricción:** Solo existe un tipo de administrador (superadmin). No hay jerarquía de roles de administración.

---

## Objetivos del Producto

| # | Objetivo | Métrica de éxito |
|---|----------|-----------------|
| 1 | Facilitar la comprensión visual de protocolos de red para estudiantes universitarios | Al menos el 80 % de usuarios completan la creación de un protocolo en su primera sesión sin asistencia |
| 2 | Ofrecer herramientas de cálculo y conversión con contexto pedagógico integrado | Las páginas de herramientas tienen un tiempo de permanencia promedio > 3 minutos |
| 3 | Permitir la colaboración entre estudiantes mediante el envío de mensajes con encabezados estructurados | Al menos el 60 % de usuarios registrados envían al menos un mensaje en el primer mes |
| 4 | Proveer a los docentes un modo de presentación funcional y optimizado | El modo clase está disponible en V2.0 y validado con al menos un grupo de estudiantes reales |
| 5 | Mantener una cobertura bilingüe (ES/EN) completa en todas las pantallas | 100 % de cadenas de texto internacionalizadas antes de cada release |
| 6 | Garantizar control administrativo sobre el acceso al rol docente | El 100 % de las solicitudes de rol docente pasan por aprobación manual de admin antes de V2.0 |

---

## Alcance por Versión

### V1.0 — Fundamentos (2026-S1)

V1.0 se centra en lo que ya existe o está casi terminado. El flujo completo es del **estudiante anónimo y autenticado**. No incluye docentes ni administrador.

Funcionalidades en alcance:
- Página de inicio y navegación principal.
- Explorador interactivo del modelo TCP/IP por capas (páginas de contenido pendientes de completarse).
- Herramientas de conversión: bases numéricas y ASCII.
- Calculadora de subredes IPv4.
- Constructor de protocolos (crear, editar, guardar, compartir encabezados).
- Gestión de protocolos propios (listar, editar, eliminar, compartir vía código).
- Autenticación con Clerk (registro e inicio de sesión).
- Soporte bilingüe ES/EN.

### V1.1 — Colaboración Estudiantil (2026-S2)

- Sistema de mensajes: enviar y recibir mensajes estructurados usando encabezados de protocolo.
- Compartir protocolos con compañeros.
- Vista de mis protocolos mejorada.
- Mejoras de usabilidad derivadas del feedback de V1.0.

### V2.0 — MVP Completo para Presentación (2027-S1)

- Modo clase / presentación para docentes.
- Generación de ejercicios evaluativos.
- Rol docente con solicitud desde el perfil y validación manual por administrador.
- Panel de administración básico: gestión de usuarios y aprobación de roles.
- Esta es la versión que se presentará en el primer período de 2027 (presentación inicial, sin jurado).

### V2.1 — Versión para Jurado (2027-S2)

- Refinamiento post-presentación inicial.
- Correcciones y mejoras según feedback recibido.
- Posibles features adicionales según criterios del jurado.

---

## Fuera de Alcance hasta V3.0

| Funcionalidad | Versión objetivo |
|---------------|-----------------|
| Calculadora IPv6 | V3.0 |
| Integración con LMS (Moodle, Canvas) | V3.0 |
| Notificaciones en tiempo real (WebSocket) para mensajes | V3.0 |
| Comentarios y anotaciones en protocolos compartidos | V3.0 |
| Simulación de tráfico de red | V3.0 |
| Jerarquía de roles de administración | V3.0 |
| Grupos/cursos gestionados por docentes | V3.0 |

---

## Decisiones Arquitectónicas Clave

- **Base de datos:** PostgreSQL, accedida via `Bun.sql` nativo. No se usa SQLite ni `better-sqlite3`.
- **Runtime:** Bun. No se usa Node.js directamente.
- **Autenticación:** Clerk (`@clerk/astro`). Roles almacenados en `publicMetadata` de Clerk o en tabla local de PostgreSQL.
- **Frontend:** Astro 6 (SSR) + React 19 para componentes interactivos.
- **Estilos:** Tailwind CSS v4.

---

## Contexto Académico

TCP-TRIP es el producto central de un **Trabajo de Grado** de pregrado en ingeniería de la Universidad del Quindío. La documentación del producto, la arquitectura del sistema y la calidad del código son evaluados como parte de los criterios académicos. Se priorizan: claridad de diseño, trazabilidad de requisitos, cobertura de pruebas y presentación de resultados ante jurados.

---

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-04-14 | Versión inicial |
| 1.1 | 2026-04-14 | Migración de base de datos a PostgreSQL con Bun.sql. Reestructuración del roadmap: V1.0 son los fundamentos actuales, MVP se mueve a V2.0 para presentación 2027-S1. Adición del Rol 3 (Administrador) y su épica correspondiente. Actualización de la tabla de fuera de alcance por versión. |
