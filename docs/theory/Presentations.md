# US-### — Presentaciones de Teoría (autoría, revisión y lectura con progreso)

**Componentes:**
`src/features/presentation-editor/components/PresentationEditor.tsx` (autoría, profesor)
`src/features/presentation-review/components/PresentationReview.tsx` (revisión, administrador)
`src/features/theory-presentations/components/TheoryPresentationPage.tsx` (lectura, estudiante)
`src/features/admin-theory/components/TheoryMenuManager.tsx` (menú de Teoría, administrador → `docs/theory/TheoryMenu.md`)
**Componentes compartidos:** `src/components/common/PresentationStage.tsx`, `PresentationPlayer.tsx`, `Markdown.tsx`
**Lienzo (Konva):** `src/features/presentation-editor/components/SlideCanvas.tsx` · `CanvasRulers.tsx`
**Barras:** `EditorTopBar.tsx` · `SlidesToolbar.tsx` · `MarkdownToolbar.tsx` · `MarkdownWriter.tsx` · `NotesPanel.tsx`
**Lógica de dominio:** `src/features/presentation-editor/lib/editorState.ts` · `markdownSnippets.ts` · `src/lib/markdown/markdown.ts`
**Contrato compartido:** `src/lib/presentations/contract.ts` · **Roles:** `src/lib/auth/roles.ts`
**Cliente de datos:** `src/services/presentations.ts` sobre `src/services/client.ts`
**API:** `src/api/presentations.ts` · **Persistencia:** `src/db/domains/presentations/`

---

## Historia de usuario

- **Como** profesor de redes que prepara el material de sus clases y como estudiante que lo estudia después,
- **Quiero** que el profesor pueda construir presentaciones de teoría —en un lienzo libre de diapositivas o escribiéndolas en Markdown—, que un administrador revise y apruebe su contenido antes de publicarlas en la sección Teoría, y que el estudiante las lea conservando su porcentaje de avance sin importar si lo hizo desplazándose por la página o en modo presentación,
- **Para** que el material de clase viva dentro de la misma herramienta que el estudiante ya usa para practicar, y que cada estudiante sepa por dónde iba sin tener que recordarlo ni preguntar.

**Prioridad:** Must
**Estado:** Hecho

---

## Valor

**Para el estudiante:** el material de clase deja de estar en un PDF suelto o en las diapositivas que el profesor "va a subir". Está en la misma aplicación donde ya convierte bases y calcula subredes, con el mismo tema visual y el mismo idioma, y con su avance guardado: la duda mecánica que desaparece es "¿por dónde iba?" y "¿qué parte ya leí?". Como el progreso es uno solo para las dos vistas, puede leer la mitad en el móvil desplazándose y terminarla en modo presentación sin perder la cuenta.

**Para el docente:** prepara una vez y proyecta desde la misma herramienta —con notas de ponente que solo ve él—, sin depender de un archivo que hay que llevar al aula. Deja de recibir "¿dónde están las diapositivas?", "¿esta es la versión buena?" y "¿qué había después de esta parte?": el material aprobado tiene un enlace estable y una versión congelada, así que lo que el curso lee es exactamente lo que se revisó. El tiempo de asesoría queda para lo conceptual, no para la logística del material.

**Para el administrador:** ningún contenido llega a los estudiantes sin haber sido leído por alguien. La aprobación congela una copia, de modo que revisar significa algo: el autor no puede reescribir después lo que ya se aprobó.

---

## Criterios de aceptación

### Autoría (profesor)

**CA-1 — La sección solo existe para quien puede usarla**
GIVEN el usuario tiene rol `Estudiante`
WHEN abre la aplicación
THEN el grupo `Presentaciones` no aparece en el sidebar; y GIVEN el usuario escribe a mano la ruta del editor, THEN la pantalla se muestra pero toda operación contra el servidor responde 403 con el mensaje de que hace falta la verificación de profesor. *(El ocultamiento en el cliente es cosmético; el rol se decide en el servidor contra Clerk.)*

