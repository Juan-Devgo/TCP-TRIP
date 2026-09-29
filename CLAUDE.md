# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TCP-TRIP is a bilingual (es/en) educational web platform for university networking students. It lets users explore the TCP/IP model layer by layer, build protocol headers visually, send structured messages using those headers, and use domain-specific conversion/calculation tools. Teachers get a projector-oriented presentation mode and can generate assessment exercises derived from the same tools. An admin panel handles user management and manual validation of the teacher role.

The problem it solves: RFCs are dense and hard to read without visual context, and existing tools (Wireshark, online subnet calculators) target professionals rather than guided learning. UI copy is user-facing educational content — it must exist in both Spanish and English.

**Core purpose — teacher-time optimization:** every feature should let a student resolve their easy, mechanical doubts on their own (conversions, subnet math, field widths, layer lookups), so that the time spent with the teacher is reserved for the complex, conceptual doubts the app cannot answer. When designing a tool, screen, or copy, ask whether it makes a student self-sufficient on the routine question; if it does not, it is not pulling its weight. Documented user stories under `docs/` must state this value split explicitly (value for the student / value for the teacher).

**Exercise generation is a cross-tool capability:** any tool (current or future) where practice exercises make sense must offer a Generate Exercises action producing a downloadable PDF (difficulty, count, optional answer key at the end) built on the shared institutional template (app author, university, thesis advisor, page numbers). Each tool owns only its exercise-generation logic; dialog, template and PDF pipeline are shared infrastructure.

## Commands

```sh
bun install          # install deps
bun run dev          # dev server with HMR + server-side console forwarding (port 3000, override with PORT)
bun run start        # production mode (NODE_ENV=production, no HMR)
bun run build        # bundle src/index.html -> dist/ (minified, linked sourcemaps)
bun run typecheck    # tsc --noEmit
bun test             # run all tests
bun test path/to/file.test.ts            # single file
bun test -t "name of the test"           # single test by name
bun run ui <component>                   # bunx shadcn@latest add <component>
```

## Runtime rules (Bun, not Node)

- `bun <file>`, `bun test`, `bun install`, `bun run <script>`, `bunx <pkg>`. Never npm/yarn/pnpm/node/ts-node/jest/vitest/webpack/esbuild/vite.
- Bun loads `.env` automatically — never add `dotenv`.
- Prefer built-ins over packages: `Bun.serve()` (not express), `bun:sqlite` (not better-sqlite3), `Bun.redis` (not ioredis), `Bun.sql` (not pg/postgres.js), global `WebSocket` (not ws), `Bun.file` (not `node:fs` readFile/writeFile), `` Bun.$`ls` `` (not execa).
- Full Bun API docs live in `node_modules/bun-types/docs/**.mdx`.

## Architecture

Single Bun process serves both the API and the SPA — there is no separate frontend dev server and no Vite.

