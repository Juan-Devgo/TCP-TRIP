---
name: user-story-interview
description: "Interview the user about a component that does not exist yet, then write its Spanish user-story doc (US-###) with GIVEN-WHEN-THEN acceptance criteria, and ask before promoting any app-wide principle that surfaced into CLAUDE.md. Use when the user wants to spec, plan, or define a new tool/screen/feature before it is built — 'quiero una calculadora IPv4', 'define la historia de usuario para X'. For an already implemented component, use user-story-from-component instead."
---

# user-story-interview

Elicit the requirements for a **not-yet-built** component, then produce the same user-story document the rest of `docs/` uses. Output shape is identical to `user-story-from-component`; what differs is that the acceptance criteria come from the user's answers, not from code.

## Steps

1. **Ground yourself first.** Read `CLAUDE.md` and one existing doc under `docs/` so the questions land in this project's vocabulary. If something similar already exists in `src/components/`, read it — reuse the patterns instead of asking about them.
2. **Interview in batches** with AskUserQuestion. Never one question per turn; group them, offer concrete options with a recommended default first, and stop asking once you can write every CA. Do not ask what the repo already answers (Bun, Base UI, i18n, brand tokens, Clerk roles).
3. **Draft the doc** and show it. Mark any CA you invented to fill a gap.
4. **Ask about CLAUDE.md** — see below. Always ask; never edit it silently.
5. **Write the file** to the `docs/` path mirroring the sidebar group, with **Estado: Por hacer** (or `En progreso` if work already started).

## What to ask

Cover these; skip any the user already answered.

- **Rol y objetivo** — who uses it (estudiante / docente / admin), in what moment of the course, and what they walk away with.
- **Valor y duda mecánica** — which repetitive doubt this absorbs so it stops reaching the teacher. This is the core purpose of the app; if the user cannot name one, say so and ask what makes it worth building anyway.
- **Entradas y salidas** — fields, units, formats, ranges, defaults; what is copyable/exportable.
- **Reglas y límites** — validation, what is legal input, what happens at the boundary, precision needs.
- **Comportamiento de error** — inline message, blocked state, or best-effort result.
- **Alcance de esta iteración** — what is explicitly out (say it in the doc), and what the teacher-facing presentation/assessment angle is, if any.
- **Prioridad** — Must / Should / Could.

## Escalating to CLAUDE.md

While interviewing, watch for an answer that is **not about this component at all** — a rule that would hold for every tool in the app. Signals: the user says "siempre", "en toda la app", "cualquier herramienta debería"; or the answer restates a purpose (who the app serves, what it optimizes, what makes a feature worth building) rather than a behavior.

When you catch one:

1. Write it as one or two sentences, phrased generally, with the "so what" a future implementer needs.
2. **Ask the user with AskUserQuestion** whether it goes into `CLAUDE.md`, and offer the drafted wording so they judge the actual text — options: add it, keep it local to this US doc, or rephrase.
3. Only on an explicit yes, edit `CLAUDE.md` — into `## Project` for purpose-level rules, into the matching section for area-specific ones. Keep it short; `CLAUDE.md` is loaded into every session.

Never add a rule that only restates something already in `CLAUDE.md`, and never add per-component detail there — that belongs in the US doc.

## Output path

`docs/` mirrors the sidebar taxonomy:

| Area | Path |
| --- | --- |
| Conversores | `docs/tools/converters/<Component>.md` |
| Calculadoras | `docs/tools/calculators/<Component>.md` |
| Teoría | `docs/theory/<Topic>.md` |
| Protocolo genérico | `docs/generic-protocol/<Component>.md` |
| UI compartida | `docs/ui/<Component>.md` |

## Rules

- **Spanish.** The document is written in Spanish; only code identifiers and file paths stay as-is.
- **Do not name the story.** The heading stays `US-###`.
- **Number the CA** `CA-1`, `CA-2`, … in the order a user would meet them.
- **GIVEN–WHEN–THEN**, one behavior per CA, written so a QA reader can execute it without reading code. No implementation detail (no hook names, no component internals) — CA describe observable behavior.
- **Estado vocabulary is fixed:** `Por hacer` / `En progreso` / `Hecho` / `Parcialmente implementado`. A spec written before the code is `Por hacer`.
- **Prioridad vocabulary is fixed:** `Must` / `Should` / `Could`.
- **The Valor section is mandatory and split in two** — student and teacher — and must name the concrete mechanical doubt the student now resolves alone.
- **Not too long.** Specific over verbose.

## Template

```markdown
# US-### — <Nombre visible del componente>

**Componente:** `src/components/<ruta propuesta>.tsx` (propuesto)

---

## Historia de usuario

- **Como** <rol concreto del estudiante o docente en su contexto>,
- **Quiero** <capacidad observable, no implementación>,
- **Para** <resultado + qué duda mecánica resuelve solo>.

**Prioridad:** Must | Should | Could
**Estado:** Por hacer

---

## Valor

**Para el estudiante:** <qué error o fricción elimina y qué concepto vuelve visible>.

**Para el docente:** <qué preguntas repetitivas deja de recibir y para qué queda liberado el tiempo de asesoría>.

---

## Criterios de aceptación

**CA-1 — <título corto>**
GIVEN <estado inicial>
WHEN <acción>
THEN <resultado observable>.

**CA-2 — <título corto>**
GIVEN …
WHEN …
THEN ….

---

## Fuera de alcance

- <lo que esta iteración no cubre>

---

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
```

Drop `Fuera de alcance` when nothing was explicitly excluded.