**CA-2 — Estado inicial del editor**
GIVEN un profesor abre `Nueva Presentación`
WHEN la pestaña carga
THEN el título es editable **en su sitio, arriba a la izquierda**; las pestañas `Diapositivas` / `Markdown` están arriba a la derecha con su tooltip; debajo hay **una sola barra del ancho del componente**; el contenido principal es el lienzo (1920×1080 por defecto) con una diapositiva vacía; al final hay una sección de notas privadas; y el aviso de que aún no se ha guardado. *(El tema de teoría y el lienzo se eligen en el panel derecho, que es donde vive todo lo que no es una acción.)*

**CA-3 — Dos modos, ninguno derivado del otro**
GIVEN el profesor escribe texto en Markdown y además coloca elementos en el lienzo
WHEN cambia de pestaña en cualquier dirección
THEN ambas mitades se conservan intactas; y THEN el modo elegido queda guardado en el documento (`mode`) como la vista que el autor considera principal. *(No hay conversión entre modos: la posición y la rotación no tienen equivalente en Markdown.)*

**CA-4 — Elementos en el lienzo**
GIVEN el modo `Diapositivas` está activo
WHEN el profesor usa `Insertar ▸ Texto`
THEN aparece un cuadro de texto centrado y seleccionado; y WHEN lo arrastra, lo escala por cualquiera de los tiradores del transformador o lo rota por el tirador de rotación, THEN el elemento se mueve en unidades del lienzo (no en píxeles de pantalla), de modo que el resultado es idéntico en el editor y en el proyector. *(El lienzo es un `<canvas>` real —Konva— escalado al ancho disponible; la escala es la única conversión que existe.)*

**CA-5 — Teclado en el lienzo**
GIVEN un elemento está seleccionado y el lienzo tiene el foco
WHEN el profesor pulsa las flechas
THEN el elemento se desplaza 8 unidades (48 con `Shift`); y WHEN pulsa `Supr`, THEN se elimina; y WHEN pulsa `Esc`, THEN se deselecciona. *(El manejador está en el propio lienzo y no en `document`: las pestañas inactivas siguen montadas.)*

**CA-6 — Propiedades del elemento**
GIVEN un elemento está seleccionado
WHEN el profesor edita el panel derecho
THEN ve las propiedades de su tipo —texto (contenido, tamaño, grosor, alineación, color, monoespaciada), imagen (texto alternativo, ajuste), tabla (filas, columnas, encabezado, tamaño, color, monoespaciada) o figura (tipo, relleno, borde, grosor)— además de la caja (x, y, ancho, alto) y la rotación; y THEN todo color se elige entre **tokens del tema**, nunca con un valor hexadecimal, para que la diapositiva siga siendo legible si el aula proyecta en modo oscuro.

**CA-7 — Orden de apilado**
GIVEN una diapositiva tiene varios elementos
WHEN el profesor usa `Traer al frente` o `Enviar al fondo`
THEN el elemento cambia de posición en el array de la diapositiva, que es el único orden de dibujado que existe (no hay campo `z`).

**CA-8 — Bloquear un elemento**
GIVEN un elemento está bloqueado
WHEN el profesor intenta arrastrarlo, redimensionarlo o rotarlo
THEN no cambia; y THEN el bloqueo se guarda solo cuando está activo (al desbloquear, la propiedad desaparece del documento).

**CA-9 — Diapositivas**
GIVEN la presentación tiene una o más diapositivas
WHEN el profesor usa el selector de diapositiva de la barra (número y título, **sin miniatura**), el botón de añadir o `Editar ▸ Duplicar/Eliminar la diapositiva`
THEN la diapositiva activa cambia o la lista cambia; y GIVEN elimina la última, THEN queda una diapositiva vacía en lugar de una presentación sin diapositivas.

**CA-10 — Imágenes**
GIVEN la presentación todavía no se ha guardado
WHEN el profesor abre `Insertar ▸ Imagen…`
THEN se le pide guardar primero, porque los bytes se almacenan junto a la presentación; y GIVEN ya está guardada, WHEN sube un PNG/JPEG/WEBP/GIF/AVIF de hasta 2 MB, THEN queda listado y puede insertarlo en la diapositiva con su proporción original; y THEN el servidor determina el tipo **por los bytes**, no por lo que declare el navegador, y rechaza SVG.

**CA-11 — Notas del ponente (de una diapositiva)**
GIVEN una diapositiva está seleccionada
WHEN el profesor escribe en `Notas del ponente`
THEN el texto se guarda en la diapositiva y solo se muestra en el modo presentación al pulsar `Notas` (tecla `N`); nunca se proyecta como parte de la diapositiva.

