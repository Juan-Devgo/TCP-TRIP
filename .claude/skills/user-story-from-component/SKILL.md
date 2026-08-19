---
name: user-story-from-component
description: "Write the Spanish user-story doc (US-###) for a component that already exists in the codebase, deriving the GIVEN-WHEN-THEN acceptance criteria from the real implementation. Use when the user points at a built component/feature and asks for its historia de usuario, US doc, or docs/ entry — e.g. '/user-story-from-component src/components/tools/IPv4Calculator.tsx'. For a component that does NOT exist yet, use user-story-interview instead."
---

# user-story-from-component

Turn an **already implemented** component into its user-story document under `docs/`, with the exact section layout every US doc in this repo uses.

The rule that makes this skill different from `user-story-interview`: **every acceptance criterion must be traceable to code you actually read.** Do not write a CA for behavior you wish existed. If the component only half-does something, that is `Parcialmente implementado`, and the CA says so.

## Input

A component path (`src/components/tools/NumberBaseConverter.tsx`) or a feature name. If the user gives a name, locate the file before doing anything else.

## Steps

1. **Read the implementation.** The component file, plus:
   - its domain/logic module (`src/lib/*.ts`) — limits, constants, error paths live there;
   - the `es` and `en` locale files for its `t()` keys (`src/config/locales/*/translation.json`);
   - any subcomponents it renders that carry behavior.
2. **Verify state against `main`.** `git log`/`git status` for the file. Uncommitted or stubbed work is not `Hecho`.
3. **Derive the CA.** Walk the code and turn each real behavior into one CA: state/validation limits, disabled states, resets on change, keyboard handling, clipboard, precision, error branches, i18n coverage, accessibility labels. Prefer concrete values from the code (`64`, `1,2 s`, `BigInt`) over vague wording.
4. **Ask only what the code cannot tell you.** Normally that is just **Prioridad** (Must/Should/Could) — ask with AskUserQuestion if the user did not state it. Everything else you infer and state.
5. **Write the file** to the `docs/` path mirroring the sidebar group (see below). Overwrite only after reading what is there.
6. **Report** the CA count and anything you deliberately left out.

## Output path

`docs/` mirrors the sidebar taxonomy:

| Area | Path |
| --- | --- |
| Conversores | `docs/tools/converters/<Component>.md` |
| Calculadoras | `docs/tools/calculators/<Component>.md` |
| Teoría | `docs/theory/<Topic>.md` |
| Protocolo genérico | `docs/generic-protocol/<Component>.md` |
| UI compartida | `docs/ui/<Component>.md` |

Filename = the component name, no extension suffixes.

## Rules

- **Spanish.** The document is written in Spanish; only code identifiers and file paths stay as-is.
- **Do not name the story.** The heading stays `US-###` — numbering and titling happen later, elsewhere.
- **Number the CA** `CA-1`, `CA-2`, … in the order a user would meet them, not in source order.
- **GIVEN–WHEN–THEN**, one behavior per CA. A CA may carry a second `and WHEN … THEN …` clause when it is the same behavior's inverse or limit; anything else is a new CA.
- **Estado vocabulary is fixed:** `Por hacer` / `En progreso` / `Hecho` / `Parcialmente implementado`. `Hecho` = implemented on `main` per code exploration. `Parcialmente implementado` = infrastructure or partial logic exists but the full behavior is not operative.
- **Prioridad vocabulary is fixed:** `Must` / `Should` / `Could`.
- **The Valor section is mandatory and split in two** — student and teacher. It must land the app's core purpose from `CLAUDE.md`: the student resolves the easy, mechanical doubts alone so the time with the teacher is spent on the complex, conceptual ones. Say *which* mechanical doubts this component absorbs; do not paste the generic sentence.
- **Not too long.** Specific over verbose: a reader should understand how it works and why it matters, without a manual.

## Template

```markdown
# US-### — <Nombre visible del componente>

**Componente:** `src/components/<ruta>.tsx`
**Lógica de dominio:** `src/lib/<modulo>.ts`

---

## Historia de usuario

- **Como** <rol concreto del estudiante o docente en su contexto>,
- **Quiero** <capacidad observable, no implementación>,
- **Para** <resultado + qué duda mecánica resuelve solo>.

**Prioridad:** Must | Should | Could
**Estado:** Por hacer | En progreso | Hecho | Parcialmente implementado

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

## Notas de estado

- **Hecho** indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- **Parcialmente implementado** indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.
```

Drop the `Lógica de dominio` line when the component has no separate logic module.
