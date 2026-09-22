/**
 * The Theory menu contract, shared by the browser and the Bun server.
 *
 * The Theory section of the sidebar is **not** a fixed tree: an administrator
 * builds it. They create sections (a name and an icon) and assign approved
 * presentations to them, so the navigation a student sees follows the syllabus
 * of the course rather than the order in which teachers happened to publish.
 *
 * Two rules shape everything here:
 *
 * - **Only approved content can be linked.** An item points at a presentation,
 *   and the menu resolves it through `presentation_publications` — so an entry
 *   whose presentation was withdrawn disappears from the menu on its own
 *   instead of becoming a dead link.
 * - **The icon is a name, not markup.** Admins pick from the list below and the
 *   server refuses anything else; the client maps the name to a Lucide
 *   component (`src/components/common/TheoryIcon.tsx`). Storing a class name or
 *   an SVG would be storing code.
 *
 * No imports: this file is the vocabulary both halves agree on.
 */

/* ------------------------------------------------------------------ limits */

export const MAX_THEORY_SECTION_LABEL_LENGTH = 80;
export const MAX_THEORY_ITEM_LABEL_LENGTH = 120;

/** A sidebar is navigation, not a database listing — both caps are generous. */
export const MAX_THEORY_SECTIONS = 20;
export const MAX_THEORY_ITEMS_PER_SECTION = 50;

/* ------------------------------------------------------------------- icons */

/**
 * The icons an administrator may choose, by Lucide's own kebab-case name.
 *
 * An allowlist and not free text: the name is rendered as a component, so the
 * set of valid names is part of the contract. Adding one means adding it here
 * *and* to the map in `TheoryIcon.tsx` — the client's exhaustive record makes a
 * forgotten entry a compile error.
 */
export const THEORY_ICON_NAMES = [
  "book-open",
  "layers",
  "network",
  "globe",
  "route",
  "cable",
  "server",
  "mail",
  "radio",
  "shield",
  "binary",
  "waypoints",
  "file-text",
  "presentation",
  "graduation-cap",
] as const;

export type TheoryIconName = (typeof THEORY_ICON_NAMES)[number];

export const DEFAULT_THEORY_ICON: TheoryIconName = "book-open";

export function isTheoryIconName(value: unknown): value is TheoryIconName {
  return (
    typeof value === "string" &&
    (THEORY_ICON_NAMES as readonly string[]).includes(value)
  );
}

/* ------------------------------------------------------------------ entities */

/** One entry of the menu, as a reader gets it. */
export type TheoryMenuItem = {
  id: string;
  /** The label the admin gave it, falling back to the published title. */
  label: string;
  /** Where it goes: `/theory/presentations/<slug>`. */
  slug: string;
};

/** A section of the Theory group — what the sidebar renders as a collapsible. */
export type TheoryMenuSection = {
  id: string;
  label: string;
  icon: TheoryIconName;
  items: TheoryMenuItem[];
};

/**
 * The admin's view of an entry. It keeps the internal presentation id (the
 * admin panel needs it to move or delete the entry) and says whether the
 * presentation behind it is still published — an unpublished one is listed
 * here, greyed out, and absent from the reader's menu.
 */
export type TheoryAdminItem = TheoryMenuItem & {
  presentationId: string;
  /** The author's own title, which the label may override. */
  title: string;
  /** `false` once the presentation is withdrawn: readers stop seeing it. */
  published: boolean;
};

export type TheoryAdminSection = Omit<TheoryMenuSection, "items"> & {
  items: TheoryAdminItem[];
};

/** A published presentation not yet anywhere in the menu. */
export type AssignablePresentation = {
  presentationId: string;
  slug: string;
  title: string;
  topic: string;
  authorName: string;
  publishedAt: string;
};

/** What the admin panel loads in one request. */
export type TheoryMenuAdminView = {
  sections: TheoryAdminSection[];
  assignable: AssignablePresentation[];
};

/* ---------------------------------------------------------------- validation */

/**
 * A label, trimmed, or `null` when it is empty or too long.
 *
 * Both halves call this: the client to disable its save button, the server to
 * decide. The server's answer is the one that counts.
 */
export function normalizeLabel(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > max) return null;

  return trimmed;
}

/** `-1` (up) or `1` (down), the only moves the reorder endpoint takes. */
export type MoveDirection = -1 | 1;

export function isMoveDirection(value: unknown): value is MoveDirection {
  return value === -1 || value === 1;
}