**CA-12 — Guardar es explícito**
GIVEN hay cambios sin guardar
WHEN el profesor usa la acción `Guardar` (o `Ctrl+S`)
THEN el borrador se guarda y la acción queda deshabilitada hasta el siguiente cambio; y THEN guardar **nunca** cambia el estado de revisión: un autoguardado no puede sacar una presentación de la cola ni marcar como corregida una rechazada.

### Revisión (administrador)

**CA-13 — Enviar a revisión**
GIVEN la presentación está guardada y en estado `Borrador`, `Rechazada` o `Publicada`
WHEN el profesor pulsa `Enviar a revisión`
THEN si hay cambios sin guardar se guardan primero (se revisa lo que está en pantalla) y la presentación pasa a `En revisión` con su fecha de envío; y GIVEN ya estaba `En revisión`, THEN el segundo envío se rechaza con 409 y no pierde su lugar en la cola.

**CA-14 — Cola de revisión**
GIVEN un administrador abre `Revisar Presentaciones`
WHEN la pestaña carga
THEN ve las presentaciones `En revisión` ordenadas por **envío más antiguo primero**, cada una con su autor, su tema, su número de diapositivas y la fecha de envío; y THEN puede filtrar por cualquier otro estado para auditar lo ya decidido.

**CA-15 — Leer antes de decidir**
GIVEN una presentación está en la cola
WHEN el administrador pulsa `Leer el contenido`
THEN se muestran el Markdown y todas las diapositivas —con sus notas— tal como las escribió el profesor; y WHEN pulsa `Verla en modo presentación`, THEN se abre el mismo reproductor que usará el curso.

**CA-16 — Aprobar congela una copia**
GIVEN una presentación está `En revisión`
WHEN el administrador la aprueba
THEN se copia el documento a `presentation_publications` con un slug estable, el nombre del autor resuelto en el servidor y la marca de quién aprobó; y THEN Teoría sirve **esa copia**: si el autor sigue editando su borrador, los estudiantes no ven los cambios hasta que se apruebe un nuevo envío.

**CA-17 — Re-aprobar conserva el enlace**
GIVEN una presentación ya publicada se vuelve a enviar y a aprobar
WHEN se publica la nueva versión
THEN el slug no cambia, de modo que un enlace ya repartido en clase sigue funcionando; y THEN el progreso de los estudiantes sobre esa presentación se conserva.

**CA-18 — Rechazar exige motivo**
GIVEN una presentación está `En revisión`
WHEN el administrador la rechaza sin escribir nota
THEN la operación se rechaza y se le pide el motivo; y GIVEN escribe el motivo, THEN la presentación pasa a `Rechazada`, el profesor lee ese motivo en su editor, y cualquier versión aprobada anterior **sigue publicada**.

**CA-19 — Dos administradores a la vez**
GIVEN dos administradores abren la misma presentación en revisión
WHEN ambos deciden
THEN solo la primera decisión se aplica y la segunda responde 409, porque la actualización exige que el estado siga siendo `pending`.

**CA-20 — Historial de revisión**
GIVEN una presentación ha pasado por varios envíos y decisiones
WHEN se consulta su historial
THEN existe una fila por cada `envío`, `aprobación`, `rechazo` y `retirada`, con quién la hizo y cuándo, y el historial no se sobrescribe nunca.

**CA-21 — Retirar**
GIVEN una presentación está `En revisión` o `Publicada`
WHEN el profesor pulsa `Cancelar el envío` / `Quitar de Teoría`
THEN vuelve a `Borrador` y su copia publicada se elimina en la misma transacción, de modo que deja de ser legible en Teoría inmediatamente.

**CA-22 — Eliminar**
GIVEN el profesor elimina una presentación desde `Mis Presentaciones`
WHEN se confirma la operación
THEN desaparecen con ella su copia publicada, sus imágenes y el progreso de lectura de todos los estudiantes (`ON DELETE CASCADE`).

**CA-23 — Una imagen usada por la versión publicada no se borra**
GIVEN la copia publicada referencia una imagen
WHEN el profesor intenta eliminarla
THEN la operación se rechaza con 409 explicando que hay que retirar la presentación primero, para no dejar un hueco en una página que los estudiantes están leyendo.

