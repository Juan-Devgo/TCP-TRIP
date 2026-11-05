# US-### — Calculadora de Fragmentación IPv4

**Componente:** `src/features/ipv4-fragmentation/components/IPv4Fragmentation.tsx`
**Lógica de dominio:** `src/features/ipv4-fragmentation/lib/fragmentation.ts`
**Generador de ejercicios:** `src/features/ipv4-fragmentation/exercises/fragmentationExercises.ts`

---

## Historia de usuario

- **Como** estudiante de redes que resuelve ejercicios de fragmentación de datagramas IPv4,
- **Quiero** escribir la longitud total de un datagrama y el MTU del enlace y ver al instante la cabecera original y cada fragmento resultante,
- **Para** comprobar por mi cuenta cuántos fragmentos se generan y qué datos, offset y bandera MF lleva cada uno, sin depender del docente para revisar el cálculo, y llegar a la asesoría solo con las dudas conceptuales, optimizando el tiempo con el profesor.

**Prioridad:** Must
**Estado:** Hecho

---

## Valor

**Para el estudiante:** elimina los errores mecánicos típicos de la fragmentación: olvidar restar los 20 bytes de cabecera al MTU, expresar el offset en bytes en lugar de bloques de 8, dejar MF=1 en el último fragmento o cambiar la identificación entre fragmentos. La cabecera dibujada como la rejilla de 32 bits del RFC 791 hace visible qué campos cambian de un fragmento a otro (longitud total, MF, desplazamiento del fragmento) y cuáles se conservan.

**Para el docente:** deja de verificar a mano tablas de fragmentación y de responder «¿cuántos fragmentos salen?» o «¿qué offset lleva el tercero?». Puede generar ejercicios en PDF con clave de respuestas. La asesoría queda para lo que la herramienta no responde: para qué existe DF, Path MTU Discovery, el costo de fragmentar y el reensamblado en el destino.

---

## Criterios de aceptación

**CA-1 — Formulario de entrada**
GIVEN el estudiante abre Calculadoras › Fragmentación IPv4
WHEN la herramienta termina de cargar
THEN ve los campos Longitud total (bytes) y MTU (bytes). Debajo, en los resultados, la vista «Simulación completa» ofrece una sección «Otros campos» plegada que contiene Identificación, TTL, Protocolo, IP origen e IP destino (la vista «Tabla» no la muestra, ver CA-13). DF no se pide: la herramienta siempre permite fragmentar y lo muestra con valor 0 en cada cabecera.

**CA-2 — Valores por defecto de los campos opcionales**
GIVEN la sección «Otros campos» está vacía
WHEN se calculan los resultados
THEN se usan una identificación, un TTL de 64, el protocolo 17 (UDP) y unas IPs de ejemplo, visibles como texto de ayuda (placeholder) en sus campos, y esos mismos valores aparecen en todas las tarjetas.

**CA-3 — Cálculo en tiempo real**
GIVEN el estudiante escribe longitud total 4000 y MTU 1500
WHEN termina de escribir, sin pulsar ningún botón
THEN aparece la tarjeta de la cabecera original y, debajo, una flecha que apunta a tres tarjetas de fragmento: longitud total 1500, MF 1, desplazamiento 0; longitud total 1500, MF 1, desplazamiento 185; longitud total 1040, MF 0, desplazamiento 370.

**CA-4 — Cabecera como rejilla RFC 791**
GIVEN hay resultados visibles
WHEN el estudiante observa cualquier tarjeta
THEN ve la cabecera dibujada como la rejilla de 32 bits del RFC 791, con cada campo de un ancho proporcional a sus bits y su valor en decimal: Versión 4, IHL 5, DiffServ 0, Longitud total, Identificación, flags (reservado 0, DF, MF), Desplazamiento del fragmento, TTL (64 por defecto), Protocolo (17 por defecto), Suma de verificación 0, IP origen e IP destino.

**CA-5 — Coherencia entre fragmentos**
GIVEN hay dos o más fragmentos
WHEN el estudiante compara las tarjetas
THEN todas comparten Identificación, IP origen, IP destino, Versión, IHL, DiffServ, TTL, Protocolo, Suma de verificación y DF, y solo difieren en longitud total, MF y desplazamiento del fragmento.

**CA-6 — Offset legible**
GIVEN un fragmento tiene offset distinto de 0
WHEN el estudiante lee su campo Desplazamiento del fragmento
THEN ve el valor en bloques de 8 bytes acompañado de su equivalente en bytes (p. ej. «185 (1480 B)»).

**CA-7 — Datagrama que no requiere fragmentación**
GIVEN la longitud total es menor o igual que el MTU
WHEN se calculan los resultados
THEN se muestra un aviso de que el datagrama no requiere fragmentación y una sola tarjeta con MF 0 y offset 0, sin flecha ni fragmentos.

**CA-8 — MTU fuera de rango**
GIVEN el estudiante escribe un MTU menor que 68 o mayor que 65535
WHEN termina de escribir
THEN el campo muestra un error que indica que el rango lo establece el RFC 791 y no se calcula un resultado nuevo (ver CA-12).

**CA-9 — MTU cuyos datos no son múltiplo de 8**
GIVEN el estudiante escribe un MTU dentro del rango cuya carga útil (MTU − 20) no es múltiplo de 8, p. ej. 576 (556 bytes)
WHEN termina de escribir
THEN el campo muestra un error que explica que los datos de cada fragmento deben ser múltiplo de 8 porque el offset se mide en bloques de 8 bytes, cita el RFC 791 y no se calcula un resultado nuevo (ver CA-12).

