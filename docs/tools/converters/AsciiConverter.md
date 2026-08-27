# US-### — Conversor ASCII

**Componente:** `src/features/ascii-converter/components/AsciiConverter.tsx`
**Lógica de dominio:** `src/features/ascii-converter/lib/ascii.ts`

---

## Historia de usuario

- **Como** estudiante de redes que lee capturas y volcados donde el contenido de un mensaje aparece como bytes,
- **Quiero** escribir texto y ver sus códigos por carácter en BIN, OCT, DEC o HEX —y al revés, pegar un flujo de códigos y ver el texto— pudiendo comparar el mismo flujo leído como ASCII de 8 bits o como UTF‑8,
- **Para** resolver solo la duda mecánica de "¿qué dice este byte?" y "¿por qué esta ñ ocupa dos bytes?", y llegar a la asesoría solo con lo conceptual.

**Prioridad:** Should
**Estado:** Hecho

---

## Valor

**Para el estudiante:** elimina la tabla ASCII impresa y la conversión byte a byte a mano. Hace visibles dos cosas que en un volcado se ven pero no se explican: que un carácter ASCII es exactamente un byte (0–255) mientras que en UTF‑8 un carácter puede ocupar de 1 a 4 bytes, y que los códigos se leen en grupos de ancho fijo (`8` dígitos en BIN, `3` en OCT y DEC, `2` en HEX), por lo que los separadores son decoración y no información. El error que aparece al escribir `ñ` en la pestaña ASCII enseña el límite de 8 bits sin que nadie tenga que corregirlo.

**Para el docente:** deja de recibir las preguntas repetidas de "¿cuál es el código de esta letra?", "¿por qué mi texto con tildes se ve mal?" y "¿cómo separo estos bytes?". El tiempo de asesoría queda para lo que la herramienta no responde: por qué un protocolo transporta texto, qué implica la codificación en la interoperabilidad y cómo se negocia. Además el componente sirve de apoyo en modo presentación y como fuente de ejercicios evaluables.

---

## Criterios de aceptación

**CA-1 — Conversión bidireccional en vivo**
GIVEN el conversor está visible con los dos paneles vacíos
WHEN el estudiante escribe en el panel de Texto
THEN el panel de Códigos se actualiza en cada pulsación; y WHEN escribe o pega en el panel de Códigos, THEN es el panel de Texto el que se actualiza.

**CA-2 — Selección de base**
GIVEN hay contenido convertido
WHEN el estudiante cambia la base en el selector (BIN, OCT, DEC o HEX)
THEN los códigos se vuelven a mostrar en la nueva base byte por byte, sin volver a codificar el texto cuando el último panel editado fue el de códigos; y THEN la etiqueta del panel y su placeholder pasan a la base elegida.

**CA-3 — Ancho fijo y relleno con ceros**
GIVEN el estudiante convierte el texto `Hola`
WHEN mira los códigos
THEN cada byte ocupa el ancho fijo de su base (`8` en BIN, `3` en OCT, `3` en DEC —por eso `072` y no `72`—, `2` en HEX), y los bytes de un mismo carácter se muestran unidos mientras que los caracteres se separan con un espacio.

**CA-4 — Separadores opcionales al leer códigos**
GIVEN la base es BIN
WHEN el estudiante pega `01000001 01000010` o `0100000101000010`, con espacios, comas o punto y coma
THEN ambos flujos producen el mismo texto, porque los separadores se eliminan y el flujo se re-divide por el ancho fijo del byte; y THEN los dígitos hexadecimales se aceptan en minúscula o mayúscula.

**CA-5 — ASCII vs Unicode sobre el mismo flujo**
GIVEN el estudiante tiene un flujo de códigos escrito
WHEN cambia entre la pestaña `ASCII (8 bits)` y `Unicode (UTF-8)`
THEN los mismos bytes se releen bajo la otra codificación y el texto cambia en consecuencia; y GIVEN el último panel editado fue el de Texto, THEN lo que se recalcula son los códigos de ese mismo texto.

**CA-6 — Carácter fuera del alcance de ASCII**
GIVEN la pestaña activa es `ASCII (8 bits)`
WHEN el estudiante escribe un carácter que necesita más de 8 bits (`ñ`, `你`, un emoji)
THEN se muestra un mensaje de error, anunciado como alerta, que nombra el carácter y le indica cambiar a la pestaña Unicode.

**CA-7 — Códigos inválidos**
GIVEN el estudiante escribe en el panel de Códigos
WHEN un grupo contiene un dígito ilegal en la base seleccionada
THEN se muestra el error `no es un grupo válido en la base seleccionada` con el grupo señalado, incluso si el grupo aún está incompleto; y WHEN un grupo bien formado supera 255 (por ejemplo `999` en DEC), THEN se muestra el error que explica que no es un byte.

