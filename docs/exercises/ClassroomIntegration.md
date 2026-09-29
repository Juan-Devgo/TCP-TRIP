# Integración con Google Classroom — Panel docente

**Features:** `src/features/teacher-exercises/` (Crear / Mis ejercicios) y `src/features/classroom/` (Conexión, Asignar, Mis cursos)
**API:** `src/api/exercises.ts`, `src/api/classroom.ts` (+ `google.ts`, `classroomMapping.ts`; rol verificado con `authorOnly` de `guards.ts`) montados en `src/api/routes.ts`
**Datos:** `src/db/domains/exercise-sets/` (`exercise_sets`, `exercise_set_usages`) y `src/db/domains/classroom/` (`classroom_assignments`, `classroom_announcement_requests`, `classroom_disconnects`)
**Registro de herramientas con ejercicios:** `src/config/exerciseTools.ts`
**Navegación:** grupo de sidebar **Profesor** (`/teacher/*`), visible solo con rol docente — *Ejercicios › Crear* (`/teacher/exercises/new`), *Ejercicios › Mis ejercicios* (`/teacher/exercises/mine`), *Cursos › Mis cursos* (`/teacher/courses/mine`) y *Cursos › Asignar* (`/teacher/courses/assign`); cada uno una pestaña, y el detalle de un curso o de un ejercicio es navegación dentro de su pestaña.

**Prioridad:** Should
**Estado:** En progreso — implementado; pendiente la verificación de extremo a extremo contra un Google Workspace for Education real.

Este documento agrupa cinco historias de usuario que comparten rol, persistencia y conexión. Los criterios marcados *(supuesto)* no salieron de la entrevista y deben confirmarse.

---

## Contexto técnico (Google Classroom API)

Restricciones de la API que condicionan los criterios de aceptación:

- **Autenticación:** Clerk sigue siendo el único sistema de login. La cuenta de Google se conecta como *social connection* con credenciales propias y scopes adicionales; el servidor obtiene el token con `clerkClient.users.getUserOauthAccessToken(userId, 'google')`. El token nunca llega al cliente.
- **Scopes:** `classroom.courses.readonly`, `classroom.rosters.readonly`, `classroom.profile.emails`, `classroom.profile.photos`, `classroom.coursework.students`, `classroom.announcements`, `drive.file` (lista única en `src/lib/classroom.ts`).
- **Cuentas:** la API está pensada para Google Workspace for Education; el administrador del dominio debe permitir el acceso de apps de terceros a Classroom. Los scopes son sensibles: en modo *Testing* se limitan a 100 usuarios de prueba y los tokens expiran a los 7 días; publicar exige verificación de Google.
- **Instrucciones en texto plano:** `description` no admite formato (máx. 30 000 caracteres).
- **Adjuntos creables:** solo archivo de Drive, video de YouTube y enlace (máx. 20). Los archivos locales y los PDF de ejercicios se suben primero a Drive; las presentaciones publicadas viajan como enlace a su lector en TCP-TRIP.
- **Bloqueo por proyecto:** TCP-TRIP solo puede modificar las tareas que él mismo creó y las entregas de esas tareas.

### Configuración requerida

1. **Google Cloud:** habilitar *Google Classroom API* y *Google Drive API*; pantalla de consentimiento OAuth con los scopes de arriba; cliente OAuth *Web* cuyo *redirect URI* es el que indica Clerk.
2. **Clerk:** conexión social Google con *Use custom credentials* (client ID/secret del paso 1) y los mismos scopes en el campo *Scopes*.
3. **Rol docente:** `publicMetadata.role` = `"teacher"` en el usuario de Clerk (ver `docs/users/roles.md`; el administrador no asigna tareas).
4. **`.env`:** `CLERK_SECRET_KEY` (servidor), `PUBLIC_CLERK_PUBLISHABLE_KEY` (ya existente); opcionales `DATABASE_PATH` (por defecto `data/tcp-trip.sqlite`) y `APP_ORIGIN` (origen público con el que se construyen los enlaces a presentaciones cuando el servidor está detrás de un proxy; por defecto, el origen de la petición).
5. **Workspace:** el administrador del dominio debe permitir el acceso de apps de terceros a Classroom.

---

## US-### — Conexión con Google Classroom

- **Como** docente validado que ya usa Google Classroom con sus cursos,
- **Quiero** conectar mi cuenta de Google a TCP-TRIP desde un botón, sin volver a registrarme,
- **Para** asignar y consultar mis cursos sin salir de la aplicación.

### Valor

