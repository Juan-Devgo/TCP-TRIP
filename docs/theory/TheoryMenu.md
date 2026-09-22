# US-### — Menú de Teoría (navegación curada por el administrador)

**Componente:** `src/features/admin-theory/components/TheoryMenuManager.tsx`
**Navegación:** `src/components/common/AppSidebar.tsx` (grupo `Teoría`) · `src/config/navigation.ts`
**Contrato compartido:** `src/lib/theory/contract.ts` · **Iconos:** `src/components/common/TheoryIcon.tsx`
**Cliente de datos:** `src/services/theory.ts` · **Caché compartida:** `src/hooks/useTheoryMenu.ts`
**API:** `src/api/theory.ts` · **Persistencia:** `src/db/domains/theory-menu/`

**Prioridad:** Alta
**Estado:** Hecho

---

## Historia de usuario

- **Como** administrador de la plataforma, y como estudiante que busca el material de un tema,
- **Quiero** que el administrador construya el menú de la sección Teoría —creando secciones con nombre e icono y asignándoles las presentaciones aprobadas—,
- **Para que** el estudiante encuentre la teoría **en el orden en que se enseña el curso**, y no en un índice generado por fecha de publicación.

### Valor

- **Para el estudiante:** la barra lateral responde "¿dónde está lo de la capa de transporte?" sin leer una lista de todo lo publicado. Cada entrada lleva además su porcentaje de lectura, así que también responde "¿por dónde iba?".
- **Para el profesor:** su presentación aprobada aparece en el sitio del curso que le corresponde; no compite por atención en un índice plano.
- **Para el administrador:** la navegación es contenido, no código. Publicar y ordenar material dejó de requerir un cambio en `src/config/navigation.ts` y un despliegue.

---

## Criterios de aceptación

### Construir el menú (administrador)

**CA-1 — Crear una sección**
GIVEN un administrador en `Administrador › Menú de Teoría`
WHEN escribe un nombre, elige un icono de la lista y crea la sección
THEN la sección aparece al final del menú, vacía, y el grupo `Teoría` de la barra lateral la muestra de inmediato sin recargar la página.

**CA-2 — El icono es un nombre, no un dibujo**
GIVEN el formulario de una sección
WHEN el administrador despliega los iconos
THEN solo puede elegir entre los nombres de `THEORY_ICON_NAMES`; y THEN una petición con cualquier otro valor se rechaza con 400 enumerando los permitidos, porque el nombre se convierte en un componente al renderizar.

**CA-3 — Renombrar y cambiar el icono**
GIVEN una sección existente
WHEN el administrador cambia su nombre o su icono y guarda
THEN el cambio se refleja en el panel y en la barra lateral; y GIVEN el nombre quedó vacío, WHEN intenta guardar, THEN el botón está deshabilitado y el servidor también lo rechazaría.

**CA-4 — Ordenar las secciones**
GIVEN varias secciones
WHEN el administrador sube o baja una
THEN intercambia su posición con la vecina y el servidor **renumera** todas de `0` a `n-1`, de modo que el orden no se degrada tras varios movimientos; y THEN subir la primera (o bajar la última) no es posible.

**CA-5 — Eliminar una sección**
GIVEN una sección con entradas
WHEN el administrador la elimina y confirma
THEN desaparecen la sección y sus entradas, **no** las presentaciones: cada una vuelve a estar disponible para asignarse a otra sección.

**CA-6 — Solo se asigna material aprobado**
GIVEN el selector de presentaciones de una sección
WHEN el administrador lo abre
THEN solo aparecen las presentaciones **publicadas** que todavía no están en ninguna sección; y THEN intentar asignar un borrador se rechaza con 409 (`not-published`).

**CA-7 — Una presentación, un lugar**
GIVEN una presentación ya asignada a una sección
WHEN se intenta asignarla también a otra
THEN se rechaza con 409 (`already-listed`), porque el mismo material en dos sitios del menú es una ambigüedad para el lector, no una comodidad.

**CA-8 — Nombre en el menú opcional**
GIVEN el administrador asigna una presentación
WHEN deja el campo de nombre vacío
THEN la entrada usa el título del autor —y sigue usándolo si el autor lo cambia y se vuelve a aprobar—; y WHEN escribe un nombre, THEN ese nombre manda hasta que se pulse `Usar el título del autor`.

**CA-9 — Mover y ordenar entradas**
GIVEN una sección con varias entradas
WHEN el administrador sube o baja una
THEN cambia de lugar dentro de su sección; y WHEN elige otra sección en el selector de la entrada, THEN se mueve allí, al final.

**CA-10 — Quitar una entrada**
GIVEN una entrada del menú
WHEN el administrador la quita
THEN desaparece del menú y su presentación vuelve a la lista de asignables; la presentación sigue publicada y su enlace directo sigue funcionando.

