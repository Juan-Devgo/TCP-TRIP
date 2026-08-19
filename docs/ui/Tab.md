# US-### — Sistema de Pestañas

**Componentes:** `src/components/layouts/TabBar.tsx`, `src/components/layouts/TabHost.tsx`, `src/components/layouts/ContentToolbar.tsx`, `src/components/TabsProvider.tsx`, `src/components/ToolActionsProvider.tsx`
**Lógica de dominio:** `src/lib/tabs.ts` (máquina de estados de pestañas), `src/lib/tabHistory.ts` (pilas de navegación por pestaña)
**Registro de páginas:** `src/config/pages.ts`

---

## Historia de usuario

- **Como** estudiante de redes que necesita varias herramientas a la vez (por ejemplo, convertir una máscara en el conversor de bases y usarla en la calculadora IPv4),
- **Quiero** abrir cada herramienta en una pestaña tipo navegador que conserve su estado mientras esté abierta, y cambiar entre pestañas con un clic,
- **Para** trasladar resultados intermedios de una herramienta a otra sin perder lo que ya escribí ni recalcular nada, y resolver solo la parte mecánica del ejercicio sin depender del docente.

**Prioridad:** Must
**Estado:** Hecho

---

## Valor

**Para el estudiante:** elimina la fricción de perder el estado de una herramienta al navegar a otra — la duda mecánica que absorbe es "¿cuánto me había dado el paso anterior?": el resultado intermedio queda vivo en su pestaña y no hay que reescribirlo ni recalcularlo. El flujo multi-herramienta (convertir → calcular → construir cabecera) se vuelve continuo, como en un navegador.

**Para el docente:** en modo presentación puede alternar entre herramientas preparadas de antemano sin rehacer ejemplos frente al curso. Además deja de recibir consultas nacidas de trabajo perdido ("se me borró lo que tenía") y las acciones de evaluación (p. ej. Generar Ejercicios) quedan siempre en un lugar fijo y predecible de la interfaz.

---

## Criterios de aceptación

**CA-1 — Abrir una pestaña desde el sidebar**
GIVEN una página del sidebar que no está abierta en ninguna pestaña
WHEN el usuario hace clic en su ítem del sidebar
THEN aparece una pestaña nueva en el navbar (después del `SidebarTrigger` y su separador) con el nombre de la página en el idioma activo y un botón de cierre, la pestaña queda activa y el contenido principal muestra esa página. Cualquier página del sidebar (herramientas, teoría, protocolo genérico, docs) se abre como pestaña.

**CA-2 — Sin duplicados: enfocar la existente**
GIVEN una página ya abierta en una pestaña
WHEN el usuario vuelve a hacer clic en su ítem del sidebar
THEN se activa la pestaña existente sin crear una nueva, conservando el estado que tenía.

**CA-3 — El estado se conserva al cambiar de pestaña**
GIVEN el estudiante escribió valores en la herramienta de la pestaña A
WHEN cambia a la pestaña B y luego regresa a A
THEN la herramienta A muestra exactamente los valores y resultados que tenía, sin reiniciarse.

**CA-4 — Cerrar una pestaña**
GIVEN una pestaña abierta
WHEN el usuario presiona su botón de cierre (ícono `Close`)
THEN la pestaña desaparece y su estado se pierde definitivamente: reabrir la misma página crea una pestaña nueva en estado inicial. Si la pestaña cerrada era la activa, se activa la pestaña vecina de la derecha (o la de la izquierda si no hay); si no era la activa, la pestaña activa no cambia.

**CA-5 — Última pestaña cerrada**
GIVEN queda una sola pestaña abierta
WHEN el usuario la cierra
THEN el contenido principal muestra la pantalla de inicio con accesos a las herramientas, y el navbar queda sin pestañas.

**CA-6 — Reordenar arrastrando**
GIVEN hay dos o más pestañas abiertas
WHEN el usuario arrastra una pestaña horizontalmente y la suelta en otra posición
THEN las pestañas quedan en el nuevo orden y este se mantiene al cambiar de pestaña activa.

**CA-7 — Muchas pestañas (overflow)**
GIVEN hay más pestañas de las que caben en el ancho del navbar
WHEN se abre una pestaña adicional
THEN las pestañas se encogen hasta un ancho mínimo truncando el título con puntos suspensivos, y si aun así no caben, la franja de pestañas permite desplazamiento horizontal sin desplazar el resto de la página. Los botones de tema e idioma permanecen visibles a la derecha.

**CA-8 — Navegación atrás/adelante por pestaña**
GIVEN una pestaña activa cuyo contenido ha navegado por varias rutas internas
WHEN el usuario presiona el botón redondo ← (`ArrowLeft`)
THEN el contenido regresa a la ruta anterior de esa pestaña; y WHEN presiona → (`ArrowRight`) THEN avanza a la ruta desde la que retrocedió. Navegar a una ruta nueva vacía el historial de "adelante". Cada botón se muestra deshabilitado cuando su pila está vacía. El historial es independiente por pestaña y se elimina al cerrarla.

**CA-9 — Breadcrumb en el contenido**
GIVEN una pestaña activa
WHEN el usuario mira la parte superior del contenido principal
THEN ve, a la izquierda: los botones ←/→, un separador vertical como el del navbar, y el breadcrumb de la ruta actual de esa pestaña. Cambiar de pestaña o navegar dentro de la pestaña actualiza el breadcrumb de inmediato.

**CA-10 — Acciones de la herramienta activa**
GIVEN la herramienta de la pestaña activa define acciones (por ejemplo, Generar Ejercicios)
WHEN el usuario mira la esquina superior derecha del contenido principal
THEN ve un botón si la acción es una sola, o un menú desplegable si son varias; al cambiar de pestaña las acciones cambian a las de la nueva herramienta activa, y si la herramienta no define acciones, la esquina queda vacía.

**CA-11 — Recarga de la página**
GIVEN hay pestañas abiertas con estado
WHEN el usuario recarga la aplicación (F5)
THEN las pestañas y su estado no se restauran: la aplicación abre en la pantalla de inicio sin pestañas.

**CA-12 — Bilingüe**
GIVEN el usuario cambia el idioma de la aplicación
WHEN mira el navbar y el contenido
THEN los títulos de las pestañas, los tooltips, los `aria-label` de los botones (cerrar, ←, →) y las etiquetas del breadcrumb y de las acciones se muestran en el idioma activo (es/en), incluidas las pestañas ya abiertas.

---

## Fuera de alcance

- Persistencia de pestañas o de estado entre recargas (localStorage/sessionStorage).
- Pestañas duplicadas de una misma herramienta con estados independientes.
- Atajos de teclado (Ctrl+W, Ctrl+Tab), cierre con clic de rueda y anclado (pin) de pestañas.
- La definición de las acciones concretas de cada herramienta (cada una llega en la US de su componente; aquí solo el contenedor que las muestra).

---

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
