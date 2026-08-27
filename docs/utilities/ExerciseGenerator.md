# US-### — Generador de Ejercicios

**Componente:** `src/components/common/ExerciseGeneratorDialog.tsx` (propuesto, compartido)
**Acciones por herramienta:** `src/features/<tool>/components/<Tool>Actions.tsx` (ya existe el patrón)

---

## Historia de usuario

- **Como** estudiante que quiere practicar por su cuenta, o docente que prepara talleres y evaluaciones,
- **Quiero** generar desde cualquier herramienta un PDF descargable de ejercicios, eligiendo dificultad, cantidad y si incluye la hoja de respuestas,
- **Para** que el estudiante practique y verifique solo las operaciones mecánicas de esa herramienta sin acudir al docente, y el docente produzca material de evaluación sin redactarlo a mano.

**Prioridad:** Must
**Estado:** Por hacer

---

## Valor

**Para el estudiante:** convierte cada herramienta en una fuente ilimitada de práctica autoverificable: genera ejercicios, los resuelve a mano y confirma con la hoja de respuestas. La duda mecánica "¿lo estoy haciendo bien?" se resuelve sola; a la asesoría llega solo con dudas conceptuales.

**Para el docente:** deja de redactar ejercicios rutinarios a mano y de resolver dudas de procedimiento en asesoría. Genera talleres y quices con formato institucional consistente en segundos, y reserva su tiempo para lo conceptual.

---

## Criterios de aceptación

**CA-1 — Acción disponible en la herramienta**
GIVEN una herramienta que soporta generación de ejercicios está abierta en su pestaña
WHEN el usuario mira las acciones de la herramienta (esquina superior derecha del contenido)
THEN existe la acción "Generar ejercicios", disponible para estudiante y docente.

**CA-2 — Diálogo de configuración**
GIVEN el usuario selecciona "Generar ejercicios"
WHEN se abre el diálogo
THEN muestra: selector de dificultad (Fácil / Medio / Difícil), campo de cantidad (1–50, por defecto 10) y un interruptor "Incluir respuestas", con un botón para generar y otro para cancelar.

**CA-3 — Validación de cantidad**
GIVEN el diálogo está abierto
WHEN el usuario escribe una cantidad vacía, menor que 1 o mayor que 50
THEN el campo se marca inválido con mensaje traducido y el botón de generar queda deshabilitado hasta corregirla.

**CA-4 — Generación y descarga**
GIVEN una configuración válida
WHEN el usuario presiona generar
THEN el navegador descarga un PDF con la cantidad exacta de ejercicios pedida y el diálogo se cierra.

**CA-5 — Plantilla institucional**
GIVEN cualquier PDF generado por cualquier herramienta
WHEN se abre el documento
THEN presenta la misma plantilla: nombre del autor de la aplicación, universidad, director del trabajo de grado, nombre de la herramienta, dificultad elegida y numeración de página en todas las páginas.

**CA-6 — Hoja de respuestas al final**
GIVEN "Incluir respuestas" está activado
WHEN se genera el PDF
THEN los enunciados aparecen sin su respuesta y al final del documento hay una hoja de respuestas numerada que corresponde uno a uno con los ejercicios; y GIVEN está desactivado, THEN el PDF no contiene ninguna respuesta.

**CA-7 — La dificultad cambia los ejercicios**
GIVEN cada herramienta define qué significa cada nivel para su dominio (p. ej. magnitud de los números y pares de bases en el Conversor de Bases)
WHEN el usuario genera con Fácil y luego con Difícil
THEN los ejercicios del nivel difícil son observablemente más exigentes según la regla de esa herramienta.

**CA-8 — Ejercicios aleatorios**
GIVEN la misma configuración
WHEN el usuario genera dos veces
THEN los ejercicios son distintos entre generaciones (no un banco fijo repetido).

**CA-9 — Bilingüe**
GIVEN el idioma activo de la aplicación (es/en)
WHEN el usuario abre el diálogo o genera el PDF
THEN tanto la interfaz del diálogo como los enunciados y la plantilla del PDF salen en el idioma activo.

---

## Fuera de alcance

- Ver o resolver los ejercicios dentro de la aplicación (solo PDF descargable).
- Banco de ejercicios persistente o historial de generaciones.
- Calificación automática o envío de resultados al docente.
- Personalizar la plantilla desde la interfaz (autor, universidad y asesor son fijos de la aplicación).

---

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
