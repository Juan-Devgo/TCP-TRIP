# US-### — Constructor de Protocolos

**Componente:** `src/features/protocol-builder/components/ProtocolBuilder.tsx`
**Lógica de dominio:** `src/features/protocol-builder/lib/protocol.ts`
**Cliente de datos:** `src/services/protocols.ts`

---

## Historia de usuario

- **Como** estudiante de redes que estudia los encabezados de los protocolos leyendo sus diagramas en los RFC,
- **Quiero** construir el esquema de mi propio protocolo en un diagrama estilo RFC editable —añadiendo campos libres, asignándoles un tipo arrastrándolo desde un catálogo, y ajustando su longitud en bits contra una regla redimensionable—,
- **Para** entender por manipulación directa cómo se lee un diagrama de encabezado (qué bits ocupa cada campo, en qué offset queda, cómo se envuelve entre filas) sin tener que preguntarle al docente cómo interpretar la notación del RFC.

**Prioridad:** Must
**Estado:** Parcialmente implementado

---

## Valor

**Para el estudiante:** convierte la notación estática de los diagramas RFC en un objeto manipulable. La duda mecánica que absorbe es la de la aritmética del diagrama: "¿cuántos bits ocupa este campo?", "¿en qué bit empieza el siguiente?", "¿por qué el campo continúa en la fila de abajo?". Al arrastrar tipos reales (bandera, checksum, dirección IPv4) el estudiante descubre que muchos campos tienen longitudes impuestas por su naturaleza, no elegidas por capricho. El esquema resultante alimenta el compositor de mensajes, cerrando el ciclo diseñar → usar.

**Para el docente:** deja de recibir "¿cómo se lee este diagrama del RFC?", "¿qué significa que Flags ocupe 3 bits?" y "¿por qué la cabecera se dibuja en filas de 32?". El tiempo de asesoría queda para lo conceptual: por qué un protocolo necesita cierto campo, qué compromete una cabecera más larga, cómo se versiona un protocolo. En modo presentación el diagrama sirve para construir una cabecera en vivo frente al curso.

---

## Criterios de aceptación

**CA-1 — Estado inicial**
GIVEN el usuario abre `Constructor` desde el sidebar
WHEN la pestaña carga
THEN se muestra un diagrama vacío con la regla de bits arriba (ancho por defecto 32 bits), un panel lateral izquierdo propio con el catálogo de tipos de campo agrupado por categorías, un campo para el nombre del protocolo y el botón verde `+` para añadir campos. *(Ancho por defecto 32: inventado para llenar el vacío; es el estándar de los RFC.)*

**CA-2 — Regla de bits redimensionable**
GIVEN el diagrama tiene la regla en 32 bits
WHEN el usuario cambia el ancho a uno de los presets (8, 16, 24 o 32 bits)
THEN la regla se redibuja con marcas por bit y números cada 4 bits, y los campos existentes se re-acomodan (re-envuelven) a la nueva anchura sin perder su longitud en bits ni su orden.

**CA-3 — Añadir campo simple**
GIVEN el diagrama está visible
WHEN el usuario pulsa el botón verde `+` y elige `Campo simple` en el menú desplegable
THEN aparece al final del diagrama un campo marcado `Libre`, aún sin tipo ni definición.

**CA-4 — Añadir campo compuesto**
GIVEN el diagrama está visible
WHEN el usuario pulsa el botón verde `+` y elige `Campo compuesto`
THEN aparece un grupo con nombre propio (p. ej. «Flags») dividido en dos sub-campos `Libre` dibujados unidos, seguido de un botón secundario más pequeño con `+`; y WHEN el usuario pulsa ese botón secundario, THEN el grupo crece añadiendo un sub-campo `Libre` más, unido a los anteriores.

**CA-5 — Envolver entre filas**
GIVEN los campos acumulan más bits que el ancho de la regla
WHEN el diagrama se dibuja
THEN los campos continúan en la fila siguiente como en un diagrama RFC real —un campo puede partirse visualmente entre filas— y el offset en bits de cada campo se mantiene consistente con la regla.

