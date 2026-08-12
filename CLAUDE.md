# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TCP-TRIP is a bilingual (es/en) educational web platform for university networking students. It lets users explore the TCP/IP model layer by layer, build protocol headers visually, send structured messages using those headers, and use domain-specific conversion/calculation tools. Teachers get a projector-oriented presentation mode and can generate assessment exercises derived from the same tools. An admin panel handles user management and manual validation of the teacher role.

The problem it solves: RFCs are dense and hard to read without visual context, and existing tools (Wireshark, online subnet calculators) target professionals rather than guided learning. UI copy is user-facing educational content — it must exist in both Spanish and English.

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

- `src/index.ts` — `Bun.serve()` entry. Spreads `apiRoutes`, then `"/*": index` as the SPA fallback so any unmatched path renders the React app. `development: { hmr, console }` only when `NODE_ENV !== "production"`.
- `src/index.html` — imported directly by `index.ts`; Bun's bundler transpiles the `<script type="module" src="./main.tsx">` graph (TSX + CSS + Tailwind) with no separate build step in dev. `bunfig.toml` registers `bun-plugin-tailwind` for `serve.static`; `build.ts` registers the same plugin for production builds.
- `src/api/routes.ts` — the single route map. **Add new API modules under `src/api/` and mount them in this map; `src/index.ts` should not change.**
- `src/api/http.ts` — response contract for every route: `ok(data)`, `fail(status, message, details)` (shape `{ error: { message, details } }`), and `handler(fn)` which turns an uncaught throw into a logged 500. Wrap every route handler in `handler`.
- `src/main.tsx` — React root: `StrictMode` → `BrowserRouter` → `ClerkProvider` → `Routes`. Routes are declared here.
- `src/components/layouts/MainLayout.tsx` — page shell: `typeset typeset-docs` wrapper + `SidebarProvider` + `AppSidebar` + `AppHeader`, content constrained to `max-w-[42em]`. `AppHeader` holds the `SidebarTrigger`, `ModeToggle`, `LanguageToggle` (left) and the route-driven `AppBreadcrumb` (right); breadcrumb segment labels reuse the `sidebar.*` i18n keys.

Path alias `@/*` → `src/*` (declared in `tsconfig.json` `paths` — TS 7, no `baseUrl`). Use `@/...` imports, not relative ones, when crossing directories.

TypeScript is strict plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax` (use `import type` for type-only imports).

## Project skills & agent docs

Reference docs checked into the repo. Read the relevant one before touching that area — they carry conventions this file only summarizes.

- `.claude/skills/i18n/react-i18next.md` — the react-i18next setup this project follows: locale folder layout, `i18n.ts` init, `useTranslation()`/`t()`, `{{name}}` interpolation, a `LanguageSwitcher` via `i18n.changeLanguage`, and key-naming rules (descriptive keys like `"nav.home"`, never full sentences; no string concatenation — use placeholders; use i18next pluralization/date/number formatting). Its examples are Vite/JS — this project is Bun/TSX and imports i18n from `src/app.tsx`, not `main.jsx`.
- `.claude/settings.local.json` — local permission allowlist only, no project rules.
- `.agents/skills/shadcn/` — vendored shadcn skill (pinned in `skills-lock.json`). `SKILL.md` is the index; `rules/base-vs-radix.md` (**most important here — this project is Base UI**), `rules/styling.md`, `rules/forms.md`, `rules/composition.md`, `rules/icons.md`, `rules/chat.md`, plus `cli.md`, `registry.md`, `customization.md`, `mcp.md`. Each rules file has Incorrect/Correct code pairs.

## Clerk (auth)

- `@clerk/clerk-react` is the package in use (`@clerk/react` is also installed but not imported — don't mix them).
- `ClerkProvider` is mounted in `src/main.tsx` **inside** `BrowserRouter`, wired to react-router via `routerPush`/`routerReplace` so Clerk navigations go through the SPA router. Keep that ordering when adding routes.
- `publishableKey` is passed explicitly in `src/main.tsx` from `process.env.PUBLIC_CLERK_PUBLISHABLE_KEY` (`.env`, gitignored). There is no Vite: `import.meta.env` does nothing here. Bun inlines only literal `process.env.X` references matching the `PUBLIC_*` prefix, configured in `bunfig.toml` (`[serve.static] env = "PUBLIC_*"`, dev) and `build.ts` (`env: "PUBLIC_*"`, prod). Any new client-side env var must use the `PUBLIC_` prefix and be read as a literal `process.env.PUBLIC_FOO` (destructuring or indirect access won't be replaced).
- Role model per the product spec: student / teacher / admin, where the teacher role is granted by manual validation in the admin panel — gate on Clerk metadata, not on client-only state.

## shadcn/ui

- `components.json`: style `base-nova`, base color `neutral`, CSS variables on, icon library `lucide`, CSS entry `src/styles/globals.css`. Aliases: `@/components`, `@/components/ui`, `@/lib/utils`, `@/lib`, `@/hooks`.
- **This project uses Base UI (`@base-ui/react`), not Radix.** Composition uses the `render` prop, not `asChild`:
  ```tsx
  <NavigationMenuLink render={<Link to="/docs">Docs</Link>} />
  ```
  Other Base-vs-Radix API differences (Select, ToggleGroup, Slider, Accordion) are documented in `.agents/skills/shadcn/rules/base-vs-radix.md`.
- Add components with `bun run ui <name>` (pinned CLI: `bunx shadcn@4.16.1 add <name> --yes` matches what's installed). Don't hand-write files into `src/components/ui/`.
- Styling rules enforced by the bundled shadcn skill (`.agents/skills/shadcn/`): `className` for layout only — never override component colors/typography; semantic tokens (`bg-primary`, `text-muted-foreground`) never raw `bg-blue-500`; no `dark:` color overrides; `flex ... gap-*` instead of `space-x/y-*`; `size-*` when width equals height; `cn()` for conditional classes; no manual `z-index` on overlays. Forms use `FieldGroup`/`Field`.
- Custom SVG icons live in `src/components/icons/` (Material-style, `viewBox="0 -960 960 960"`, `fill="currentColor"`, `cn('w-6 h-6', className)`). Lucide is fine for generic icons.

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