- `src/index.ts` — `Bun.serve()` entry. Spreads `apiRoutes`, then `"/*": index` as the SPA fallback so any unmatched *page* path renders the React app — `/api/*` is claimed inside `apiRoutes` by a static JSON 404, so a wrong endpoint never answers HTML. `error: onError` catches every uncaught throw in one place. No `port` option: Bun already reads `$BUN_PORT`, `$PORT`, `$NODE_PORT`, then 3000. `development: { hmr, console }` only when `NODE_ENV !== "production"`.
- **TLS is wired but dormant.** `readTls()` in `src/index.ts` returns a `tls` option only when `TLS_KEY_PATH` and `TLS_CERT_PATH` both point at readable PEM files (`Bun.file`, so they are read lazily and never inlined anywhere); optional `TLS_CA_PATH`, `TLS_PASSPHRASE`, `TLS_SERVER_NAME` ride along. Unset — the current state, no certificate yet — the same server stays on plain HTTP; set but unreadable, it warns and keeps serving. None of these take a `PUBLIC_` prefix.
- `src/index.html` — imported directly by `index.ts`; Bun's bundler transpiles the `<script type="module" src="./main.tsx">` graph (TSX + CSS + Tailwind) with no separate build step in dev. `bunfig.toml` registers `bun-plugin-tailwind` for `serve.static`; `build.ts` registers the same plugin for production builds.
- `src/api/routes.ts` — the single route map. **Add new API modules under `src/api/` and mount them in this map; `src/index.ts` should not change.**
- `src/api/guards.ts` — the role guards every gated route starts with: `authorOnly(req)` (teacher) and `adminOnly(req)` return **either** the verified caller or the `Response` that refuses them, which `isRefusal` narrows. 401 ("sign in") and 403 ("ask an administrator") are separate answers because the UI says different things.
- `src/api/http.ts` — response contract for every route: `ok(data)`, `fail(status, message, details)` (shape `{ error: { message, details } }`), and `onError` — `Bun.serve`'s `error` callback, mounted once in `src/index.ts`, which logs an uncaught throw and answers the same JSON 500 (message and stack in `details` outside production). **Route handlers are plain functions**: there is no per-handler wrapper to remember, and returning Bun's built-in HTML error page to an API client is exactly what `onError` prevents.
- `src/main.tsx` — React root: `StrictMode` → `BrowserRouter` → `ClerkProvider` → `TabsProvider` → `ToolActionsProvider` → `PresentableProvider` → `PageChromeProvider` → `App`. **There is no `<Routes>` map**: the pathname drives the tab system, which resolves it against the page registry.
- `src/config/navigation.ts` — **the single source of navigation truth**: one `NAVIGATION` tree of nodes (`segment` + `titleKey` + optional `icon`, `page`, `children`) from which the sidebar (`NAV_TREE`), the breadcrumb labels (`findNavItem`), the tab registry (`PAGES`, `findPage`, `isPagePath`) and the `PagePath` literal union are all derived. Metadata only — no JSX, no feature imports — so the tab state layer can import it. **A node with `page` opens as a tab; anything else is navigation inside the active tab.** Paths are never written by hand: a node's path is the join of its ancestors' segments, so sidebar link, tab and crumb cannot drift.
  - **The Theory group is extended at runtime.** Its static nodes live in the tree; the sections under them are rows an administrator created (`theory_sections`), which `AppSidebar` appends from `useTheoryMenu()`. Each entry links to `/theory/presentations/<slug>`, a non-registered path, so it is navigation inside the Theory reader's tab.
  - **Adding a page = one node in `NAVIGATION` + one entry in `PAGE_COMPONENTS` (`TabHost`) + the `titleKey` in both locale files.** A node may carry `roles: ["teacher"]` to keep it out of other roles' sidebars — cosmetic only; the server decides (see Clerk below). `PAGE_COMPONENTS` is keyed on `PagePath`, so a stale or misspelled path fails `bun run typecheck` instead of silently rendering the placeholder. `page: { wide: true }` opts a canvas page out of the reading-width column.
- `src/components/layouts/MainLayout.tsx` — page shell: `SidebarProvider` + `AppSidebar` + `AppHeader` + `ContentToolbar`, content constrained to `max-w-[42em]` and scoped with `typeset typeset-docs`. `AppHeader` holds the `SidebarTrigger`, the `TabBar`, and `ModeToggle`/`LanguageToggle`; `ContentToolbar` holds the per-tab back/forward buttons, the `AppBreadcrumb` and the active tool's actions. Breadcrumb segment labels reuse the `sidebar.*` i18n keys.
- **Tab system** (spec: `docs/ui/Tab.md`, state machine: `src/lib/tabs.ts` + `src/lib/tabHistory.ts`): every sidebar page opens as a browser-like tab that keeps its state in memory while open — one tab per page, focus the existing tab instead of duplicating, no persistence across reloads. New tools must work mounted inside this tab system, not as routes that unmount on navigation. **Inactive tabs stay mounted**, so anything global inside a tool (a `document` listener, a timer) must be gated on `useIsTabActive()`.
  - The URL and the tab set are kept in step by two effects that run in the *same* commit, so the second one cannot see what the first just dispatched. `TabsState.syncedPath` records which pathname the state has been reconciled with, and `urlRealignTarget()` refuses to move the URL until it matches. Removing that guard makes every link ping-pong between the old and new page forever. Any new reducer case must carry `syncedPath` through (`...state`), never rebuild the state object from scratch.