**CA-6 — Asignar tipo por arrastre**
GIVEN existe al menos un campo `Libre`
WHEN el usuario arrastra un tipo desde el catálogo del panel izquierdo y lo suelta sobre ese campo
THEN se abre un diálogo con el formulario reutilizable de campo: nombre, significado, longitud (bits), documentación (opcional) y los campos adicionales que el tipo requiera; y WHEN el usuario confirma, THEN el campo deja de decir `Libre` y muestra su nombre con la longitud elegida reflejada contra la regla.

**CA-7 — Catálogo de tipos**
GIVEN el usuario recorre el panel izquierdo
WHEN observa el catálogo
THEN los tipos aparecen clasificados por categorías: `Primitivos` (entero sin signo, bandera de 1 bit, enumeración, reservado/relleno, checksum), `Capa 2` (dirección MAC), `Capa 3` (dirección IPv4), `Capa 4` (puerto); y THEN los tipos con longitud impuesta la declaran (bandera = 1 bit, dirección MAC = 48, dirección IPv4 = 32, puerto = 16).

**CA-8 — Seleccionar, editar y eliminar un campo**
GIVEN un campo ya tiene tipo y definición
WHEN el usuario hace clic sobre él
THEN el campo queda seleccionado —marcado con un anillo en el diagrama— y aparece bajo el diagrama una barra que anuncia el campo seleccionado, informa el atajo para moverlo y ofrece dos botones de icono: editar (lápiz) y eliminar (papelera); y WHEN el usuario activa el botón de editar o hace doble clic sobre el campo, THEN se abre el formulario reutilizable en modo edición con los valores actuales cargados, y los cambios confirmados se reflejan en el diagrama; y WHEN activa el botón de eliminar, THEN el campo desaparece del diagrama y la selección se vacía; y WHEN presiona `Esc`, THEN la selección se vacía sin cambiar nada. *(Lo mismo aplica a un grupo, seleccionándolo desde su banda de nombre.)*

**CA-9 — Redimensionar un campo**
GIVEN un campo definido tiene longitud variable
WHEN el usuario arrastra su borde
THEN la longitud crece o decrece en pasos de 1 bit sincronizada con la regla, y los campos posteriores se re-acomodan; y GIVEN el tipo impone una longitud fija (bandera, direcciones, puerto), THEN el campo no ofrece redimensionado y el formulario muestra la longitud bloqueada.

**CA-10 — Validación del formulario**
GIVEN el formulario de campo está abierto
WHEN el usuario intenta confirmar sin nombre, sin significado o con longitud menor a 1 bit
THEN el formulario se bloquea mostrando el error junto al campo correspondiente; y WHEN la longitud viola el límite del tipo, THEN se muestra el límite en el mensaje.

**CA-11 — Guardar (atajo `S`)**
GIVEN el protocolo tiene nombre y ningún campo `Libre`
WHEN el usuario activa la acción `Guardar` o presiona la tecla `S` (con la pestaña activa y el foco fuera de un campo de texto)
THEN el esquema se guarda en el servidor asociado a su cuenta y aparece en `Mis Protocolos`; y GIVEN quedan campos `Libre` o falta el nombre del protocolo, THEN el guardado se bloquea señalando qué falta.

**CA-12 — Compartir**
GIVEN el protocolo está guardado
WHEN el usuario activa la acción `Compartir`
THEN se genera un enlace público de solo lectura al protocolo y se copia/muestra para distribuirlo; y GIVEN el protocolo no se ha guardado aún, THEN la acción lo indica en lugar de generar un enlace roto.

**CA-13 — Exportar**
GIVEN el diagrama tiene contenido
WHEN el usuario activa la acción `Exportar`
THEN puede elegir entre descargar el esquema como archivo JSON reimportable o el diagrama como imagen (PNG/SVG) para informes y diapositivas.

