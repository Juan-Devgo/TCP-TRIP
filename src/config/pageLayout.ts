import type { PagePath } from "@/config/navigation";

/**
 * Width and padding of each page's column, as Tailwind classes. `TabHost`
 * applies them to the tab panel (which already centers it with `mx-auto
 * w-full`), so this is the one place to tune how much room a page gets and how
 * far it sits from the sidebar and the window edge.
 *
 * Only the horizontal box belongs here (`max-w-*`, `px-*`): the vertical
 * spacing of a page is its own component's business.
 *
 * Keyed on `PagePath`, like `PAGE_COMPONENTS`: a new page fails `bun run
 * typecheck` until it declares its layout, and a stale path is an error too.
 *
 * The classes are written out in full on purpose — Tailwind finds them by
 * scanning the source, so a class built by concatenation would never be
 * generated.
 */
export const PAGE_LAYOUT: Record<PagePath, string> = {
  "/tools/converters/number-bases": "max-w-[42em] px-6",
  "/tools/converters/ascii": "max-w-[42em] px-6",
  "/tools/calculators/ipv4": "max-w-[42em] px-6",
  "/tools/calculators/fragmentation": "max-w-6xl px-6",
  "/tools/calculators/checksum": "max-w-6xl px-6",
  "/theory/presentations": "max-w-[42em] px-6",
  "/teacher/presentations/new": "max-w-none px-4",
  "/teacher/presentations/mine": "max-w-none px-4",
  "/teacher/exercises/new": "max-w-[42em] px-6",
  "/teacher/exercises/mine": "max-w-[42em] px-6",
  "/teacher/courses/mine": "max-w-[42em] px-6",
  "/teacher/courses/assign": "max-w-[42em] px-6",
  "/admin/users": "max-w-[42em] px-6",
  "/admin/teachers": "max-w-[42em] px-6",
  "/admin/presentations": "max-w-[42em] px-6",
  "/admin/theory": "max-w-[42em] px-6",
  "/generic-protocol/new": "max-w-none px-4",
  "/generic-protocol/mine": "max-w-[42em] px-6",
  "/generic-protocol/messages": "max-w-[42em] px-6",
};

/** The not-found page and any path that is not a registered page. */
export const DEFAULT_PAGE_LAYOUT = "max-w-[42em] px-6";

/** Home: wide enough for a three-column grid of tool cards. */
export const HOME_PAGE_LAYOUT = "max-w-5xl px-6";

export function pageLayout(path: string): string {
  return PAGE_LAYOUT[path as PagePath] ?? DEFAULT_PAGE_LAYOUT;
}
