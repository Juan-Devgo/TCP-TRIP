# US-### — Conversor de Bases Numéricas

**Componente:** `src/components/tools/NumberBaseConverter.tsx`
**Lógica de dominio:** `src/lib/numberBase.ts`

---

## Historia de usuario

- **Como** estudiante de redes que trabaja con campos de cabecera en binario, octal, decimal y hexadecimal,
- **Quiero** convertir un valor entre esas cuatro bases desde un teclado que solo me permita escribir dígitos válidos, y poder fijar la longitud del resultado en dígitos,
- **Para** resolver por mi cuenta las dudas simples y mecánicas de conversión (¿cuánto es `C0A8` en binario?, ¿cuántos bits ocupa este campo?) sin depender del docente, y llegar a la asesoría solo con las dudas conceptuales complejas, optimizando el tiempo con el profesor.

**Prioridad:** Should
**Estado:** Hecho

---

## Valor

**Para el estudiante:** elimina el error aritmético manual al pasar entre bases y hace visible la relación entre el ancho de un campo de cabecera y su representación (relleno con ceros a la izquierda). El teclado deshabilita los dígitos ilegales en la base de origen, así que el propio widget enseña qué símbolos pertenecen a cada base sin necesidad de corrección externa.

**Para el docente:** las preguntas repetitivas de conversión dejan de consumir asesoría. El tiempo con el profesor se reserva para lo que la herramienta no puede responder (por qué un campo tiene ese ancho, qué significa el valor dentro del protocolo). Además, el mismo componente sirve de apoyo en modo presentación y como base para generar ejercicios de evaluación.

---

## Criterios de aceptación

**CA-1 — Selección de bases**
GIVEN el conversor está visible
WHEN el estudiante abre el selector de la fila "De:" o de la fila "A:"
THEN puede escoger entre BIN (2), OCT (8), DEC (10) y HEX (16) de forma independiente en cada fila.

**CA-2 — Teclado restringido a la base de origen**
GIVEN la base de origen es BIN
WHEN el estudiante mira el teclado
THEN solo `0` y `1` están habilitados, y el resto de teclas de dígito y de letra hexadecimal aparecen deshabilitadas con cursor `not-allowed`, sin permitir escribirlas.

**CA-3 — Cambio de base de origen limpia el operando**
GIVEN el estudiante ha escrito `FF` en base HEX
WHEN cambia la base de origen a DEC
THEN el operando se vacía, porque los dígitos válidos en la base anterior pueden no serlo en la nueva.

**CA-4 — Conversión en vivo**
GIVEN hay un operando escrito
WHEN el estudiante presiona una tecla, borra un carácter o cambia la base destino
THEN el resultado se recalcula de inmediato, en mayúsculas; y GIVEN el operando está vacío, THEN el resultado se muestra como `0`.

**CA-5 — Longitud del resultado y relleno con ceros**
GIVEN el estudiante fija la longitud en `8`
WHEN convierte `5` de DEC a BIN
THEN el resultado es `00000101`, rellenado a la izquierda hasta 8 dígitos; y WHEN el resultado natural excede la longitud pedida, THEN nunca se trunca: se muestra completo.

**CA-6 — Límite de longitud**
GIVEN el campo de longitud acepta valores entre 1 y 64 (una palabra de 64 bits)
WHEN el estudiante escribe un valor mayor a 64
THEN el campo se marca como inválido, se muestra el mensaje de error correspondiente y el cálculo se hace con 64; y WHEN el valor es vacío o menor a 1, THEN se usa 1.

**CA-7 — Teclado físico equivalente al teclado en pantalla**
GIVEN el foco no está dentro del campo de longitud
WHEN el estudiante pulsa una tecla física válida en la base de origen (mayúscula o minúscula), `Backspace` o `Escape`
THEN se aplica la misma acción que la tecla en pantalla (escribir dígito, borrar último carácter, limpiar) y la tecla correspondiente destella; y GIVEN el foco está en el campo de longitud, THEN el teclado físico escribe en ese campo y no en el operando.

**CA-8 — Atajo LEN**
GIVEN el estudiante quiere cambiar la longitud sin usar el mouse sobre el campo
WHEN presiona la tecla `LEN`
THEN el campo de longitud recibe el foco y su contenido queda seleccionado para sobrescribirlo.

**CA-9 — Copiar valores**
GIVEN hay un operando o un resultado en pantalla
WHEN el estudiante presiona el botón de copiar de esa fila
THEN el valor se copia al portapapeles y el ícono cambia a un check durante ~1,2 s como confirmación.

**CA-10 — Precisión de 64 bits**
GIVEN el estudiante convierte un valor de 16 dígitos hexadecimales (64 bits)
WHEN se muestra el resultado
THEN es exacto, sin pérdida de precisión, porque el parseo y el formateo usan `BigInt` y no `Number`.

**CA-11 — Entrada inválida**
GIVEN por cualquier motivo el operando contiene un carácter ilegal en la base de origen
WHEN se intenta convertir
THEN se muestra el texto de error traducido en lugar de un resultado numérico, sin romper la interfaz.

**CA-12 — Bilingüe**
GIVEN el estudiante cambia el idioma de la aplicación
WHEN vuelve al conversor
THEN títulos, etiquetas, tooltips, `aria-label` y mensajes de error se muestran en el idioma activo (es/en), sin cadenas quemadas en el componente.

---

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