**Para el estudiante:** recibe en Classroom —donde ya trabaja— los ejercicios generados por las herramientas que usa para practicar, sin cuentas nuevas.

**Para el docente:** una sola conexión habilita todo el panel; deja de copiar y pegar PDFs entre TCP-TRIP y Classroom.

### Criterios de aceptación

**CA-1 — Solo para docentes**
GIVEN un usuario con rol estudiante
WHEN navega por el sidebar
THEN no ve el grupo Docente; y WHEN abre por URL una de sus páginas, THEN ve un aviso de acceso restringido. La verificación del rol ocurre también en el servidor.

**CA-2 — Estado desconectado**
GIVEN un docente sin cuenta de Google conectada con los scopes de Classroom
WHEN abre *Asignar* o *Mis cursos*
THEN ve una explicación breve de qué hará TCP-TRIP con su cuenta y el botón **Conectar Google Classroom**; *Crear ejercicios* y *Mis ejercicios* funcionan sin conexión.

**CA-3 — Conexión incremental**
GIVEN el docente presiona **Conectar Google Classroom**
WHEN completa la pantalla de consentimiento de Google
THEN vuelve a la misma pestaña, ya conectado, y ve sus cursos; si se registró con correo, la cuenta de Google queda vinculada a su mismo usuario.

**CA-4 — Consentimiento rechazado o incompleto**
GIVEN el docente cancela o desmarca permisos en la pantalla de Google
WHEN vuelve a TCP-TRIP
THEN ve un mensaje que nombra qué función queda deshabilitada y la opción de reintentar.

**CA-5 — Token vencido o revocado** *(supuesto)*
GIVEN la autorización de Google ya no es válida
WHEN el docente realiza cualquier acción de Classroom
THEN la acción no se pierde en silencio: ve un mensaje para reconectar y, tras reconectar, puede repetirla.

**CA-6 — Desconectar** *(supuesto)*
GIVEN el docente está conectado
WHEN elige **Desconectar Classroom**
THEN TCP-TRIP deja de acceder a Classroom; sus ejercicios guardados se conservan.

---

## US-### — Crear ejercicios

- **Como** docente que prepara un taller o quiz que mezcla temas del curso,
- **Quiero** combinar ejercicios de varias herramientas —p. ej. 5 del Conversor de Bases y 5 de la Calculadora IPv4— en un solo PDF y guardarlo,
- **Para** producir material evaluable consistente en segundos y reutilizarlo después.

### Valor

**Para el estudiante:** los talleres usan exactamente los mismos tipos de ejercicio que puede generar y autoverificar en cada herramienta, así que la práctica autónoma prepara directamente la evaluación.

**Para el docente:** deja de redactar a mano ejercicios mecánicos y de mantener bancos de ejercicios; su tiempo queda para diseñar preguntas conceptuales.

### Criterios de aceptación

**CA-1 — Interfaz consistente con el generador**
GIVEN el docente abre *Crear ejercicios*
WHEN mira el formulario
THEN encuentra los mismos controles del diálogo de Generar ejercicios (dificultad Fácil / Medio / Difícil, cantidad, interruptor **Incluir respuestas**), más un campo **Título** y una lista de bloques.

**CA-2 — Bloques por herramienta**
GIVEN el formulario está abierto
WHEN el docente agrega un bloque
THEN elige una herramienta que soporte generación de ejercicios, su dificultad y su cantidad; puede agregar varios bloques, incluso de la misma herramienta con otra dificultad, y quitarlos o reordenarlos.

**CA-3 — Validación**
GIVEN el formulario
WHEN no hay título, no hay bloques, algún bloque tiene cantidad fuera de 1–50 o el total supera 100
THEN los campos se marcan inválidos con mensaje traducido y **Generar** queda deshabilitado; el total de ejercicios se muestra en vivo.

**CA-4 — Vista previa y regeneración** *(supuesto)*
GIVEN una configuración válida
WHEN el docente presiona **Generar**
THEN ve la lista de enunciados agrupada por herramienta; puede regenerar un bloque sin tocar los demás antes de guardar.

**CA-5 — PDF por secciones**
GIVEN ejercicios generados
WHEN el docente descarga el PDF
THEN usa la plantilla institucional, con una sección por bloque (nombre de la herramienta y dificultad), numeración continua 1..N y, si **Incluir respuestas** está activo, una única hoja de respuestas al final.

**CA-6 — Guardar congelado**
GIVEN ejercicios generados
WHEN el docente presiona **Guardar**
THEN el ejercicio queda guardado con los enunciados y respuestas exactos (no solo la configuración), su fecha de creación, y aparece en *Mis ejercicios*; volver a descargarlo produce el mismo PDF.