### Lectura y progreso (estudiante)

**CA-24 — El menú de Teoría es la lista**
GIVEN un administrador armó el menú de Teoría (ver `docs/theory/TheoryMenu.md`)
WHEN un usuario abre la aplicación
THEN encuentra las presentaciones aprobadas en la barra lateral, dentro de las secciones que el administrador creó, y **no** en un índice generado: la navegación sigue el orden del curso, no la fecha de publicación; y GIVEN el menú todavía está vacío, WHEN abre `Presentaciones de Teoría`, THEN la página explica que debe elegir una presentación en el menú.

**CA-25 — Abrir una presentación es navegación dentro de la pestaña**
GIVEN una entrada del menú de Teoría
WHEN el usuario la abre
THEN la URL pasa a `/theory/presentations/<slug>` sin abrir una pestaña nueva, el botón atrás de la pestaña vuelve a la presentación anterior, y ese enlace es compartible.

**CA-26 — Contenido legible sin sesión**
GIVEN un visitante sin iniciar sesión sigue el enlace de una presentación publicada
WHEN la página carga
THEN ve el contenido completo —incluidas sus imágenes— y no se le registra progreso; y THEN no aparece ningún error por ello.

**CA-27 — Un solo porcentaje para las dos vistas**
GIVEN un estudiante con sesión lee la página desplazándose
WHEN llega, por ejemplo, a la mitad
THEN se guarda un 50 %; y WHEN abre después el modo presentación y avanza hasta la diapositiva 6 de 8, THEN el mismo registro pasa a 75 %: el porcentaje no depende de la vista, porque las dos son formas de mostrar el mismo documento.

**CA-28 — El progreso nunca retrocede**
GIVEN el estudiante ya alcanzó el 80 %
WHEN vuelve atrás a releer el principio
THEN el porcentaje guardado sigue siendo 80 %; y THEN la posición de reanudación sí se actualiza a donde está ahora, porque responde a otra pregunta ("¿por dónde iba?").

**CA-29 — Reanudar**
GIVEN el estudiante tiene progreso guardado en una presentación
WHEN la vuelve a abrir
THEN se le ofrece continuar donde lo dejó: desplazando la página hasta su posición, o abriendo el modo presentación en la diapositiva en la que estaba.

**CA-30 — El menú muestra el avance**
GIVEN el estudiante ha empezado varias presentaciones
WHEN mira el menú de Teoría en la barra lateral
THEN cada entrada muestra su porcentaje, marcando como `Completada` a partir del 95 %; y THEN todo eso llega en **una sola petición**, no en una por entrada.

**CA-31 — El progreso se escribe con moderación**
GIVEN el estudiante está desplazándose
WHEN se disparan decenas de eventos de scroll
THEN el navegador envía como máximo una escritura cada 4 segundos, más una última al cerrar la vista.

**CA-32 — Progreso por lector**
GIVEN dos estudiantes leen la misma presentación
WHEN cada uno avanza
THEN cada uno tiene su propia fila, y ninguno ve ni modifica el avance del otro.

### Transversales

**CA-33 — Markdown seguro**
GIVEN el profesor escribe `<script>` o un enlace `javascript:` en el Markdown
WHEN un estudiante lee la presentación
THEN el `<script>` se muestra como texto y el enlace pierde su destino conservando sus palabras: el Markdown se convierte en elementos de React, nunca en HTML inyectado.

**CA-34 — Bilingüe y accesible**
GIVEN la interfaz está en español o en inglés
WHEN se usan el editor, la revisión y la lectura
THEN todas las etiquetas, estados, acciones y mensajes están traducidos en ambos idiomas; y THEN el texto alternativo de las imágenes es parte del documento, el modo presentación es operable por teclado y el lienzo es alcanzable con `Tab`.

**CA-35 — Propiedad en la cláusula `WHERE`**
GIVEN un profesor pide una presentación que no es suya
WHEN el servidor resuelve la consulta
THEN no encuentra ninguna fila y responde el mismo 404 que para un id inexistente, porque el filtro por `user_id` está en la propia consulta. *(Las dos excepciones —la cola y la lectura del administrador— no llevan filtro de propiedad y están guardadas por el rol.)*

