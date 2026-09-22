/** The Theory menu tables as SQLite returns them. */

/** One row of the reader's menu: a section, and one of its entries or NULLs. */
export type PublicMenuRow = {
  section_id: string;
  section_label: string;
  section_icon: string;
  /** NULL when the section has no published entry — an empty section. */
  item_id: string | null;
  item_label: string | null;
  slug: string | null;
  title: string | null;
};

/** The same, as the admin panel reads it: entries that are no longer live too. */
export type AdminMenuRow = {
  section_id: string;
  section_label: string;
  section_icon: string;
  item_id: string | null;
  item_label: string | null;
  presentation_id: string | null;
  /** The author's current draft title — the fallback when nothing is live. */
  draft_title: string | null;
  /** NULL = the presentation behind this entry is not published. */
  slug: string | null;
  published_title: string | null;
};

export type AssignableRow = {
  presentation_id: string;
  slug: string;
  title: string;
  topic: string;
  author_name: string;
  published_at: string;
};

export type SectionRow = {
  id: string;
  label: string;
  icon: string;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ItemRow = {
  id: string;
  section_id: string;
  presentation_id: string;
  label: string | null;
  position: number;
  created_by: string;
  created_at: string;
};

/** `(id, position)` pairs in sidebar order — what a move swaps. */
export type OrderRow = {
  id: string;
  position: number;
};
