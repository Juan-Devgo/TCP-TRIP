/**
 * Every statement the `presentations` domain runs.
 *
 * **Ownership is in the `WHERE` clause.** Every owner-scoped query filters on
 * `user_id`, so a request carrying somebody else's presentation id matches zero
 * rows instead of returning their work — the check cannot be forgotten in a
 * branch, because it *is* the query.
 *
 * The exceptions are deliberate and named: the admin queue and the admin read
 * (moderation is the one place this app acts on another user's content — the
 * role, not the query, is what guards them) and the two public reads behind a
 * published slug.
 *
 * Every draft read goes through the same `LEFT JOIN` on
 * `presentation_publications`, so a draft always arrives knowing whether a
 * snapshot of it is live and under which slug.
 */

/** The shared projection: a draft plus where it is published, if anywhere. */
const DRAFT_SELECT = `
  SELECT p.*,
         pub.slug         AS published_slug,
         pub.published_at AS published_at
    FROM presentations p
    LEFT JOIN presentation_publications pub
      ON pub.presentation_id = p.id
`;

export const INSERT_PRESENTATION = `
  INSERT INTO presentations (
    id, user_id, title, topic, mode, schema_version, document, status,
    submitted_at, reviewed_at, review_note, created_at, updated_at
  )
  VALUES (
    $id, $userId, $title, $topic, $mode, $schemaVersion, $document, 'draft',
    NULL, NULL, NULL, $createdAt, $updatedAt
  )
`;

/**
 * Saving a draft never touches `status`: an editor autosave must not silently
 * pull a presentation out of the review queue, and it must not mark a rejected
 * one as fixed either — only `submit` does that.
 */
export const UPDATE_PRESENTATION = `
  UPDATE presentations
     SET title = $title,
         topic = $topic,
         mode = $mode,
         schema_version = $schemaVersion,
         document = $document,
         updated_at = $updatedAt
   WHERE id = $id
     AND user_id = $userId
`;

export const SELECT_PRESENTATION = `
  ${DRAFT_SELECT}
   WHERE p.id = $id
     AND p.user_id = $userId
`;

export const SELECT_PRESENTATIONS_BY_USER = `
  ${DRAFT_SELECT}
   WHERE p.user_id = $userId
   ORDER BY p.updated_at DESC
`;

export const DELETE_PRESENTATION = `
  DELETE FROM presentations
   WHERE id = $id
     AND user_id = $userId
`;

/**
 * Submits a draft for review. The guard is the whole point: only these three
 * states may enter the queue, so a double click cannot reset `submitted_at` on
 * something already waiting and lose its place in the line.
 */
export const SUBMIT_PRESENTATION = `
  UPDATE presentations
     SET status = 'pending',
         submitted_at = $submittedAt,
         review_note = NULL,
         updated_at = $submittedAt
   WHERE id = $id
     AND user_id = $userId
     AND status IN ('draft', 'rejected', 'published')
`;

/**
 * Pulls a submission back out of the queue, or takes a published presentation
 * down. Both are the same act from the author's side — "not for students right
 * now" — so both land on `draft`; the publication row is deleted separately in
 * the same transaction.
 */
export const WITHDRAW_PRESENTATION = `
  UPDATE presentations
     SET status = 'draft',
         submitted_at = NULL,
         updated_at = $updatedAt
   WHERE id = $id
     AND user_id = $userId
     AND status IN ('pending', 'published')
`;

/* --------------------------------------------------------------- admin side */

/**
 * The review queue. Oldest submission first — a queue that showed the newest
 * first would starve whoever submitted on Monday.
 */
export const SELECT_PRESENTATIONS_BY_STATUS = `
  ${DRAFT_SELECT}
   WHERE p.status = $status
   ORDER BY p.submitted_at ASC, p.updated_at ASC
`;

/**
 * An admin reading any draft, by id and with **no owner filter** — the only
 * read in the domain like this. It exists because a reviewer has to see the
 * content before approving it; the route's role check is what guards it.
 */
export const SELECT_PRESENTATION_FOR_REVIEW = `
  ${DRAFT_SELECT}
   WHERE p.id = $id
`;

/**
 * Records the decision on the draft. The `status = 'pending'` guard makes a
 * second approval of the same submission a no-op, so two admins clicking at
 * once cannot both publish it.
 */
export const DECIDE_PRESENTATION = `
  UPDATE presentations
     SET status = $status,
         reviewed_at = $reviewedAt,
         review_note = $note,
         updated_at = $reviewedAt
   WHERE id = $id
     AND status = 'pending'
`;

/**
 * Freezes the approved document. `ON CONFLICT` on the primary key means
 * re-approving a presentation replaces its snapshot — and keeps the original
 * `slug`, so a link already handed to a class goes on working.
 */
export const UPSERT_PUBLICATION = `
  INSERT INTO presentation_publications (
    presentation_id, slug, topic, title, author_name, schema_version,
    document, approved_by, published_at
  )
  VALUES (
    $presentationId, $slug, $topic, $title, $authorName, $schemaVersion,
    $document, $approvedBy, $publishedAt
  )
  ON CONFLICT (presentation_id) DO UPDATE SET
    topic = excluded.topic,
    title = excluded.title,
    author_name = excluded.author_name,
    schema_version = excluded.schema_version,
    document = excluded.document,
    approved_by = excluded.approved_by,
    published_at = excluded.published_at
`;

export const DELETE_PUBLICATION = `
  DELETE FROM presentation_publications
   WHERE presentation_id = $presentationId
`;

