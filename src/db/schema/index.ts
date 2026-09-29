/**
 * Every DDL statement of the database, in dependency order (a table before the
 * tables that reference it, a table before its indexes).
 *
 * Rules for anything added here:
 * - **Idempotent.** `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`;
 *   `initDatabase` replays this list on every boot.
 * - **Append, never rewrite.** Changing a shipped statement does nothing to a
 *   file that already has the table. Altering an existing table needs a real
 *   migration step, not an edit here.
 * - **DDL only.** Reads and writes belong to a domain's `*.queries.ts`.
 */
export const SCHEMA_STATEMENTS: readonly string[] = [
  /**
   * A protocol built in the constructor, stored as the JSON document the
   * builder exports (`ProtocolDocument`).
   *
   * - `user_id` is the **Clerk** user id (`user_…`). There is no users table
   *   and there is not going to be one: Clerk owns identity and the role, so
   *   mirroring it here would duplicate a source of truth. No foreign key
   *   follows from that — rows are cleaned up by user id, not by cascade.
   * - `share_id` is NULL until the protocol is shared. SQLite counts NULLs as
   *   distinct, so `UNIQUE` allows any number of unshared rows while still
   *   guaranteeing a share link resolves to exactly one protocol.
   * - `name` and `schema_version` are columns rather than reads out of the
   *   JSON, so listing and sorting never parse a document.
   * - Timestamps are ISO-8601 UTC strings: they sort lexicographically, which
   *   is what the index below relies on.
   */
  `CREATE TABLE IF NOT EXISTS protocols (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    name           TEXT NOT NULL CHECK (name <> ''),
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    document       TEXT NOT NULL CHECK (json_valid(document)),
    share_id       TEXT UNIQUE,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );`,

  /** `Mis Protocolos` reads exactly this: one user's rows, newest first. */
  `CREATE INDEX IF NOT EXISTS protocols_user_updated_idx
    ON protocols (user_id, updated_at DESC);`,

  /**
   * A theory presentation as its author is still working on it — the **draft**.
   * What students read in Theory is never this row; see
   * `presentation_publications` below.
   *
   * - `user_id` is the Clerk id of the teacher who owns it. Same reasoning as
   *   `protocols`: Clerk owns identity and the role, so there is no users
   *   table and no foreign key to one.
   * - `title`, `topic`, `mode` and `schema_version` are columns rather than
   *   reads out of the JSON, so listing, filtering by topic and sorting never
   *   parse a document.
   * - `status` is the review state of *this draft*, not of the published copy:
   *   an author may keep editing a `published` presentation, and Theory goes on
   *   serving the frozen snapshot until a new submission is approved.
   * - `review_note` holds the reason of the **last** decision, duplicated from
   *   the review log so the editor can show it without a second query.
   */
  `CREATE TABLE IF NOT EXISTS presentations (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    title          TEXT NOT NULL CHECK (title <> ''),
    topic          TEXT NOT NULL CHECK (topic <> ''),
    mode           TEXT NOT NULL CHECK (mode IN ('slides', 'markdown')),
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    document       TEXT NOT NULL CHECK (json_valid(document)),
    status         TEXT NOT NULL CHECK (
                     status IN ('draft', 'pending', 'published', 'rejected')
                   ),
    submitted_at   TEXT,
    reviewed_at    TEXT,
    review_note    TEXT,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );`,

  /** `Mis Presentaciones`: one teacher's drafts, most recently touched first. */
  `CREATE INDEX IF NOT EXISTS presentations_user_updated_idx
    ON presentations (user_id, updated_at DESC);`,

  /**
   * The admin review queue: pending first-submitted-first, so a teacher who
   * submitted on Monday is not behind one who submitted on Friday.
   */
  `CREATE INDEX IF NOT EXISTS presentations_status_submitted_idx
    ON presentations (status, submitted_at);`,

  /**
   * What Theory actually serves: a **frozen copy** of the document as the admin
   * approved it.
   *
   * The snapshot is the point of the review. If Theory read the draft row, an
   * author could rewrite approved content with no second look and the approval
   * gate would mean nothing — so approving copies the document here, and the
   * author's later edits stay in their draft until they submit again.
   *
   * - One publication per presentation (`presentation_id` is the primary key):
   *   re-approving replaces the snapshot instead of accumulating versions.
   * - `ON DELETE CASCADE`: deleting the draft takes the published copy with it,
   *   which is what "the author deleted it" has to mean.
   * - `author_name` is a snapshot too. It is the byline students see; resolving
   *   it from Clerk on every read would make a public page depend on an
   *   external call, and the name at approval time is the one that was
   *   reviewed.
   */
  `CREATE TABLE IF NOT EXISTS presentation_publications (
    presentation_id TEXT PRIMARY KEY
                      REFERENCES presentations (id) ON DELETE CASCADE,
    slug            TEXT NOT NULL UNIQUE,
    topic           TEXT NOT NULL CHECK (topic <> ''),
    title           TEXT NOT NULL CHECK (title <> ''),
    author_name     TEXT NOT NULL,
    schema_version  INTEGER NOT NULL CHECK (schema_version > 0),
    document        TEXT NOT NULL CHECK (json_valid(document)),
    approved_by     TEXT NOT NULL,
    published_at    TEXT NOT NULL
  );`,

  /** The Theory listing: everything published under one topic, newest first. */
  `CREATE INDEX IF NOT EXISTS presentation_publications_topic_idx
    ON presentation_publications (topic, published_at DESC);`,

  /**
   * The review log — **append-only**, one row per decision or submission.
   *
   * A single `status` column could not answer "why was this rejected the first
   * time?", and a resubmission would overwrite the reason the author still
   * needs to read. Keeping the history also gives the admin panel an audit
   * trail of who decided what, which is the one place this app acts on another
   * user's content.
   */
  `CREATE TABLE IF NOT EXISTS presentation_reviews (
    id              TEXT PRIMARY KEY,
    presentation_id TEXT NOT NULL
                      REFERENCES presentations (id) ON DELETE CASCADE,
    actor_id        TEXT NOT NULL,
    action          TEXT NOT NULL CHECK (
                      action IN ('submit', 'approve', 'reject', 'withdraw')
                    ),
    note            TEXT,
    created_at      TEXT NOT NULL
  );`,

  /** One presentation's history, newest first — what the editor shows. */
  `CREATE INDEX IF NOT EXISTS presentation_reviews_presentation_idx
    ON presentation_reviews (presentation_id, created_at DESC);`,

  /**
   * Images used by slides, stored as bytes.
   *
   * They are rows and not part of the document because a base64 data URI would
   * be re-sent on every autosave and would blow the document size cap after two
   * screenshots. They are rows and not files on disk because the SQLite file is
   * then the whole backup — no orphaned uploads, no second thing to deploy.
   *
   * `user_id` is denormalised from the presentation so the owner check on an
   * asset read is one query with no join.
   */
  `CREATE TABLE IF NOT EXISTS presentation_assets (
    id              TEXT PRIMARY KEY,
    presentation_id TEXT NOT NULL
                      REFERENCES presentations (id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    filename        TEXT NOT NULL,
    mime            TEXT NOT NULL CHECK (mime <> ''),
    byte_size       INTEGER NOT NULL CHECK (byte_size > 0),
    bytes           BLOB NOT NULL,
    created_at      TEXT NOT NULL
  );`,

  /** The editor's asset list, and the per-presentation upload count check. */
  `CREATE INDEX IF NOT EXISTS presentation_assets_presentation_idx
    ON presentation_assets (presentation_id, created_at DESC);`,

  /**
   * How far a reader has got through a published presentation — one row per
   * reader per presentation, which is what the composite primary key says.
   *
   * - **One percentage for both modes.** The reading view and the projector
   *   view are two renderings of the same content, so they write to the same
   *   row: half read as markdown is half read, whichever way it is reopened.
   * - `percent` is the **furthest** point reached, kept monotonic by the
   *   `MAX(...)` in the upsert — scrolling back up to re-read something is not
   *   losing progress.
   * - `position` is an opaque resume hint written by whichever view was open
   *   (`slide:4`, `scroll:0.42`). The server stores it and never parses it, so
   *   a new view can invent its own spelling without a migration.
   * - Keyed on `presentation_id` and not on the publication slug, so
   *   `ON DELETE CASCADE` cleans the rows up with the presentation. The routes
   *   speak slugs and the repository resolves them.
   * - `user_id` is the Clerk id of **any** signed-in reader, students included:
   *   this is the one presentation table a student writes to.
   */
  `CREATE TABLE IF NOT EXISTS presentation_progress (
    presentation_id TEXT NOT NULL
                      REFERENCES presentations (id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    percent         INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
    position        TEXT,
    updated_at      TEXT NOT NULL,
    PRIMARY KEY (user_id, presentation_id)
  );`,

  /**
   * The Theory index reads every row of one reader in one query, to badge the
   * listing without a request per card.
   */
  `CREATE INDEX IF NOT EXISTS presentation_progress_user_idx
    ON presentation_progress (user_id, updated_at DESC);`,

  /**
   * A section of the Theory group in the sidebar, created by an administrator.
   *
   * The Theory navigation is **content, not code**: an admin groups the
   * approved presentations the way the course is taught, so publishing one no
   * longer means editing `src/config/navigation.ts`. The static nodes of that
   * tree still exist; these rows are appended to the same group at runtime.
   *
   * - `icon` is a **name** from the allowlist in `src/lib/theory/contract.ts`
   *   (`book-open`, `layers`, …), never markup: the client maps the name to a
   *   component, so anything else would be storing code in a label.
   * - `position` is the sidebar order. It is dense-ish but never assumed to be
   *   gapless — the repository orders by `(position, created_at)`, so two rows
   *   sharing a position still render deterministically.
   * - `created_by` is the Clerk id of the admin who added it, for the same
   *   reason the review log keeps one: this is a change to what every user
   *   sees.
   */
  `CREATE TABLE IF NOT EXISTS theory_sections (
    id         TEXT PRIMARY KEY,
    label      TEXT NOT NULL CHECK (label <> ''),
    icon       TEXT NOT NULL CHECK (icon <> ''),
    position   INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  /** The sidebar reads every section in one query, in its own order. */
  `CREATE INDEX IF NOT EXISTS theory_sections_position_idx
    ON theory_sections (position, created_at);`,

  /**
   * One entry of a Theory section: a presentation assigned to it.
   *
   * - The row points at the **presentation**, not at a slug, so the link
   *   follows a re-approval and dies with the presentation (`ON DELETE
   *   CASCADE`). The menu resolves the slug through
   *   `presentation_publications`, which is what makes an entry vanish by
   *   itself when its presentation is withdrawn instead of becoming a 404.
   * - `presentation_id` is `UNIQUE` across the whole menu: the same
   *   presentation cannot be filed under two sections, so moving it is an
   *   update and never a duplicate a reader has to make sense of.
   * - `label` is NULL when the admin kept the author's title. Storing NULL
   *   rather than a copy means a re-approved title change still shows up.
   */
  `CREATE TABLE IF NOT EXISTS theory_section_items (
    id              TEXT PRIMARY KEY,
    section_id      TEXT NOT NULL
                      REFERENCES theory_sections (id) ON DELETE CASCADE,
    presentation_id TEXT NOT NULL UNIQUE
                      REFERENCES presentations (id) ON DELETE CASCADE,
    label           TEXT,
    position        INTEGER NOT NULL,
    created_by      TEXT NOT NULL,
    created_at      TEXT NOT NULL
  );`,

  /** One section's entries, in order — and the per-section count check. */
  `CREATE INDEX IF NOT EXISTS theory_section_items_section_idx
    ON theory_section_items (section_id, position, created_at);`,

  /**
   * The speaker notes of a publication, kept **beside** the frozen copy rather
   * than inside it.
   *
   * The published `document` is served to anyone and stays stripped of notes.
   * The author, projecting their own approved deck, still needs the notes that
   * belong to *that* version — not to whatever the draft says today — so the
   * approval freezes them here too, and only an owner-scoped read (joined to
   * `presentations.user_id`) returns them. `notes` is a JSON object keyed on
   * slide id. The row dies with the publication (`ON DELETE CASCADE`), so
   * withdrawing a presentation takes its notes out of reach as well.
   */
  `CREATE TABLE IF NOT EXISTS presentation_speaker_notes (
    presentation_id TEXT PRIMARY KEY
                      REFERENCES presentation_publications (presentation_id)
                      ON DELETE CASCADE,
    notes           TEXT NOT NULL CHECK (json_valid(notes))
  );`,

  /**
   * A teacher's saved exercise set (`Crear ejercicios`): the generated prompts
   * and answers **frozen** as JSON in `blocks`, not the configuration that
   * produced them — re-downloading must give the PDF the students received.
   * `user_id` is the Clerk id, as everywhere else.
   */
  `CREATE TABLE IF NOT EXISTS exercise_sets (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL CHECK (title <> ''),
    language    TEXT NOT NULL,
    blocks      TEXT NOT NULL CHECK (json_valid(blocks)),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );`,

  /** `Mis ejercicios`: one teacher's sets, newest first. */
  `CREATE INDEX IF NOT EXISTS exercise_sets_user_created_idx
    ON exercise_sets (user_id, created_at DESC);`,

  /**
   * Where a set was handed out: one row per Classroom assignment it was
   * attached to. A set with any usage is frozen (the repository refuses the
   * update). Course and assignment names are snapshots, kept in step when the
   * assignment is edited from TCP-TRIP.
   */
  `CREATE TABLE IF NOT EXISTS exercise_set_usages (
    id               TEXT PRIMARY KEY,
    set_id           TEXT NOT NULL REFERENCES exercise_sets (id) ON DELETE CASCADE,
    user_id          TEXT NOT NULL,
    course_id        TEXT NOT NULL,
    course_name      TEXT NOT NULL,
    coursework_id    TEXT NOT NULL,
    coursework_title TEXT NOT NULL,
    link             TEXT NOT NULL,
    assigned_at      TEXT NOT NULL,
    due_at           TEXT
  );`,

  `CREATE INDEX IF NOT EXISTS exercise_set_usages_set_idx
    ON exercise_set_usages (set_id, assigned_at DESC);`,

  /**
   * A Classroom assignment **TCP-TRIP created** — the only ones it may edit
   * (API project lock). `request_id` is minted by the client per draft, so a
   * retry after a network failure finds the task instead of duplicating it.
   * `instructions_html` keeps the formatting Classroom itself cannot store.
   */
  `CREATE TABLE IF NOT EXISTS classroom_assignments (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL,
    request_id        TEXT NOT NULL,
    course_id         TEXT NOT NULL,
    coursework_id     TEXT NOT NULL,
    title             TEXT NOT NULL,
    instructions_html TEXT NOT NULL,
    max_points        REAL,
    due_at            TEXT,
    state             TEXT NOT NULL,
    scheduled_at      TEXT,
    link              TEXT NOT NULL,
    student_ids       TEXT NOT NULL CHECK (json_valid(student_ids)),
    exercise_set_ids  TEXT NOT NULL CHECK (json_valid(exercise_set_ids)),
    presentation_slugs TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(presentation_slugs)),
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    UNIQUE (user_id, request_id)
  );`,

  `CREATE INDEX IF NOT EXISTS classroom_assignments_course_idx
    ON classroom_assignments (user_id, course_id, created_at DESC);`,

  /**
   * Announcements have no local row beyond this: the request id → Classroom id
   * mapping that makes a retried post idempotent.
   */
  `CREATE TABLE IF NOT EXISTS classroom_announcement_requests (
    user_id         TEXT NOT NULL,
    request_id      TEXT NOT NULL,
    announcement_id TEXT NOT NULL,
    PRIMARY KEY (user_id, request_id)
  );`,

  /**
   * A revoked grant looks exactly like an expired one to Google. This row
   * remembers the teacher chose to disconnect, so the UI says "not connected"
   * instead of "your authorization expired".
   */
  `CREATE TABLE IF NOT EXISTS classroom_disconnects (
    user_id TEXT PRIMARY KEY,
    at      TEXT NOT NULL
  );`,
];