---

### El editor reconstruido

**CA-36 — Un lienzo fijo, escalado**
GIVEN el lienzo es de 1920×1080
WHEN la ventana es más estrecha
THEN el `<canvas>` se escala completo (nunca por encima de 1:1) en lugar de recolocar los elementos; y THEN toda coordenada que llega al reductor está en unidades del lienzo, así que la misma diapositiva editada en un portátil y en un proyector es el mismo documento.

**CA-37 — Reglas alrededor del lienzo**
GIVEN el modo `Diapositivas` está activo
WHEN el profesor mira los bordes superior e izquierdo del lienzo
THEN hay una regla graduada **en unidades del lienzo** (marca cada 100, número cada 200), las mismas que muestra el panel derecho; y GIVEN un elemento está seleccionado, THEN las dos reglas marcan la banda que ocupa en cada eje, también mientras se arrastra.

**CA-38 — Escribir en el lienzo**
GIVEN un cuadro de texto está en la diapositiva
WHEN el profesor hace doble clic sobre él
THEN aparece un `<textarea>` real encima del nodo, con el tamaño, la tipografía, la alineación y el color del elemento, y lo que escribe se guarda mientras escribe; y WHEN pulsa `Esc` o sale del campo, THEN se cierra y el texto tecleado queda como **un solo paso de deshacer**. *(Un `<canvas>` no tiene cursor de texto, ni IME, ni corrector.)*

**CA-39 — Tablas**
GIVEN el profesor usa `Insertar ▸ Tabla`
WHEN la tabla aparece
THEN es una rejilla rectangular vacía (3×2) que se puede mover, escalar y rotar como cualquier elemento; y WHEN hace doble clic en una celda, THEN escribe en ella; y WHEN cambia filas o columnas en el panel, THEN la rejilla se recorta o se rellena conservando lo que sigue dentro; y THEN el documento guarda **las celdas**, no una maqueta, así que redimensionar la tabla reparte de nuevo la rejilla en lugar de dispersar cuadros de texto. *(El contrato rechaza una tabla irregular: todas las filas tienen la misma longitud.)*

**CA-40 — Figuras**
GIVEN el profesor usa `Insertar ▸ Figura`
WHEN elige rectángulo, elipse, triángulo, línea o flecha
THEN la figura se inserta con relleno y borde en **tokens del tema** (`Sin relleno` incluido); y THEN una línea o una flecha nace ancha y fina, porque es un conector; y THEN la cabeza de una flecha sin relleno se pinta con el color del borde en lugar de desaparecer.

**CA-41 — Deshacer y rehacer**
GIVEN el profesor ha hecho cambios
WHEN pulsa `Ctrl+Z` (o `Editar ▸ Deshacer`)
THEN vuelve el documento anterior con la selección corregida —si el elemento seleccionado ya no existe, la selección se mueve—; y WHEN pulsa `Ctrl+Mayús+Z`, THEN se rehace; y GIVEN acaba de arrastrar un elemento a lo largo de doscientos eventos de puntero, WHEN deshace, THEN se deshace **el gesto entero**, no el último píxel; y GIVEN deshace y luego edita, THEN lo deshecho se descarta. *(El historial guarda 50 pasos; el atajo está en el editor y no en `document`, porque las pestañas inactivas siguen montadas.)*

**CA-42 — Una barra, tres menús**
GIVEN el modo `Diapositivas` está activo
WHEN el profesor mira la barra
THEN ocupa todo el ancho y contiene, en este orden: el selector de diapositiva, el botón de añadir, los menús `Archivo` / `Insertar` / `Editar`, y a la derecha deshacer, rehacer y `Presentar`; y THEN cada control tiene un tooltip de una línea que dice qué hace; y THEN los menús llevan los atajos de teclado y desactivan lo que no aplica (enviar a revisión sin haber guardado, o una acción de elemento sin selección).