export const SELECT_PUBLICATION_BY_PRESENTATION = `
  SELECT * FROM presentation_publications
   WHERE presentation_id = $presentationId
`;

export const SELECT_SLUG_OWNER = `
  SELECT presentation_id FROM presentation_publications
   WHERE slug = $slug
`;

/* -------------------------------------------------------------- public side */

/** The one read with no owner and no role: a published page is public. */
export const SELECT_PUBLICATION_BY_SLUG = `
  SELECT * FROM presentation_publications
   WHERE slug = $slug
`;

/**
 * The Theory index. `json_array_length` counts the slides in SQLite so the
 * listing never parses a document it is not going to render.
 */
export const SELECT_PUBLICATIONS = `
  SELECT slug, topic, title, author_name, published_at,
         json_array_length(document, '$.slides') AS slide_count
    FROM presentation_publications
   ORDER BY published_at DESC
`;

export const SELECT_PUBLICATIONS_BY_TOPIC = `
  SELECT slug, topic, title, author_name, published_at,
         json_array_length(document, '$.slides') AS slide_count
    FROM presentation_publications
   WHERE topic = $topic
   ORDER BY published_at DESC
`;

/* -------------------------------------------------------------- review log */

export const INSERT_REVIEW = `
  INSERT INTO presentation_reviews (
    id, presentation_id, actor_id, action, note, created_at
  )
  VALUES ($id, $presentationId, $actorId, $action, $note, $createdAt)
`;

/**
 * Newest first, and `rowid` breaks the ties: two decisions can land in the same
 * millisecond (a submit immediately followed by an approval in tests, or a
 * fast reviewer), and an ISO timestamp alone would then order them arbitrarily.
 */
export const SELECT_REVIEWS = `
  SELECT * FROM presentation_reviews
   WHERE presentation_id = $presentationId
   ORDER BY created_at DESC, rowid DESC
`;

/* ------------------------------------------------------------------ assets */

export const INSERT_ASSET = `
  INSERT INTO presentation_assets (
    id, presentation_id, user_id, filename, mime, byte_size, bytes, created_at
  )
  VALUES (
    $id, $presentationId, $userId, $filename, $mime, $byteSize, $bytes,
    $createdAt
  )
`;

export const COUNT_ASSETS = `
  SELECT COUNT(*) AS count FROM presentation_assets
   WHERE presentation_id = $presentationId
`;

export const SELECT_ASSETS = `
  SELECT id, presentation_id, user_id, filename, mime, byte_size, created_at
    FROM presentation_assets
   WHERE presentation_id = $presentationId
   ORDER BY created_at DESC
`;

/**
 * An asset read, with its authorisation in the query: the row comes back if the
 * caller owns it **or** if a snapshot of its presentation is published, which
 * is what makes images load for a student who owns nothing.
 *
 * `$userId` is the empty string for a signed-out reader — it matches no Clerk
 * id, so such a caller only ever gets published assets.
 */
export const SELECT_ASSET_FOR_READ = `
  SELECT a.*
    FROM presentation_assets a
    LEFT JOIN presentation_publications pub
      ON pub.presentation_id = a.presentation_id
   WHERE a.id = $id
     AND (a.user_id = $userId OR pub.presentation_id IS NOT NULL)
`;

export const DELETE_ASSET = `
  DELETE FROM presentation_assets
   WHERE id = $id
     AND presentation_id = $presentationId
     AND user_id = $userId
`;

/* ---------------------------------------------------------------- progress */

/**
 * Records how far a reader got. `MAX(...)` is what makes the stored percentage
 * the **furthest** point reached instead of the last one — a reader scrolling
 * back up, or reopening a finished presentation at slide one, does not lose it.
 *
 * `position` is overwritten every time, because it answers a different question
 * ("where was I?") and the latest answer is the useful one.
 */
export const UPSERT_PROGRESS = `
  INSERT INTO presentation_progress (
    presentation_id, user_id, percent, position, updated_at
  )
  VALUES ($presentationId, $userId, $percent, $position, $updatedAt)
  ON CONFLICT (user_id, presentation_id) DO UPDATE SET
    percent = MAX(excluded.percent, presentation_progress.percent),
    position = excluded.position,
    updated_at = excluded.updated_at
`;

/** One reader's progress on one presentation, joined to the slug it is read by. */
export const SELECT_PROGRESS = `
  SELECT pub.slug AS slug, pr.percent, pr.position, pr.updated_at
    FROM presentation_progress pr
    JOIN presentation_publications pub
      ON pub.presentation_id = pr.presentation_id
   WHERE pr.user_id = $userId
     AND pr.presentation_id = $presentationId
`;

/**
 * Everything one reader has started, for badging the Theory index in a single
 * request. The `JOIN` drops progress on presentations that are no longer
 * published — there is nothing to link to, so there is nothing to show.
 */
export const SELECT_PROGRESS_BY_USER = `
  SELECT pub.slug AS slug, pr.percent, pr.position, pr.updated_at
    FROM presentation_progress pr
    JOIN presentation_publications pub
      ON pub.presentation_id = pr.presentation_id
   WHERE pr.user_id = $userId
   ORDER BY pr.updated_at DESC
`;

/** Resolves the slug a reader is on to the presentation the row hangs off. */
export const SELECT_PRESENTATION_ID_BY_SLUG = `
  SELECT presentation_id FROM presentation_publications
   WHERE slug = $slug
`;
