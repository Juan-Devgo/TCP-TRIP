# US-### — Calculadora de Checksum IPv4

**Componente:** `src/features/ipv4-checksum/components/IPv4Checksum.tsx`
**Lógica de dominio:** `src/features/ipv4-checksum/lib/checksum.ts`
**Generador de ejercicios:** `src/features/ipv4-checksum/exercises/checksumExercises.ts`

---

## Historia de usuario

- **Como** estudiante de redes que resuelve ejercicios de checksum de cabeceras IPv4,
- **Quiero** escribir o pegar una cabecera IPv4, elegir si quiero calcular su checksum o verificarla, y ver el procedimiento paso a paso con su interpretación,
- **Para** comprobar por mi cuenta la suma en complemento a uno, el plegado del acarreo y el complemento final sin depender del docente para revisar cada cuenta, y llegar a la asesoría solo con las dudas conceptuales.

**Prioridad:** Must
**Estado:** Hecho

---

## Valor

**Para el estudiante:** elimina los errores mecánicos típicos del checksum: agrupar mal los bytes en palabras de 16 bits, sumar el campo checksum con un valor viejo en lugar de 0000, descartar el acarreo en vez de sumarlo de vuelta (o olvidar volver a plegarlo si genera otro), y complementar mal en hexadecimal. Ver qué campos forman cada palabra y el plegado en binario vuelve visible por qué una cabecera íntegra verifica en 0000.

**Para el docente:** deja de revisar sumas hexadecimales a mano y de responder «¿me dio bien el checksum?» o «¿esta cabecera se acepta?». Puede generar ejercicios en PDF con clave de respuestas. La asesoría queda para lo que la herramienta no responde: por qué el checksum cubre solo la cabecera, por qué se recalcula en cada salto al bajar el TTL, qué errores no detecta y en qué se diferencia del checksum de TCP/UDP.

---

## Criterios de aceptación

**CA-1 — Selector de modo**
GIVEN el estudiante abre Calculadoras › Checksum IPv4
WHEN la herramienta termina de cargar
THEN ve un selector con los modos «Calcular» y «Verificar», con «Calcular» elegido, y una frase que explica qué hace cada modo. Debajo, un interruptor «Mostrar secuencia de bytes», apagado, y la cabecera como formulario (CA-2): el formulario es la única forma de entrada y siempre está visible.

**CA-2 — Cabecera como formulario con valores por defecto**
GIVEN la herramienta está abierta
WHEN termina de cargar
THEN ve la cabecera dibujada como la rejilla de 32 bits del RFC 791, con un campo por cada campo de la cabecera en decimal (las IPs en notación punteada). Versión (4) e IHL (5) aparecen fijos; ToS 0, Flags DF, Fragment Offset 0, TTL 64, Protocolo 6 (TCP) y Checksum 0000 vienen precargados y son editables; Total Length, Identificación, IP origen e IP destino los escribe el estudiante.

**CA-3 — Equivalente hexadecimal por campo**
GIVEN el estudiante escribe un valor válido en un campo
WHEN termina de escribir
THEN junto al campo aparece su valor en hexadecimal con el ancho en bits del campo (p. ej. TTL 64 → `40`).

**CA-4 — Secuencia de bytes en hexadecimal**
GIVEN el estudiante enciende «Mostrar secuencia de bytes»
WHEN aparece el campo de la secuencia sobre el formulario
THEN muestra en hexadecimal los 20 bytes de la cabecera que describe el formulario (vacío si aún no está completa). Si pega o escribe ahí 20 bytes, con o sin espacios, saltos de línea, `:` o prefijo `0x`, todos los campos del formulario se llenan con los valores decodificados, incluido el Checksum; si cambia un campo del formulario, la secuencia se reescribe en tiempo real con la cabecera resultante (mientras un campo quede vacío o inválido, conserva la última cabecera válida). Apagar el interruptor solo oculta la secuencia: el formulario conserva sus valores.

**CA-5 — Hexadecimal pegado inválido**
GIVEN el estudiante pega un texto que no son exactamente 20 bytes, contiene dígitos no hexadecimales, decodifica Versión ≠ 4 o IHL ≠ 5, o tiene encendido el bit reservado de Flags
WHEN termina de pegar
THEN ve un error que explica el motivo y cita el RFC 791, el formulario no cambia y el resultado queda atenuado como desactualizado hasta que la secuencia vuelva a decodificar.

**CA-6 — Campo fuera de rango**
GIVEN el estudiante escribe un valor que no cabe en el ancho del campo (ToS, TTL o Protocolo fuera de 0–255; Identificación fuera de 0–65535; Fragment Offset fuera de 0–8191; Total Length menor que 20 o mayor que 65535; Checksum que no sea de 4 dígitos hex; un prefijo `0x` pegado, como el del resultado copiado, se descarta) o una IP mal formada
WHEN termina de escribir
THEN el campo muestra un error que cita el RFC 791 y no se calcula un resultado nuevo (ver CA-16).

**CA-7 — Cálculo en tiempo real**
GIVEN todos los campos son válidos
WHEN el estudiante edita cualquier campo o cambia de modo
THEN el procedimiento y el resultado se actualizan al instante, sin botón de calcular.