**CA-10 — Longitud total fuera de rango**
GIVEN el estudiante escribe una longitud total menor que 21 o mayor que 65535
WHEN termina de escribir
THEN el campo muestra un error, se cita el RFC 791 y no se calcula un resultado nuevo (ver CA-12).

**CA-11 — Identificación, TTL, Protocolo o IP inválidos**
GIVEN el estudiante escribe en «Otros campos» una identificación fuera de 0–65535, un TTL o un Protocolo fuera de 0–255 (campos de 8 bits) o una IP mal formada
WHEN termina de escribir
THEN ese campo muestra un error que cita el RFC 791 (§3.1), la sección se despliega sola si estaba plegada para que el error no quede oculto, y no se calcula un resultado nuevo hasta que se corrija o se vacíe (ver CA-12).

**CA-12 — Resultado desactualizado**
GIVEN ya había un resultado en pantalla
WHEN el estudiante deja un campo con error o vacía la longitud total o el MTU para reescribirlo
THEN el resultado anterior sigue visible atenuado y sin poder interactuar con él, con un aviso de que está desactualizado, y la página conserva su altura; si no había resultado previo, se muestra el estado vacío.

**CA-13 — Vista de resultados**
GIVEN hay resultados visibles
WHEN el estudiante elige entre «Simulación completa» y «Tabla»
THEN «Simulación completa» muestra la sección «Otros campos» y las tarjetas de cabecera (CA-3 a CA-7), y «Tabla» muestra una sola tabla con una fila para el original y una por fragmento, con su número, las columnas Longitud total, DF, MF y Desplazamiento del fragmento resaltadas y, junto a la longitud total, una columna de datos (LT − 20); debajo, una verificación suma esa columna (agrupando los tamaños repetidos, p. ej. «1480 × 2 + 1020 = 3980 B»), le añade los 20 bytes de cabecera y confirma que el resultado coincide con la longitud total original.

**CA-13b — «Otros campos» solo en la simulación completa**
GIVEN el estudiante escribió valores en «Otros campos» (o un valor inválido) y cambia a la vista «Tabla»
WHEN la tabla se calcula
THEN la sección no se muestra, porque la tabla no dibuja ninguno de esos campos; el cálculo usa los valores por defecto y los errores de esos campos no bloquean ni atenúan la tabla. Al volver a «Simulación completa», la sección reaparece con lo que el estudiante había escrito.

**CA-14 — Controles flotantes**
GIVEN el estudiante se desplazó hacia abajo hasta que el formulario dejó de verse
WHEN mira la esquina inferior de la pantalla
THEN aparecen, con una transición que sube y se desvanece (y baja al desvanecerse cuando el formulario vuelve a verse), Longitud total y MTU editables y un botón para volver arriba; al cambiar los valores ahí, el formulario y los resultados se actualizan en tiempo real, y el primer error del formulario se muestra junto a ellos.

**CA-15 — Divisiones largas**
GIVEN el datagrama se divide en cientos de fragmentos (p. ej. longitud total 65535 y MTU 68)
WHEN el estudiante escribe o desplaza la página
THEN los campos responden sin trabarse y los fragmentos se van mostrando por tandas al acercarse al final de la lista, con un botón «Mostrar más» que indica cuántos se muestran del total.

**CA-16 — Cargar ejemplo**
GIVEN la herramienta está abierta
WHEN el estudiante usa la acción «Cargar ejemplo» repetidas veces
THEN cada vez se llenan todos los campos (incluidos los de «Otros campos») con el siguiente ejemplo predefinido, rotando entre ellos, y los resultados se recalculan.

**CA-17 — Limpiar**
GIVEN hay campos con valores
WHEN el estudiante usa la acción «Limpiar» o pulsa Escape
THEN todos los campos se vacían y los resultados desaparecen.

**CA-18 — Generar ejercicios**
GIVEN la herramienta está abierta
WHEN el usuario usa la acción «Generar ejercicios» y confirma dificultad, cantidad y clave de respuestas
THEN descarga un PDF con la plantilla institucional cuyos enunciados piden, a partir de una longitud total y un MTU: el número de fragmentos, el desplazamiento del fragmento n, la longitud total o los datos del fragmento n, o completar la tabla de todos los fragmentos (datos, longitud total, MF y desplazamiento); con la clave al final si se pidió.

**CA-19 — Escala de dificultad**
GIVEN el usuario genera ejercicios
WHEN elige Fácil, Medio o Difícil
THEN Fácil usa MTU 1500, 2–3 fragmentos y una pregunta puntual; Medio usa MTU variados, 3–6 fragmentos y pregunta por un fragmento intermedio o el último; Difícil usa muchos fragmentos y pide la tabla completa. Ningún enunciado usa un MTU que la calculadora rechazaría.

**CA-20 — Disponible en el panel docente**
GIVEN un docente abre «Crear ejercicios»
WHEN elige las herramientas que combina el conjunto
THEN Fragmentación IPv4 aparece entre ellas.

---

## Fuera de alcance

- Refragmentación multi-salto (un fragmento que vuelve a fragmentarse en un enlace con MTU menor).
- Cálculo real del checksum: siempre vale 0.
- Opciones IP: la cabecera es siempre de 20 bytes (IHL 5).
- Reensamblado en el destino.

---

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