**CA-8 — Byte a medio escribir**
GIVEN la base es HEX y el estudiante lleva escrito `48 6F 6`
WHEN observa el panel de Texto
THEN el dígito suelto final no produce error ni borra el resultado: se ignora hasta completar el byte; y GIVEN una secuencia UTF‑8 queda a medias, THEN el texto muestra `�` en lugar de vaciarse.

**CA-9 — Conteo por panel**
GIVEN hay contenido en pantalla
WHEN el estudiante mira el pie de cada panel
THEN el panel de Texto informa cuántos caracteres hay contando por punto de código (un par suplente cuenta como uno) y el panel de Códigos informa la longitud de su flujo, en singular o plural según corresponda.

**CA-10 — Copiar, descargar y cargar**
GIVEN un panel tiene contenido
WHEN el estudiante presiona copiar
THEN el contenido pasa al portapapeles y el ícono cambia a un check durante ~1,2 s; y WHEN presiona descargar, THEN se guarda como `texto.txt` o `codigos.txt`; y WHEN presiona cargar y elige un `.txt`, THEN su contenido entra en ese panel y dispara la conversión, incluso si elige dos veces el mismo archivo.

**CA-11 — Limpiar**
GIVEN ambos paneles están vacíos
WHEN el estudiante mira el botón Limpiar
THEN está deshabilitado; y GIVEN hay contenido, WHEN presiona el botón, la acción `Limpiar` de la barra de herramientas o la tecla `ESC` —también con el foco dentro de un panel—, THEN los dos paneles y el mensaje de error se vacían.

**CA-12 — Ejemplo**
GIVEN el estudiante no sabe qué escribir
WHEN activa la acción `Ejemplo`
THEN se carga un texto de muestra propio de la pestaña activa (ASCII o Unicode) y se convierte de inmediato; y WHEN la vuelve a activar, THEN se carga el siguiente ejemplo de la lista, de forma cíclica.

**CA-13 — Ayuda en contexto**
GIVEN el estudiante no conoce la diferencia entre las dos pestañas
WHEN pasa el cursor o el foco sobre el botón de información de la tarjeta o sobre una pestaña
THEN aparece la explicación correspondiente: cómo funciona la conversión y los separadores en el botón de información, y el límite de 8 bits o el rango de 1 a 4 bytes de UTF‑8 en cada pestaña.

**CA-14 — Generar ejercicios**
GIVEN el estudiante o el docente activa la acción `Generar ejercicios`
WHEN configura dificultad, cantidad y clave de respuestas en el diálogo compartido
THEN debería descargarse un PDF con la plantilla institucional donde cada enunciado pide codificar una cadena en la base indicada o leer un flujo de códigos de vuelta a texto, nunca convertir entre bases numéricas.

**CA-14.1 — Dificultad de los ejercicios**
GIVEN el usuario elige la dificultad en el diálogo
WHEN se genera la hoja
THEN `Fácil` debería plantear un único carácter alfanumérico en BIN o DEC; `Medio`, una cadena ASCII de 3 a 5 caracteres —ya con símbolos— en cualquiera de las cuatro bases; y `Difícil`, una cadena de hasta 8 caracteres que incluye al menos uno acentuado de 2 bytes en UTF‑8, con el flujo de códigos escrito sin separadores para que el ancho fijo sea lo único que permita segmentarlo.

**CA-14.2 — Los ejercicios son imprimibles y verificables**
GIVEN el PDF usa las fuentes estándar del formato (`Helvetica`/`Courier`, WinAnsi)
WHEN el generador elige los caracteres de un enunciado
THEN debería limitarse a ASCII imprimible y acentos Latin‑1 —nunca emoji ni CJK, que el PDF no puede dibujar— y acotar el flujo de códigos a 64 dígitos para que ningún enunciado se salga del margen; y WHEN el estudiante quiere comprobar su respuesta, THEN debería poder escribir el enunciado en la propia herramienta, porque enunciado y respuesta se calculan con las mismas funciones de `src/features/ascii-converter/lib/ascii.ts` que usa el conversor.

**CA-15 — Bilingüe y accesible**
GIVEN el usuario cambia el idioma de la aplicación entre español e inglés
WHEN recorre el conversor
THEN títulos, pestañas, etiquetas, placeholders, conteos, tooltips y mensajes de error están traducidos en ambos idiomas; y THEN cada área de texto tiene su etiqueta asociada, cada botón de ícono su nombre accesible y el error se anuncia con `role="alert"`.

---

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