**CA-14 — Ejemplo**
GIVEN el usuario no sabe por dónde empezar
WHEN activa la acción `Ejemplo`
THEN el diagrama se carga con el esquema de un protocolo estandarizado real (p. ej. la cabecera UDP) listo para explorar y modificar; y WHEN la vuelve a activar, THEN carga el siguiente ejemplo de la lista de forma cíclica. *(Ejemplos concretos y comportamiento cíclico: inventados para llenar el vacío, siguiendo el patrón de las demás herramientas.)*

**CA-15 — Limpiar**
GIVEN el diagrama está vacío
WHEN el usuario mira la acción `Limpiar`
THEN está deshabilitada; y GIVEN hay campos en el diagrama, WHEN la activa, THEN se pide confirmación antes de vaciar el diagrama y el nombre del protocolo, porque un esquema no guardado no se puede recuperar. *(Confirmación previa: inventada para llenar el vacío, por ser una acción destructiva.)*

**CA-16 — Bilingüe y accesible**
GIVEN el usuario cambia el idioma de la aplicación entre español e inglés
WHEN recorre el constructor
THEN el catálogo de tipos, las etiquetas del formulario, las acciones, los mensajes de validación y los textos del diagrama (`Libre`) están traducidos en ambos idiomas; y THEN los campos del diagrama son alcanzables por teclado y el diálogo del formulario es accesible (foco atrapado, etiquetas asociadas).

**CA-17 — Reordenar campos por arrastre**
GIVEN el diagrama tiene al menos dos campos
WHEN el usuario arrastra un campo (o un grupo completo desde su banda de nombre) sobre cualquier otro campo
THEN el campo de destino se marca con un anillo mientras dura el arrastre —igual que la barra de pestañas— y WHEN el usuario suelta, THEN el campo arrastrado ocupa el lugar que tenía el marcado y los demás se corren una posición, sin perder su longitud ni su definición y sin que el usuario tenga que apuntar a un hueco entre dos campos; y GIVEN el campo es sub-campo de un grupo, THEN solo puede reordenarse dentro de su propio grupo (el grupo permanece contiguo y soltar fuera de él no tiene efecto); y THEN el reordenamiento también es posible por teclado (`Ctrl+←`/`Ctrl+→` con el campo seleccionado), de modo que organizar los campos nunca exige borrarlos y recrearlos.

---

## Fuera de alcance

- Consumir el protocolo guardado para enviar mensajes (lo cubre el compositor de mensajes).
- Reabrir y editar un protocolo ya guardado desde `Mis Protocolos` (lo cubre esa historia).
- Importar un JSON exportado (el formato queda listo, la importación llega después).
- Tipos de campo de las capas 5–7 y catálogo completo por capa.
- Generación de ejercicios desde el constructor.
- Detalles del modo presentación.
- Sacar un sub-campo de su grupo o adoptar un campo suelto dentro de un grupo mediante arrastre.

---

## Estado de la implementación

Implementado y cubierto por pruebas (`src/features/protocol-builder/lib/*.test.ts`): CA-1 a CA-10, CA-13 a CA-17.

Pendiente de la capa de persistencia:

- **CA-11 (Guardar):** el diagrama, la validación y el atajo `S` funcionan, pero `src/services/protocols.ts` es todavía un sustituto en memoria — el protocolo sobrevive al cambio de pestaña y se pierde al recargar. La interfaz lo dice explícitamente en lugar de aparentar lo contrario. Falta el módulo `bun:sqlite` bajo `src/api/` montado en `src/api/routes.ts`, con la propiedad verificada contra el id de usuario de Clerk en el servidor.
- **CA-12 (Compartir):** el enlace se genera y se copia, pero la ruta pública `/protocol/shared/<id>` aún no existe; el diálogo lo advierte.
- **CA-11 (Mis Protocolos):** el protocolo guardado no se lista todavía porque esa pantalla sigue siendo un marcador de posición.

---

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
