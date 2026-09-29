# US-### — Publicación curada y modo presentación general

**Componentes:**
`src/components/common/PresentationPlayer.tsx` (reproductor compartido, reutilizado)
`src/components/layouts/AppHeader.tsx` (botón de presentación)
`src/context/PresentableProvider.tsx` (registro de páginas presentables, propuesto)
`src/features/presentation-review/components/ApproveDialog.tsx` (propuesto)
**Relacionados:** `docs/theory/Presentations.md` (autoría, revisión, lectura) · `docs/theory/TheoryMenu.md` (menú de Teoría)

---

## Historia de usuario

- **Como** administrador que publica material de clase, profesor que lo proyecta y estudiante que lo estudia,
- **Quiero** que al aprobar una presentación el administrador la ubique en el menú de Teoría, que las ediciones vuelvan a revisión marcadas como tales, y que cualquier página presentable se pueda abrir en modo presentación desde la cabecera,
- **Para** que el estudiante sepa en qué diapositiva va y cuánto le falta sin preguntar, y que el profesor proyecte con sus notas sin que nadie más las vea.

**Prioridad:** Must
**Estado:** En progreso

---

## Valor

**Para el estudiante:** la barra de progreso muestra en qué diapositiva está y cuánto le falta, así que ya no tiene que preguntar "¿cuánto falta?" ni "¿esto es todo?". El material publicado siempre aparece en el lugar del menú que le corresponde.

**Para el docente:** proyecta desde la cabecera con sus notas (`N`), que solo le llegan a él. Una edición no sustituye la versión aprobada hasta que se revisa, así que deja de recibir preguntas sobre "¿cuál es la versión buena?".

---

## Criterios de aceptación

### Publicación (administrador)

**CA-1 — Insignia de edición**
GIVEN una presentación ya publicada se reenvía a revisión
WHEN el administrador abre `Revisar Presentaciones`
THEN la entrada aparece en la misma cola con la insignia `Edición`; un primer envío no lleva insignia.

**CA-2 — La primera aprobación exige ubicación**
GIVEN un primer envío en revisión
WHEN el administrador pulsa `Aprobar`
THEN se abre un diálogo para elegir una sección existente del menú de Teoría o crear una nueva (nombre + icono); `Confirmar` queda deshabilitado hasta elegir una; y la presentación **no** queda publicada sin ubicación. *(Inventado: aprobar y asignar son una sola operación.)*

**CA-3 — Crear sección desde el diálogo**
GIVEN el diálogo de aprobación
WHEN el administrador crea una sección nueva y confirma
THEN la sección se añade al final del menú con la presentación dentro, y la barra lateral la muestra sin recargar.

**CA-4 — Aprobar una edición conserva su lugar**
GIVEN una entrada con insignia `Edición`
WHEN el administrador la aprueba
THEN no se abre el diálogo; la entrada conserva su sección, su posición y su enlace, y los lectores ven la nueva versión.

**CA-5 — Rechazar una edición**
GIVEN una entrada con insignia `Edición`
WHEN el administrador la rechaza con motivo
THEN el profesor ve el motivo y la versión aprobada anterior sigue publicada.

**CA-6 — Cancelar el diálogo**
GIVEN el diálogo de aprobación está abierto
WHEN el administrador lo cierra sin confirmar
THEN la presentación sigue `En revisión` y el menú no cambia.

### Modo presentación (todos los roles)

**CA-7 — Botón solo en páginas presentables**
GIVEN la pestaña activa muestra una página presentable (hoy solo la lectura de una presentación publicada)
WHEN el usuario mira la cabecera
THEN a la izquierda del botón de tema aparece un botón de icono de presentación, con el mismo estilo y un tooltip; y GIVEN la pestaña activa no es presentable, THEN el botón no aparece; y WHEN cambia de pestaña, THEN el botón se actualiza.

**CA-8 — Publicado para todos, en dos modos**
GIVEN una presentación publicada
WHEN cualquier usuario la abre, con o sin sesión
THEN la lee en modo normal; y WHEN pulsa el botón de la cabecera, THEN se abre el modo presentación; y THEN el botón `Presentar` de la propia página desaparece, mientras que `Continuar donde lo dejé` sigue abriendo el reproductor en la diapositiva guardada.

**CA-9 — Controles mínimos**
GIVEN el modo presentación está abierto
WHEN el usuario mira los controles
THEN solo ve los chevrones abajo, un botón de cierre y el menú de acciones; ya no aparecen el título, el botón de notas ni la línea de ayuda; y THEN los tooltips de los chevrones dicen `Anterior (←)` y `Siguiente (→)`; y THEN el chevron correspondiente se desactiva en la primera y en la última diapositiva; y WHEN pulsa `Esc`, THEN el reproductor se cierra.

**CA-10 — Barra de progreso del estudiante**
GIVEN el usuario es estudiante o visitante sin sesión
WHEN avanza o retrocede
THEN entre los chevrones hay una barra de progreso de solo lectura con el título de la diapositiva (o `Diapositiva n` si no tiene) y el porcentaje `n / total`; y THEN la barra muestra la posición actual, no el máximo guardado. *(Inventado: la posición y no el máximo.)*

**CA-11 — Contador para profesor y administrador**
GIVEN el usuario es profesor o administrador
WHEN usa el reproductor
THEN entre los chevrones ve `3 / 8` en lugar de la barra.

**CA-12 — Notas solo para el autor**
GIVEN el usuario es el profesor autor de la presentación (en su editor o en Teoría)
WHEN pulsa `N`
THEN se muestran u ocultan las notas de la diapositiva; y GIVEN es cualquier otro usuario, THEN `N` no hace nada y el servidor nunca le envía las notas.

**CA-13 — Acciones anunciadas**
GIVEN el modo presentación de cualquier página presentable
WHEN el usuario abre el menú de acciones
THEN ve `Exportar`, `Preguntar`, `Reportar` y `Pizarra` desactivadas, cada una marcada `Próximamente`.

**CA-14 — Un solo reproductor**
GIVEN la vista previa del editor, la revisión o la lectura en Teoría
WHEN se abre el modo presentación
THEN es el mismo reproductor, con las reglas de rol de CA-10 a CA-12.

**CA-15 — Bilingüe**
GIVEN la interfaz está en español o en inglés
WHEN se usan el diálogo, la insignia, el botón, los tooltips y las acciones
THEN todo está traducido en ambos idiomas.

---

## Fuera de alcance

- El comportamiento de Exportar, Preguntar, Reportar y Pizarra.
- Saltar de diapositiva arrastrando (la barra es de solo lectura).
- Otras páginas presentables además de la lectura de Teoría (el registro queda listo para ellas).

---

## Estado de la implementación

Implementado: CA-1 a CA-15. Cubierto por pruebas en el servidor (`src/db/domains/presentations/presentations.repository.test.ts`): aprobar y ubicar en una sola transacción, la ubicación obligatoria en la primera aprobación, la edición que conserva su lugar y las notas del ponente que solo lee el autor. La interfaz (cabecera, reproductor, diálogo) aún no se ha verificado en el navegador.

---

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