**CA-43 — La barra de markdown inserta, no formatea**
GIVEN el modo `Markdown` está activo
WHEN el profesor pulsa uno de los doce botones (negrita, cursiva, encabezado, tachado, lista, lista numerada, lista de tareas, enlace, imagen, tabla, código, cita)
THEN se inserta la estructura correspondiente **donde está el cursor**, envolviendo la selección si hay una, marcando cada línea seleccionada si es un prefijo, o como bloque separado por líneas en blanco si es una tabla o un bloque de código; y THEN el cursor queda sobre lo que hay que reemplazar (la url de un enlace, por ejemplo); y WHEN pulsa `Vista previa`, THEN el mismo renderizador que ve el estudiante se muestra al lado. *(Ningún botón alterna: `**a** y **b**` es exactamente el caso en el que adivinar se equivoca.)*

**CA-44 — Las notas del profesor no son de nadie más**
GIVEN el profesor escribe en `Mis notas`
WHEN guarda la presentación
THEN el texto viaja con el documento y se ve **solo** en el editor y en `Mis Presentaciones`; y WHEN un administrador aprueba la presentación, THEN la copia publicada se guarda **sin las notas del documento ni las de las diapositivas**, y la lectura de una publicación vuelve a quitarlas; y THEN el borrador las conserva. *(Ocultarlas en la interfaz no es ocultarlas: una presentación publicada es JSON que el estudiante puede abrir en la pestaña de red.)*

**CA-45 — Presentar toma la pantalla**
GIVEN la presentación tiene al menos una diapositiva
WHEN el profesor pulsa `Presentar`
THEN el modo presentación se abre y pide **pantalla completa** al navegador; y GIVEN el navegador la deniega, THEN queda como la superposición a ventana completa que ya era; y WHEN se cierra, THEN se sale de pantalla completa.

---

## Fuera de alcance

- Convertir automáticamente el Markdown en diapositivas (o al revés).
- Reportes de estudiantes sobre presentaciones ya publicadas (moderación posterior a la publicación).
- Insertar en una diapositiva un protocolo guardado del constructor (el tipo de elemento queda previsto en el contrato).
- Compartir una presentación en borrador con otro profesor.
- Generar ejercicios a partir de una presentación.
- Exportar a PDF o PPTX.
- Vídeo, audio y animaciones en las diapositivas.
- Ajuste automático a la cuadrícula o a otros elementos (la cuadrícula se dibuja, no imanta).
- Selección múltiple de elementos y agrupación.
- Pegar una imagen desde el portapapeles (se sube desde `Insertar ▸ Imagen…`).
- Combinar celdas de una tabla o dar ancho distinto a cada columna.
- Un panel de administración de usuarios y de concesión del rol de profesor (esta historia solo usa el rol, no lo otorga).
- Sincronizar el progreso entre pestañas abiertas del mismo navegador.

---

## Estado de la implementación

Implementado y cubierto por pruebas: CA-1 a CA-45.

- Estado del editor (diapositivas, elementos, bloqueo, apilado, los dos modos, tablas, figuras, deshacer/rehacer y la fusión de un gesto en un solo paso): `src/features/presentation-editor/lib/editorState.test.ts`.
- Inserciones de markdown y la aritmética del cursor: `src/features/presentation-editor/lib/markdownSnippets.test.ts`.
- Contrato del documento y helpers de progreso: `src/lib/presentations/contract.test.ts`.
- Markdown y su seguridad: `src/lib/markdown/markdown.test.ts`.
- Ciclo de revisión, congelado de la copia publicada **sin notas**, imágenes y progreso de lectura: `src/db/domains/presentations/presentations.repository.test.ts`, que incluye los casos de propiedad —un segundo id de Clerk no puede leer, editar, enviar ni borrar la presentación de otro— y los de progreso monotónico.

Queda fuera de esta historia, no pendiente de ella:

- **Caché de consultas:** el cliente es `fetch` directo, como en protocolos; TanStack Query se monta encima cuando se unifiquen `Mis Protocolos` y `Mis Presentaciones`.
- **Propagación del rol:** el rol viaja dentro del token de sesión de Clerk (ver `docs/users/roles.md`), así que conceder o retirar el rol de profesor surte efecto cuando el token se renueva —alrededor de un minuto, o al instante si la persona recarga—. Si la reclamación no está configurada en el panel de Clerk, el servidor lee el usuario y cachea la respuesta 60 s. La sesión revocada, en cambio, es inmediata en los dos casos.
- **Borrado por webhook de Clerk:** al eliminar una cuenta, sus presentaciones y su progreso siguen ahí; hace falta un webhook que borre por `user_id`.

---

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
