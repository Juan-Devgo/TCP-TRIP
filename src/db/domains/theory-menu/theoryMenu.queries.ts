/**
 * Every SQL statement of the Theory menu, as named constants.
 *
 * Two joins carry the design:
 *
 * - The **public** menu joins items through `presentation_publications`, so an
 *   entry only exists while its presentation is approved. Nothing has to clean
 *   up after a withdrawal.
 * - The **admin** menu joins `presentations` as well, so the panel can list an
 *   entry whose presentation is no longer live and say so, instead of silently
 *   dropping a row the admin put there.
 */

/**
 * The reader's menu: every section, with only its published entries.
 *
 * The publication filter lives **inside** the joined subquery, not in a
 * `WHERE`. In a `WHERE` it would also delete the section's own row from the
 * result, so a section whose single entry was withdrawn would disappear
 * instead of showing up empty.
 */
export const SELECT_PUBLIC_MENU = `
  SELECT s.id         AS section_id,
         s.label      AS section_label,
         s.icon       AS section_icon,
         i.id         AS item_id,
         i.label      AS item_label,
         i.slug       AS slug,
         i.title      AS title
    FROM theory_sections s
    LEFT JOIN (
           SELECT it.id,
                  it.section_id,
                  it.label,
                  it.position,
                  it.created_at,
                  pub.slug,
                  pub.title
             FROM theory_section_items it
             JOIN presentation_publications pub
               ON pub.presentation_id = it.presentation_id
         ) i
      ON i.section_id = s.id
   ORDER BY s.position, s.created_at, i.position, i.created_at
`;

/** The admin panel's menu: every entry, live or not. */
export const SELECT_ADMIN_MENU = `
  SELECT s.id              AS section_id,
         s.label           AS section_label,
         s.icon            AS section_icon,
         i.id              AS item_id,
         i.label           AS item_label,
         i.presentation_id AS presentation_id,
         p.title           AS draft_title,
         pub.slug          AS slug,
         pub.title         AS published_title
    FROM theory_sections s
    LEFT JOIN theory_section_items i
      ON i.section_id = s.id
    LEFT JOIN presentations p
      ON p.id = i.presentation_id
    LEFT JOIN presentation_publications pub
      ON pub.presentation_id = i.presentation_id
   ORDER BY s.position, s.created_at, i.position, i.created_at
`;

/**
 * Published presentations the menu does not link yet — what the admin picks
 * from. The `LEFT JOIN … IS NULL` is the "not already filed" test, and it works
 * because `presentation_id` is unique across the items table.
 */
export const SELECT_ASSIGNABLE = `
  SELECT pub.presentation_id AS presentation_id,
         pub.slug            AS slug,
         pub.title           AS title,
         pub.topic           AS topic,
         pub.author_name     AS author_name,
         pub.published_at    AS published_at
    FROM presentation_publications pub
    LEFT JOIN theory_section_items i
      ON i.presentation_id = pub.presentation_id
   WHERE i.id IS NULL
   ORDER BY pub.published_at DESC
`;

/* ---------------------------------------------------------------- sections */

export const COUNT_SECTIONS = `SELECT COUNT(*) AS count FROM theory_sections;`;

/** Appending: one past the last position, so a new section lands at the end. */
export const NEXT_SECTION_POSITION = `
  SELECT COALESCE(MAX(position), -1) + 1 AS position FROM theory_sections;
`;

export const INSERT_SECTION = `
  INSERT INTO theory_sections
         (id, label, icon, position, created_by, created_at, updated_at)
  VALUES ($id, $label, $icon, $position, $createdBy, $createdAt, $updatedAt);
`;

export const UPDATE_SECTION = `
  UPDATE theory_sections
     SET label = $label,
         icon = $icon,
         updated_at = $updatedAt
   WHERE id = $id;
`;

export const DELETE_SECTION = `DELETE FROM theory_sections WHERE id = $id;`;

export const SELECT_SECTION = `
  SELECT id, label, icon, position, created_by, created_at, updated_at
    FROM theory_sections
   WHERE id = $id;
`;

/** The sections in sidebar order — what a move reads before swapping. */
export const SELECT_SECTION_ORDER = `
  SELECT id, position FROM theory_sections ORDER BY position, created_at;
`;

export const SET_SECTION_POSITION = `
  UPDATE theory_sections SET position = $position, updated_at = $updatedAt
   WHERE id = $id;
`;

/* ------------------------------------------------------------------- items */

export const COUNT_ITEMS_IN_SECTION = `
  SELECT COUNT(*) AS count FROM theory_section_items WHERE section_id = $sectionId;
`;

export const NEXT_ITEM_POSITION = `
  SELECT COALESCE(MAX(position), -1) + 1 AS position
    FROM theory_section_items
   WHERE section_id = $sectionId;
`;

export const INSERT_ITEM = `
  INSERT INTO theory_section_items
         (id, section_id, presentation_id, label, position, created_by, created_at)
  VALUES ($id, $sectionId, $presentationId, $label, $position, $createdBy, $createdAt);
`;

export const SELECT_ITEM = `
  SELECT id, section_id, presentation_id, label, position, created_by, created_at
    FROM theory_section_items
   WHERE id = $id;
`;

/** Renaming an entry. NULL restores the author's own title. */
export const UPDATE_ITEM_LABEL = `
  UPDATE theory_section_items SET label = $label WHERE id = $id;
`;

/**
 * Moving an entry to another section. The new position is appended there, so
 * the entry lands at the end of its new section and no other row shifts.
 */
export const MOVE_ITEM_TO_SECTION = `
  UPDATE theory_section_items
     SET section_id = $sectionId, position = $position
   WHERE id = $id;
`;

export const DELETE_ITEM = `DELETE FROM theory_section_items WHERE id = $id;`;

export const SELECT_ITEM_ORDER = `
  SELECT id, position
    FROM theory_section_items
   WHERE section_id = $sectionId
   ORDER BY position, created_at;
`;

export const SET_ITEM_POSITION = `
  UPDATE theory_section_items SET position = $position WHERE id = $id;
`;

/**
 * Whether a presentation is approved right now. Adding an entry checks this:
 * the menu is a listing of *published* material, so an unapproved draft is
 * refused instead of becoming an entry that resolves to nothing.
 */
export const SELECT_PUBLICATION_FOR_PRESENTATION = `
  SELECT slug, title FROM presentation_publications WHERE presentation_id = $presentationId;
`;