**CA-7 — Bilingüe**
GIVEN el idioma activo
WHEN se genera
THEN la interfaz, los enunciados y el PDF salen en ese idioma; el idioma queda registrado en el ejercicio guardado.

---

## US-### — Asignar en Classroom

- **Como** docente conectado a Classroom,
- **Quiero** crear una tarea con título, instrucciones, adjuntos (incluidos mis ejercicios) y configuración de curso, estudiantes, puntos y fecha límite,
- **Para** entregar el material a mis estudiantes sin salir de TCP-TRIP.

### Valor

**Para el estudiante:** recibe la tarea en Classroom con el PDF adjunto y la fecha límite claras, en el mismo flujo que el resto de su curso.

**Para el docente:** la asignación de ejercicios mecánicos pasa de varios pasos manuales a uno; queda registro de dónde y cuándo usó cada ejercicio.

### Criterios de aceptación

**CA-1 — Estructura de la pantalla**
GIVEN el docente abre *Asignar*
WHEN mira la pantalla
THEN ve un primer contenedor con **Título** (obligatorio) e **Instrucciones** (opcional), debajo una sección de **Adjuntos** y a la derecha una barra de configuración.

**CA-2 — Instrucciones con formato**
GIVEN el campo Instrucciones
WHEN el docente aplica negrita, cursiva, subrayado o listas
THEN el formato se ve en el editor y se conserva en TCP-TRIP; y una nota indica que Classroom lo recibe como texto plano (las listas como líneas con viñeta).

**CA-3 — Adjuntos**
GIVEN la sección Adjuntos
WHEN el docente agrega un documento o imagen local, un video de YouTube, un enlace o uno de sus ejercicios guardados
THEN el adjunto aparece como tarjeta con nombre y opción de quitarlo; los archivos locales y los PDF de ejercicios se suben a su Google Drive al asignar; no se permiten más de 20 adjuntos.

**CA-4 — Ejercicio guardado como adjunto**
GIVEN el docente adjunta un ejercicio guardado
WHEN elige incluir o no la hoja de respuestas *(supuesto: por defecto sin respuestas)*
THEN se adjunta el PDF congelado correspondiente.

**CA-4b — Presentación publicada como adjunto**
GIVEN el docente elige **Presentación** en Adjuntos
WHEN busca por título o autor y elige una presentación de teoría **publicada**
THEN se adjunta como enlace a su lector en TCP-TRIP (`/theory/presentations/<slug>`), con el título aprobado; el servidor resuelve el enlace y el título contra la copia publicada (nunca los toma del cliente), y si la presentación dejó de estar publicada al enviar, se nombra y se pide quitarla. Los borradores no se pueden adjuntar: el estudiante solo ve lo que un administrador revisó, y su lectura cuenta para su progreso.

**CA-5 — Destinatarios**
GIVEN la barra de configuración
WHEN el docente elige un curso
THEN por defecto la tarea es para todos los estudiantes; y puede restringirla a estudiantes concretos del roster de ese curso.

**CA-6 — Puntos y fecha límite**
GIVEN la barra de configuración
WHEN el docente fija puntos (0 o vacío = sin calificación) y fecha y hora límite
THEN la fecha no puede estar en el pasado; si hay fecha, se exige hora (o se usa 23:59 por defecto) *(supuesto)*.

**CA-7 — Asignar, programar o borrador**
GIVEN un formulario válido
WHEN el docente elige **Asignar**, **Programar** (con fecha de publicación) o **Guardar borrador**
THEN la tarea se crea en Classroom en el estado correspondiente y se ofrece un enlace para abrirla en Classroom.

**CA-8 — Registro de uso**
GIVEN una tarea creada con ejercicios adjuntos
WHEN se completa la asignación
THEN cada ejercicio adjunto registra el uso: curso, tarea, fecha de asignación y fecha límite.

**CA-9 — Edición posterior**
GIVEN una tarea creada desde TCP-TRIP
WHEN el docente la edita
THEN los cambios se reflejan en Classroom; y GIVEN una tarea creada directamente en Classroom, THEN TCP-TRIP la muestra como solo lectura y lo explica.

**CA-10 — Fallo al asignar**
GIVEN Classroom o Drive responde con error
WHEN el docente asigna
THEN el borrador no se pierde, se muestra qué falló (subida de un adjunto, permisos, curso) y se puede reintentar sin duplicar la tarea.

---

## US-### — Mis ejercicios