- **Tool actions**: each tool exposes its actions (e.g. Generate Exercises) through `useToolActions()`, rendered at the top-right of the content — a button for one action, a dropdown menu for several. Actions are defined in a small tool-owned component (e.g. `src/features/number-base-converter/components/NumberBaseConverterActions.tsx`) that renders `null`, never inside the layout.
- **Page chrome**: a path reached by navigation inside a tab is not a nav node, so only the page knows how to label it: `useCrumbLabel(path, label)` names its breadcrumb segment (a draft's title, not its id) (`src/context/PageChromeProvider.tsx`). Such a page reads the path it is on with `useTabPath()`, **never `useLocation()`**: the address bar belongs to the tab on screen, and a hidden tab reading it renders another tab's path. A pasted or reloaded path under a page (`/teacher/presentations/mine/<id>`) opens that page's tab, with the page one step back.
- **Presentable pages**: a page whose content can be projected opts in through the presentable registry (like tool actions); only then does the header show the presentation-mode button. Every presentable page opens the shared `PresentationPlayer` with the same action set (Export, Ask, Report, Board) and the same role rules (student progress bar, author-only notes) — a page owns only what it projects. Spec: `docs/ui/PresentationMode.md`.

### Folder structure

`src/` follows a feature-based layout. Where a file goes is decided by **who owns it**, not by what kind of file it is:

```
src/
├── api/            Bun server: route map + response contract (not React)
├── assets/         static assets (images, icons) — fonts come from npm
├── components/
│   ├── common/     app-wide components (AppSidebar, AppBreadcrumb,
│   │               ExerciseGeneratorDialog, ModeToggle, LanguageToggle,
│   │               PresentationStage, PresentationPlayer, Markdown,
│   │               TheoryIcon)
│   ├── layouts/    the shell (MainLayout, AppHeader, ContentToolbar,
│   │               TabBar, TabHost)
│   └── ui/         shadcn primitives — generated, don't hand-write
├── config/         i18n init, locales, the navigation tree
├── context/        React providers (ThemeProvider, TabsProvider,
│                   ToolActionsProvider, PageChromeProvider)
├── db/             bun:sqlite data layer: singleton connection, schema,
│                   DAO/Repository bases, one folder per domain (not React)
├── features/       one folder per tool — see below
├── hooks/          shared hooks
├── lib/            cross-cutting pure logic: tabs.ts, tabHistory.ts,
│                   utils.ts (cn), pdf/, exercises/types.ts,
│                   auth/roles.ts, highlight/ (highlight.js core
│                   + curated languages, as a span tree — never
│                   innerHTML), and the contracts shared by
│                   client and server: protocols/, presentations/,
│                   theory/ (the admin-built Theory menu)
├── pages/          route-level views (HomePage, NotFoundPage, Placeholder)
├── services/       API clients: client.ts (the shared ApiError + request),
│                   one module per API
├── styles/         globals.css + vendored typeset.css
└── types/          ambient .d.ts declarations
```

Features so far: `number-base-converter`, `ascii-converter`, `ipv4-calculator`, `protocol-builder`, `presentation-editor` (the teacher's slide/markdown editor), `presentation-review` (the admin's approval queue), `admin-theory` (the admin's builder for the Theory menu) `theory-presentations` (the student's reader, with reading progress — **no index**: the sidebar is the index), `teacher-exercises` (`Crear` / `Mis ejercicios`: multi-tool exercise sets, saved frozen) and `classroom` (Google Classroom: connection, `Asignar`, `Mis cursos`). What the presentation features share sits above them: the slide renderer and the projector player (`src/components/common/PresentationStage.tsx`, `PresentationPlayer.tsx`), the Markdown renderer (`src/components/common/Markdown.tsx` over `markdown-to-jsx`, raw HTML parsing off) and the document contract (`src/lib/presentations/contract.ts`).

**The presentation editor has two renderers on purpose.** Editing happens on a real `<canvas>` — `konva` + `react-konva`, the one drawing dependency in the project, because a transformer (scale and rotate handles), hit detection and a table drawn as a grid are what a slide editor is made of. Everything a *reader* sees stays DOM (`PresentationStage`), so slide text is selectable, screen-readable and themed by the same CSS variables as the rest of the app. Two consequences to respect:

- A canvas cannot paint `var(--color-*)`, so `src/features/presentation-editor/lib/themeColors.ts` resolves the tokens off `:root` and re-reads them when the theme class flips. The document still stores **token names** — that is what keeps a slide readable in both themes.
- Both renderers draw the same geometry from the same contract. A new element kind means a branch in `PresentationStage` **and** one in `SlideCanvas`; the element types are a discriminated union, so a missing one is a compile error.

**A tool is a feature, not a component.** Everything a tool owns lives under `src/features/<tool>/`:

```
src/features/number-base-converter/
├── components/   NumberBaseConverter.tsx, NumberBaseConverterActions.tsx
├── lib/          numberBase.ts + numberBase.test.ts   (domain logic)
├── exercises/    numberBaseExercises.ts + .test.ts    (exercise generator)
└── index.ts      the public surface — the only file others import
```

Rules:

- **Import a feature through its barrel** (`@/features/ipv4-calculator`), never reach into its `components/`, `lib/` or `exercises/` from outside. `TabHost` maps a page path to the component it gets from the barrel.
- **A feature never imports another feature.** Anything two tools need moves up to `lib/`, `components/common/` or `hooks/`.
- Shared exercise infrastructure stays out of the features: the `Exercise`/`Difficulty` contract is `src/lib/exercises/types.ts`, the PDF pipeline is `src/lib/pdf/`, and the dialog is `src/components/common/ExerciseGeneratorDialog.tsx`. A feature only owns its generator.
- **Every tool with a generator must also be registered in `src/config/exerciseTools.ts`** — that registry is how the teacher panel (`Crear ejercicios`) combines tools without a feature importing another. Its ids are stored in saved sets: never rename one.
- Tests are colocated with the code they cover (`lib/ipv4.test.ts` next to `lib/ipv4.ts`) — there is no top-level `tests/`.
- `@/lib/utils` (the `cn` helper) keeps its path because the shadcn CLI writes that import into every generated `ui/` component.

Path alias `@/*` → `src/*` (declared in `tsconfig.json` `paths` — TS 7, no `baseUrl`). Use `@/...` imports, not relative ones, when crossing directories.

TypeScript is strict plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax` (use `import type` for type-only imports).

## State management

**No global store library, and Zustand is a deliberate "no".** The decision was reviewed and the rationale matters more than the verdict — re-read it before reaching for one.

State is split four ways, and every new feature must land in one of them:

| Kind | Where it lives | Examples |
| --- | --- | --- |
| Draft / local UI | `useState` (or `useReducer`) inside the tool | converter inputs, IPv4 fields, a protocol being edited |
| Tab & navigation | `TabsProvider` over the pure reducer in `src/lib/tabs.ts` | open tabs, active tab, per-tab back/forward |
| Cross-cutting UI | one narrow Context each | `ThemeProvider`, `ToolActionsProvider`, sidebar |
| Server data | the API + a query cache (see below) | saved protocols, user role |

Why no store library:

- The hard part is already factored out. `src/lib/tabs.ts` and `src/lib/tabHistory.ts` are pure and unit-tested with no React import; a store would replace the ~30 lines of provider boilerplate around them and nothing else.
- The usual reason to hoist state — it dies when a route unmounts — does not apply. **Inactive tabs stay mounted**, so plain `useState` inside a tool already survives tab switching.
- There are three Contexts total and no prop drilling. Re-render pressure is a handful of components with roughly ten tabs at most.
- Clerk owns auth/role, i18next owns language, `react-router` owns the URL. Mirroring any of them into a store duplicates a source of truth (and for the role, contradicts the Clerk rule below).
- It is a thesis project: every dependency has to be defensible. "A pure, tested reducer with no dependencies" is a stronger answer than "less provider boilerplate".

If per-Context re-renders ever become a real problem, split `TabsContext` into a frequently-changing state context and a stable actions context before adding any library.

### Server data (protocol persistence — shipped)

Protocols are persisted, so the message composer can consume them. That data is **server state, not client state** — a client store would mean hand-writing fetch dedupe, loading/error, invalidation and optimistic rollback.

- Use a query cache (**TanStack Query**; `@tanstack/react-table` is already a dependency) — not a store, not bare `fetch` in `useEffect`.
- Cross-tab sharing comes free: the builder tab invalidates `['protocols']` after a mutation and the composer tab, reading the same key, refetches. No store, no message passing between tabs.
- **Draft is local, saved is server.** A protocol under construction stays in component state until it is POSTed.
- Server side: a route module under `src/api/` mounted in `src/api/routes.ts`, every handler a plain `BunRequest` function answering through `ok`/`fail` (a throw is the server's `onError`, not the handler's problem). The route calls a **repository** from `src/db/domains/<domain>` — it never writes SQL. Ownership is scoped by the Clerk user id **verified server-side**, never taken from the client.
- The worked example is `src/api/protocols.ts` → `src/db/domains/protocols/`, with `src/services/protocols.ts` as the client. The query cache is not wired yet: the service is plain `fetch`, and TanStack Query goes on top of it when `Mis Protocolos` lands.

Revisit a store library only for global client state that is not derivable from the URL, the server, or Clerk — presentation mode is the one plausible candidate, and a Context handles it today.

## Database (`src/db/`, bun:sqlite)

`bun:sqlite` only — never better-sqlite3, never an ORM. Three layers, and a new table touches all three:

- `src/db/client.ts` — **the singleton connection.** `getDb()` opens the file lazily on first call (path from `DATABASE_PATH`, default `data/tcp-trip.sqlite`, gitignored), sets WAL + `foreign_keys` + `busy_timeout`, and applies the schema. Nothing else constructs a `Database`; `openDatabase(":memory:")` is how tests get an isolated one. Because it is lazy, importing a DAO is enough — `src/index.ts` stays untouched.
- `src/db/schema/index.ts` — `SCHEMA_STATEMENTS`, every DDL statement in dependency order, applied in one transaction by `src/db/init.ts` on each boot. **Idempotent (`IF NOT EXISTS`) and append-only**: editing a shipped statement does nothing to an existing file.
- `src/db/domains/<domain>/` — one folder per domain, mirroring `src/features/`: `*.queries.ts` (all SQL, as named constants), `*.dao.ts` (extends `BaseDao`, binds params, returns rows), `*.repository.ts` (extends `BaseRepository`, maps rows to entities, owns the rules and cross-table transactions), `index.ts` (the barrel — exports the repository). Layout and worked example: `src/db/domains/README.md`.

Rules: routes import repositories, never DAOs or query strings; a domain is imported through its barrel; a domain never imports another domain's DAO. The connection is opened `strict: true`, so bindings are prefix-free (`{ userId }` for `$userId`) and a missing parameter throws.

**Tables so far:**

- `protocols` — one row per saved protocol, the schema itself stored as a JSON `document` column (the builder's shape changes without a migration). `user_id` is the **Clerk** id with no foreign key and no local users table: Clerk owns identity and the role, and mirroring it here would duplicate a source of truth. `share_id` is NULL until the protocol is shared.
- `presentations` — a teacher's theory presentation **draft**, document as JSON, with `status` (`draft|pending|published|rejected`) describing the draft's place in the review, not the published copy.
- `presentation_publications` — what the Theory section actually serves: a **frozen copy** of the document as an admin approved it, keyed on `presentation_id`, with a stable `slug` and a snapshot of the author's name. Approving copies the document here; the author's later edits stay in their draft. Theory never reads the draft row. The copy is stripped of **both kinds of note** (`withoutPrivateNotes`) on the way in and again on the way out: a published document is JSON a student can read in the network tab, so hiding notes in the UI would not hide them.
- `presentation_reviews` — append-only log, one row per `submit`/`approve`/`reject`/`withdraw`, with who did it. The author reads the rejection reason from it; it is also the audit trail for the only place the app acts on another user's content.
- `presentation_assets` — slide images as BLOBs (never data URIs in the document, never files on disk: the SQLite file stays the whole backup). The served type is sniffed from the bytes, and SVG is refused — it could carry a script.
- `theory_sections` / `theory_section_items` — the Theory group of the sidebar, built by an administrator instead of hardcoded: a section is a name plus an icon **name** from the allowlist in `src/lib/theory/contract.ts`, and an item files a presentation under it. The item points at the **presentation**, never at a slug, so the menu resolves it through `presentation_publications` — an entry whose presentation is withdrawn disappears from every reader's sidebar on its own, and comes back if it is approved again. `presentation_id` is unique across the whole menu: the same material cannot be filed twice.
- `presentation_progress` — one row per reader per presentation. **One percentage for both views**: the reading page and presentation mode write to the same row, `percent` kept monotonic by `MAX(...)` in the upsert (re-reading is not losing progress) and `position` an opaque resume hint (`slide:4`, `scroll:0.42`) the server stores but never parses. This is the one presentation table a *student* writes to.
- `exercise_sets` / `exercise_set_usages` — a teacher's saved exercise set, the generated prompts and answers **frozen** as JSON (re-downloading must give the PDF students received), and one usage row per Classroom assignment it was attached to. A set with a usage refuses updates; the teacher duplicates it instead.
- `classroom_assignments` — the Classroom tasks **TCP-TRIP created**, the only ones it may edit (API project lock): formatted instructions Classroom cannot store, the exercise sets and presentation slugs attached, and a client-minted `request_id` (`UNIQUE` per user) that makes a retried create idempotent. `classroom_announcement_requests` does the same for announcements; `classroom_disconnects` remembers a deliberate disconnect so a revoked grant is not reported as an expired one.

**Ownership lives in the `WHERE` clause.** Every owner-scoped query in `protocols.queries.ts` filters on `user_id`, so a request carrying somebody else's id matches zero rows — the check cannot be forgotten in a branch, and the route answers the same 404 it gives an unknown id.

## Project skills & agent docs

Reference docs checked into the repo. Read the relevant one before touching that area — they carry conventions this file only summarizes.

- `.claude/skills/i18n/react-i18next.md` — the react-i18next setup this project follows: locale folder layout, `i18n.ts` init, `useTranslation()`/`t()`, `{{name}}` interpolation, a `LanguageSwitcher` via `i18n.changeLanguage`, and key-naming rules (descriptive keys like `"nav.home"`, never full sentences; no string concatenation — use placeholders; use i18next pluralization/date/number formatting). Its examples are Vite/JS — this project is Bun/TSX and imports i18n from `src/app.tsx`, not `main.jsx`.
- `.claude/skills/user-story-from-component/SKILL.md` — writes the Spanish `US-###` doc for an **already implemented** component, deriving every GIVEN–WHEN–THEN acceptance criterion from code actually read; carries the fixed Prioridad/Estado vocabulary, the `docs/` path map, and the doc template.
- `.claude/skills/user-story-interview/SKILL.md` — interviews the user about a **not-yet-built** component and writes the same doc with `Estado: Por hacer`; also watches for app-wide principles that surfaced in the interview and asks before promoting them into this file.
- `.claude/settings.local.json` — local permission allowlist only, no project rules.
- `.agents/skills/shadcn/` — vendored shadcn skill (pinned in `skills-lock.json`). `SKILL.md` is the index; `rules/base-vs-radix.md` (**most important here — this project is Base UI**), `rules/styling.md`, `rules/forms.md`, `rules/composition.md`, `rules/icons.md`, `rules/chat.md`, plus `cli.md`, `registry.md`, `customization.md`, `mcp.md`. Each rules file has Incorrect/Correct code pairs.

## Clerk (auth)

- `@clerk/clerk-react` is the package in use (`@clerk/react` is also installed but not imported — don't mix them).
- `ClerkProvider` is mounted in `src/main.tsx` **inside** `BrowserRouter`, wired to react-router via `routerPush`/`routerReplace` so Clerk navigations go through the SPA router. Keep that ordering when adding routes.
- `publishableKey` is passed explicitly in `src/main.tsx` from `process.env.PUBLIC_CLERK_PUBLISHABLE_KEY` (`.env`, gitignored). There is no Vite: `import.meta.env` does nothing here. Bun inlines only literal `process.env.X` references matching the `PUBLIC_*` prefix, configured in `bunfig.toml` (`[serve.static] env = "PUBLIC_*"`, dev) and `build.ts` (`env: "PUBLIC_*"`, prod). Any new client-side env var must use the `PUBLIC_` prefix and be read as a literal `process.env.PUBLIC_FOO` (destructuring or indirect access won't be replaced).
- Role model per the product spec: student / teacher / admin, where the teacher role is granted by manual validation in the admin panel — gate on Clerk metadata, not on client-only state. The role lives in the account's **`publicMetadata.role`** (Clerk's own recommendation for RBAC without organizations: the browser can read it, only the dashboard and the Backend API can write it). The role **names** live in `src/lib/auth/roles.ts` (both halves need them); the role is **decided** in `src/api/auth.ts` (`requireCaller`/`requireRole`) and gated in `src/api/guards.ts`. `useAppRole()` and `NavNode.roles` only *hide* things — a hidden path typed by hand renders and then gets a 403.
- **The role travels inside the session token.** The Clerk Dashboard (Sessions → Customize session token) copies the metadata into the claims with `{ "metadata": "{{user.public_metadata}}" }`, declared as `CustomJwtSessionClaims` in `src/types/clerk.d.ts`, so the server reads the role off the verified token with **no API call**. If that claim is missing (an unconfigured dashboard, an old token) it falls back to reading the user and caches the answer for 60 s. How to grant a role by hand, including the first admin: `docs/users/roles.md`.
- **Server side** is `@clerk/backend` in `src/api/auth.ts`: `requireUserId(req)` verifies the request and returns the user id, or `null` for a 401. It reads `CLERK_SECRET_KEY`, which deliberately has **no** `PUBLIC_` prefix so Bun cannot inline it into the client bundle. A route never takes an owner id from a body, a query string or a header.
- The browser sends `Authorization: Bearer` with a token from `window.Clerk.session.getToken()` (`src/services/protocols.ts`, typed in `src/types/clerk.d.ts`), because a plain module cannot call `useAuth()`.
- **Teacher pages** wrap themselves in `TeacherGate` (`src/components/common/`), a courtesy notice for anyone who is not a teacher; the lock is `authorOnly` on every route they call.
- Google APIs (Classroom, Drive) are called only from the server (`src/api/google.ts`), with the Google token obtained from Clerk (`getUserOauthAccessToken`); the token never reaches the client. Scopes are requested incrementally from a teacher-only connect action, never at sign-up. TCP-TRIP only modifies Classroom items it created (API project lock). A published theory presentation is attached as a link to its reader, resolved server-side against `presentation_publications` (`APP_ORIGIN` names the public origin behind a proxy). Spec: `docs/exercises/ClassroomIntegration.md`.

## shadcn/ui

- `components.json`: style `base-nova`, base color `neutral`, CSS variables on, icon library `lucide`, CSS entry `src/styles/globals.css`. Aliases: `@/components`, `@/components/ui`, `@/lib/utils`, `@/lib`, `@/hooks`.
- **This project uses Base UI (`@base-ui/react`), not Radix.** Composition uses the `render` prop, not `asChild`:
  ```tsx
  <NavigationMenuLink render={<Link to="/docs">Docs</Link>} />
  ```
  Other Base-vs-Radix API differences (Select, ToggleGroup, Slider, Accordion) are documented in `.agents/skills/shadcn/rules/base-vs-radix.md`.
- Add components with `bun run ui <name>` (pinned CLI: `bunx shadcn@4.16.1 add <name> --yes` matches what's installed). Don't hand-write files into `src/components/ui/`.
- Styling rules enforced by the bundled shadcn skill (`.agents/skills/shadcn/`): `className` for layout only — never override component colors/typography; semantic tokens (`bg-primary`, `text-muted-foreground`) never raw `bg-blue-500`; no `dark:` color overrides; `flex ... gap-*` instead of `space-x/y-*`; `size-*` when width equals height; `cn()` for conditional classes; no manual `z-index` on overlays. Forms use `FieldGroup`/`Field`.
- Icons come from `lucide-react` (the `lucide` library configured in `components.json`). Import them directly — there is no local icon component directory.

## Styling & colors (`src/styles/globals.css`)

Tailwind v4, configured entirely in CSS (`@import "tailwindcss"` + `@theme inline`) — there is no `tailwind.config.js`. Dark mode is the class-based `@custom-variant dark (&:is(.dark *))`.

Brand colors are **hardcoded hex in `@theme inline`** (they do not follow the `--background`/`.dark` variable pattern, so they are identical in light and dark):

| Token | Value | Foreground |
| --- | --- | --- |
| `--color-primary` | `#FE9A00` (amber) | `#000` |
| `--color-primary-dark` | `#8A5300` | `#FFF` |
| `--color-primary-darkest` | `#613A00` | `#FFF` |
| `--color-secondary` | `#7F00FF` (violet) | `#FFF` |
| `--color-tertiary` | `#00FF54` (green) | `#000` |
| `--color-quaternary` | `#604080` (muted purple) | `#FFF` |

Everything else (`background`, `foreground`, `card`, `popover`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1..5`, `sidebar-*`) is a neutral oklch shadcn variable defined in `:root` and overridden in `.dark`. Radii derive from `--radius: 0.625rem` (`--radius-sm` … `--radius-4xl` as multipliers).

Fonts: Montserrat Variable (`--font-sans`) and JetBrains Mono Variable (`--font-mono`), self-hosted via `@fontsource-variable/*`. Use `font-mono` for protocol/header/hex output.

Long-form educational content uses shadcn typeset: wrap in `.typeset .typeset-docs` (already applied by `MainLayout`); `src/styles/typeset.css` is vendored from `ui.shadcn.com/typeset.css` — treat it as vendor code.

## i18n (i18next + react-i18next)

- `src/config/i18n.ts` initializes i18next with `initReactI18next`, statically importing `src/config/locales/{en,es}/translation.json` into a single `translation` namespace. `lng` and `fallbackLng` are both `'en'`; `interpolation.escapeValue: false`.
- Init happens as an import side effect — importing `@/config/i18n` is what configures it. Keep it imported from a module that always loads (currently `src/app.tsx`); prefer moving it to `src/main.tsx` if `app.tsx` ever stops being on the boot path.
- **Both locale files are currently empty (0 bytes)** and existing components (`Navbar`, `AppSidebar`) hardcode Spanish strings. New UI copy should go through `useTranslation()`/`t('key')` with matching keys added to *both* `en` and `es` files.
- Adding a language = new folder under `src/config/locales/<code>/translation.json` + a `resources` entry in `src/config/i18n.ts`. There is no language detector wired up yet, so language switching means calling `i18n.changeLanguage(code)`.
- Conventions and worked examples: `.claude/skills/i18n/react-i18next.md`.