**CA-11 — Cambios de otros se reflejan**
GIVEN el administrador acaba de mover, crear o borrar algo
WHEN la operación termina
THEN el panel **recarga** del servidor en lugar de parchear su estado local, porque un movimiento renumera filas que el cliente no vio y una entrada puede haber cambiado de visibilidad desde otra pestaña.

### El menú sigue a la revisión

**CA-12 — Retirar una presentación la oculta del menú**
GIVEN una entrada cuya presentación su autor retira de Teoría
WHEN un estudiante mira la barra lateral
THEN la entrada ya no está, y su sección sigue ahí (vacía si era la única); y THEN nadie tuvo que borrar nada: el menú resuelve el slug contra la copia publicada.

**CA-13 — El administrador ve lo que el lector no**
GIVEN la misma entrada retirada
WHEN el administrador abre el panel
THEN la entrada aparece marcada como `No visible`, con la explicación de que volverá al aprobarse otra vez; así puede decidir si la quita o la espera.

**CA-14 — Volver a aprobar recupera la entrada**
GIVEN una entrada oculta porque su presentación se retiró
WHEN se envía y se aprueba de nuevo
THEN la entrada vuelve a verse, con el nombre que el administrador le había puesto, aunque el slug sea nuevo: la fila apunta a la presentación, no al slug.

**CA-15 — Borrar la presentación borra la entrada**
GIVEN una entrada del menú
WHEN su autor elimina la presentación
THEN la entrada desaparece por cascada; no queda una fila apuntando a nada.

### Leer el menú (cualquiera)

**CA-16 — El menú es público**
GIVEN un visitante sin sesión
WHEN abre la aplicación
THEN ve el menú de Teoría completo y puede leer cualquier presentación publicada; la navegación de contenido educativo no exige iniciar sesión.

**CA-17 — Avance por entrada**
GIVEN un estudiante con sesión que empezó varias presentaciones
WHEN mira el menú
THEN cada entrada muestra su porcentaje (`Completada` a partir del 95 %), todo en **una sola petición**; y GIVEN no tiene sesión, WHEN se dibuja el menú, THEN no se pide ningún progreso.

**CA-18 — Abrir una entrada no abre una pestaña nueva**
GIVEN el estudiante está leyendo una presentación
WHEN abre otra desde el menú
THEN sigue en la misma pestaña `Presentaciones de Teoría`, la URL cambia a `/theory/presentations/<slug>` y el botón atrás de la pestaña vuelve a la anterior.

**CA-19 — Fallo del menú no rompe la aplicación**
GIVEN el servidor no responde el menú
WHEN la barra lateral se dibuja
THEN el grupo `Teoría` muestra solo sus entradas estáticas, el error queda en consola y el resto de la aplicación funciona; las presentaciones siguen siendo accesibles por URL.

### Transversales

**CA-20 — Solo un administrador edita el menú**
GIVEN un usuario que no es administrador
WHEN llama a cualquier ruta de `/api/admin/theory/`
THEN recibe 401 si no tiene sesión y 403 si la tiene pero no el rol; y THEN escribir la ruta del panel a mano muestra la página y luego el mensaje de que hace falta ser administrador.

**CA-21 — Los límites están en el servidor**
GIVEN los topes de `src/lib/theory/contract.ts` (20 secciones, 50 entradas por sección, 80/120 caracteres de nombre)
WHEN se superan
THEN el servidor responde 409 o 400 según el caso, aunque el cliente ya lo hubiera impedido; el cliente solo evita el viaje.

**CA-22 — Queda registro de quién lo puso**
GIVEN cualquier sección o entrada
WHEN se crea
THEN la fila guarda el id de Clerk del administrador que la creó, por la misma razón que el registro de revisiones: es un cambio en lo que ve todo el mundo.

---

## Fuera de alcance

- **Arrastrar y soltar** para ordenar: el orden se cambia con flechas, que es suficiente para un menú de dos docenas de entradas y no necesita dependencias.
- **Secciones anidadas:** el menú tiene dos niveles (sección → entrada), los mismos que el resto de la barra lateral.
- **Traducir los nombres de las secciones:** son contenido que escribe el administrador, no copia de la interfaz; se guardan tal cual en un solo idioma.
- **Entradas hacia algo que no sea una presentación** (un enlace externo, una herramienta): la tabla apunta a `presentations`, y ampliarlo sería otra historia.

---

## Estado de la implementación

Implementado y cubierto por pruebas: CA-1 a CA-22.

- Ciclo completo del menú —secciones, entradas, orden, topes, y el seguimiento de aprobaciones y retiradas— en `src/db/domains/theory-menu/theoryMenu.repository.test.ts`.
- La decisión del rol vive en `src/api/guards.ts` sobre `src/api/auth.ts`; el cliente solo esconde.