- **Como** docente que reutiliza material entre semestres y cursos,
- **Quiero** ver todos los ejercicios que he creado, clasificados por fecha y por curso,
- **Para** encontrar, reutilizar o reasignar material sin volver a generarlo.

### Valor

**Para el estudiante:** recibe material coherente entre grupos y semestres.

**Para el docente:** sabe qué ejercicio ya usó con qué curso, evitando repetir un quiz al mismo grupo.

### Criterios de aceptación

**CA-1 — Listado**
GIVEN el docente tiene ejercicios guardados
WHEN abre *Mis ejercicios*
THEN ve cada ejercicio con título, herramientas incluidas, total de ejercicios, fecha de creación y de última modificación.

**CA-2 — Clasificación por fecha y curso**
GIVEN el listado
WHEN el docente agrupa por fecha o por curso
THEN los ejercicios se agrupan en consecuencia; un ejercicio usado en varios cursos aparece en cada uno, y uno nunca asignado aparece en **Sin asignar**.

**CA-3 — Detalle y usos**
GIVEN el docente abre un ejercicio
WHEN mira su detalle
THEN ve los bloques y enunciados, y la lista de usos (curso, tarea, fecha de asignación, fecha límite) con enlace a Classroom.

**CA-4 — Acciones**
GIVEN un ejercicio en el listado
WHEN el docente usa sus acciones
THEN puede descargar el PDF (con o sin respuestas), asignarlo (abre *Asignar* con el ejercicio adjunto), duplicarlo como nueva versión editable, o eliminarlo *(supuesto: eliminar no afecta tareas ya creadas en Classroom)*.

**CA-5 — Vacío**
GIVEN el docente no tiene ejercicios
WHEN abre *Mis ejercicios*
THEN ve un estado vacío con acceso directo a *Crear ejercicios*.

---

## US-### — Mis cursos

- **Como** docente conectado a Classroom,
- **Quiero** ver mis cursos y, dentro de cada uno, sus estudiantes, sus anuncios y el avance en las tareas creadas desde TCP-TRIP,
- **Para** comunicar y hacer seguimiento sin alternar entre aplicaciones.

### Valor

**Para el estudiante:** recibe anuncios y recordatorios en su canal habitual (Classroom).

**Para el docente:** ve de un vistazo quién no ha entregado los ejercicios mecánicos y enfoca la asesoría en quien lo necesita.

### Criterios de aceptación

**CA-1 — Lista de cursos**
GIVEN el docente conectado
WHEN abre *Mis cursos*
THEN ve los cursos activos donde es docente (nombre, sección, número de estudiantes); los archivados se ocultan por defecto *(supuesto)*.

**CA-2 — Navegación a un curso**
GIVEN la lista de cursos
WHEN el docente abre un curso
THEN navega a *Mis cursos > <curso>* dentro de la misma pestaña, con la ruta reflejada en el breadcrumb.

**CA-3 — Estudiantes**
GIVEN el detalle de un curso
WHEN el docente abre la sección Estudiantes
THEN ve a cada estudiante con nombre, correo y foto, ordenados alfabéticamente, con búsqueda por nombre o correo.

**CA-4 — Anuncios: listar y crear**
GIVEN el detalle de un curso
WHEN el docente abre Anuncios
THEN ve los anuncios existentes; y WHEN crea uno con texto, adjuntos opcionales, destinatarios (todos o estudiantes concretos) y opcionalmente fecha de publicación, THEN se publica o programa en Classroom.

**CA-5 — Avance por tarea**
GIVEN tareas creadas desde TCP-TRIP en ese curso
WHEN el docente abre una
THEN ve por estudiante su estado (asignado, entregado, devuelto, recuperado, atrasado) y la nota si existe, más un resumen (entregadas / total).

**CA-6 — Error o sin cursos**
GIVEN Classroom no responde o el docente no tiene cursos
WHEN abre *Mis cursos*
THEN ve un mensaje correspondiente con opción de reintentar, sin romper la pestaña.

---

## Fuera de alcance

- Vinculación de cuentas de estudiantes: los estudiantes trabajan en Classroom; no ven ni entregan tareas desde TCP-TRIP.
- Calificar o devolver entregas desde TCP-TRIP.
- Presentaciones en borrador o exportadas a PDF como adjunto: solo se enlaza la versión publicada.
- Google Forms, Gems o NotebookLM como adjuntos (la API no permite crearlos).
- Formato enriquecido visible en Classroom (la API solo acepta texto plano).
- Crear, editar o archivar cursos y gestionar el roster (invitar o quitar estudiantes).
- Editar o calificar tareas creadas fuera de TCP-TRIP.

---

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