**CA-8 — Paso 1: palabras de 16 bits**
GIVEN hay un resultado
WHEN el estudiante mira el paso 1
THEN ve el hexadecimal de la cabecera tomado directamente de 4 en 4 dígitos (cada dígito son 4 bits), sin pasar por pares de bytes: sus 10 palabras de 16 bits (p. ej. `4500 003c 1c46 4000 4006 0000 ac10 0a63 ac10 0a0c`), cada una con los campos que la forman, y la palabra del Checksum resaltada con una nota de su papel según el modo (0000 al calcular, el valor recibido al verificar).

**CA-9 — Paso 2: suma de las palabras**
GIVEN hay un resultado
WHEN el estudiante mira el paso 2
THEN ve la suma de las 10 palabras en columna en hexadecimal y el total de más de 16 bits (p. ej. `24e17`), con los dígitos que exceden los 16 bits resaltados como acarreo.

**CA-10 — Paso 3: plegado del acarreo**
GIVEN hay un resultado
WHEN el estudiante mira el paso 3
THEN ve en hexadecimal y en binario cómo el acarreo se suma a los 16 bits inferiores (p. ej. `0x4e17 + 0x0002 = 0x4e19`), con una frase que explica por qué en complemento a uno el acarreo no se descarta; si el plegado produce un nuevo acarreo, se muestra un segundo plegado.

**CA-11 — Paso 4: complemento a uno**
GIVEN hay un resultado
WHEN el estudiante mira el paso 4
THEN ve la suma plegada y su complemento bit a bit en binario, alineados, y el resultado en hexadecimal (p. ej. `~0x4e19 = 0xb1e6`).

**CA-12 — Calcular: resultado normal**
GIVEN el modo es «Calcular» y el campo Checksum vale 0000
WHEN el resultado es distinto de 0000
THEN se muestra en verde un mensaje de éxito «Este es el checksum de la cabecera» con el valor copiable y una acción «Usar este checksum» que lo escribe en el campo Checksum y cambia a «Verificar», donde la cabecera se acepta (CA-14).

**CA-13 — Calcular con el Checksum ya lleno**
GIVEN el modo es «Calcular» y el campo Checksum no vale 0000
WHEN se muestra el resultado
THEN aparece en amarillo un aviso que explica que para calcular el campo Checksum debe valer 0000, con una acción «Poner en 0000»; si además el resultado es 0000, el aviso dice «Parece que el checksum de esta cabecera ya fue calculado».

**CA-14 — Verificar: cabecera aceptada**
GIVEN el modo es «Verificar»
WHEN el resultado es 0000
THEN se muestra en verde un mensaje de éxito «La cabecera está correcta».

**CA-15 — Verificar: cabecera rechazada**
GIVEN el modo es «Verificar»
WHEN el resultado es distinto de 0000
THEN se muestra en rojo un error «Parece que la cabecera se corrompió en el camino (rechazada)», que indica que el receptor la descarta.

**CA-16 — Resultado desactualizado**
GIVEN ya había un resultado en pantalla
WHEN el estudiante deja un campo con error o lo vacía para reescribirlo
THEN el resultado anterior sigue visible atenuado y sin poder interactuar con él, con un aviso de que está desactualizado, y la página conserva su altura; si no había resultado previo, se muestra el estado vacío.

**CA-17 — Cargar ejemplo**
GIVEN la herramienta está abierta
WHEN el usuario usa la acción «Cargar ejemplo» repetidas veces
THEN se cargan por turnos cabeceras predefinidas: una con Checksum 0000 (la de `0xb1e6`), una con el checksum correcto y una con un byte alterado, de modo que cada interpretación de CA-12 a CA-15 pueda verse.

**CA-18 — Limpiar**
GIVEN hay datos en el formulario
WHEN el usuario usa la acción «Limpiar» o pulsa Escape
THEN el formulario vuelve a sus valores por defecto, el campo de pegado se vacía y se muestra el estado vacío.

**CA-19 — Generar ejercicios**
GIVEN la herramienta está abierta
WHEN el usuario usa la acción «Generar ejercicios» y confirma dificultad, cantidad y clave de respuestas
THEN descarga un PDF con la plantilla institucional cuyos enunciados piden: calcular el checksum de una cabecera en hexadecimal con Checksum 0000; decidir si una cabecera completa se acepta o se rechaza; o plegar el acarreo de una suma dada y complementarla. Con la clave al final si se pidió.

**CA-20 — Escala de dificultad**
GIVEN el usuario genera ejercicios
WHEN elige Fácil, Medio o Difícil
THEN Fácil pide pasos sueltos (plegar y complementar una suma dada) con un solo plegado; Medio pide calcular o verificar una cabecera completa; Difícil incluye cabeceras con un solo bit alterado y sumas que requieren doble plegado. Ningún enunciado usa una cabecera que la calculadora rechazaría.

**CA-21 — Disponible en el panel docente**
GIVEN un docente abre «Crear ejercicios»
WHEN elige las herramientas que combina el conjunto
THEN Checksum IPv4 aparece entre ellas.

**CA-22 — Volver arriba**
GIVEN el estudiante bajó por los pasos del resultado
WHEN la página se ha desplazado más allá de las entradas
THEN aparece un botón flotante en la esquina inferior derecha que lo lleva de vuelta al inicio de la herramienta.

---

## Fuera de alcance

- Checksum de TCP y UDP (pseudo-cabecera).
- IPv6, que no tiene checksum de cabecera.
- Opciones IP: la cabecera es siempre de 20 bytes (IHL 5).
- Actualización incremental del checksum (RFC 1624).

---

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
