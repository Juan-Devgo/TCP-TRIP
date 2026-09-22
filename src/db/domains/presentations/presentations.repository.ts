/**
 * The presentations domain as the API talks to it, and the place the review
 * lifecycle actually lives.
 *
 * Two rules shape everything here:
 *
 * 1. **`userId` is a parameter of every owner method** because the only place
 *    it may come from is the verified session — never a payload. The two admin
 *    methods take an `adminId` instead and are the only ones that read across
 *    users; the *route* proves the role, the repository records who decided.
 * 2. **Approving copies the document.** Theory reads
 *    `presentation_publications`, never the draft, so an author who keeps
 *    editing after approval changes nothing students see until a new submission
 *    is approved. Every state change and its snapshot happen in one
 *    transaction.
 * 3. **A publication carries no notes.** Both kinds — the author's notes on
 *    the deck and a slide's speaker notes — are stripped on the way into
 *    `presentation_publications` and again on the way out, because a published
 *    document is JSON a student can read in the network tab. Hiding them in
 *    the UI would not be hiding them.
 */

import type { Database } from "bun:sqlite";

import { getDb } from "@/db/client";
import { BaseRepository } from "@/db/core/repository";
import { PresentationsDao } from "@/db/domains/presentations/presentations.dao";
import type {
  AssetMetaRow,
  ProgressRow,
  PublicationSummaryRow,
} from "@/db/domains/presentations/presentations.dao";
import type {
  AssetRow,
  PresentationAsset,
  PresentationAssetContent,
  PresentationForReview,
  PresentationReview,
  PresentationRow,
  PublicationRow,
  PublishedPresentation,
  PublishedPresentationSummary,
  ReviewRow,
  SavedPresentation,
} from "@/db/domains/presentations/presentations.types";
import {
  MAX_ASSETS_PER_PRESENTATION,
  MAX_PROGRESS_POSITION_LENGTH,
  SLUG_SUFFIX_LENGTH,
  slugifyTitle,
  withoutPrivateNotes,
  type PresentationDocument,
  type PresentationMode,
  type PresentationStatus,
  type PresentationTopic,
  type ReadingProgress,
  type ReviewAction,
} from "@/lib/presentations/contract";

/** Slug suffixes are random; a collision is retried, never handed to a user. */
const SLUG_ATTEMPTS = 5;

/** Why an upload or a delete was refused, for the route to turn into a status. */
export type AssetRefusal = "notFound" | "tooMany" | "published";

export type AddAssetResult =
  | { ok: true; asset: PresentationAsset }
  | { ok: false; reason: Extract<AssetRefusal, "notFound" | "tooMany"> };

export type RemoveAssetResult =
  | { ok: true }
  | { ok: false; reason: Extract<AssetRefusal, "notFound" | "published"> };

export class PresentationsRepository extends BaseRepository<
  PresentationRow,
  SavedPresentation
> {
  private readonly dao: PresentationsDao;

  /** The DAO shares the repository's connection, so a transaction covers both. */
  constructor(db: Database = getDb()) {
    super(db);
    this.dao = new PresentationsDao(db);
  }

  protected toEntity(row: PresentationRow): SavedPresentation {
    return {
      id: row.id,
      title: row.title,
      topic: row.topic as PresentationTopic,
      mode: row.mode as PresentationMode,
      // The single place the stored JSON becomes an object again.
      document: JSON.parse(row.document) as PresentationDocument,
      status: row.status as PresentationStatus,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      publishedSlug: row.published_slug,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /* ------------------------------------------------------- the author's side */

  /**
   * Creates or replaces a draft. With an `id` it updates in place; without one
   * it mints a new record in `draft`.
   *
   * `null` means the update matched nothing — the id is unknown *or* belongs to
   * somebody else. The two are not told apart on purpose: an owner-scoped 404
   * answers both, and distinguishing them would confirm that a presentation
   * with that id exists.
   *
   * Saving never changes `status`. An autosave must not pull a submission out
   * of the queue, and it must not mark a rejected draft as fixed either.
   */
  save(
    userId: string,
    document: PresentationDocument,
    id?: string,
  ): SavedPresentation | null {
    const write = this.transaction((): SavedPresentation | null => {
      const now = new Date().toISOString();
      const values = {
        userId,
        title: document.title,
        topic: document.topic,
        mode: document.mode,
        schemaVersion: document.version,
        document: JSON.stringify(document),
      };

      if (id !== undefined) {
        const { changes } = this.dao.update({ ...values, id, updatedAt: now });
        if (changes === 0) return null;
        return this.toEntityOrNull(this.dao.findById(userId, id));
      }

      const newId = crypto.randomUUID();
      this.dao.insert({ ...values, id: newId, createdAt: now, updatedAt: now });
      return this.toEntityOrNull(this.dao.findById(userId, newId));
    });

    return write();
  }

  /** What `Mis Presentaciones` lists: the author's drafts, most recent first. */
  listForUser(userId: string): SavedPresentation[] {
    return this.toEntities(this.dao.listByUser(userId));
  }

  findForUser(userId: string, id: string): SavedPresentation | null {
    return this.toEntityOrNull(this.dao.findById(userId, id));
  }

  /**
   * `false` when there was nothing of theirs to delete. The publication row and
   * the assets go with it — `ON DELETE CASCADE`, which is what "the author
   * deleted it" has to mean for something that was on Theory.
   */
  remove(userId: string, id: string): boolean {
    return this.dao.deleteById(userId, id).changes > 0;
  }

  /**
   * Sends a draft to the review queue and logs the submission. `null` when the
   * presentation is not the caller's, or when its state does not allow a
   * submission (already pending) — the route answers 404 and 409 respectively,
   * which it tells apart by reading the draft back.
   */
  submit(userId: string, id: string): SavedPresentation | null {
    const write = this.transaction((): SavedPresentation | null => {
      const now = new Date().toISOString();
      if (this.dao.submit(userId, id, now).changes === 0) return null;

      this.log(id, userId, "submit", null, now);
      return this.toEntityOrNull(this.dao.findById(userId, id));
    });

    return write();
  }

  /**
   * Cancels a submission, or takes a published presentation down. Both are the
   * same act from the author's side, so both land the draft back on `draft` and
   * drop the snapshot — a presentation the author withdrew must stop being
   * readable in Theory immediately.
   */
  withdraw(userId: string, id: string): SavedPresentation | null {
    const write = this.transaction((): SavedPresentation | null => {
      const now = new Date().toISOString();
      if (this.dao.withdraw(userId, id, now).changes === 0) return null;

      this.dao.deletePublication(id);
      this.log(id, userId, "withdraw", null, now);
      return this.toEntityOrNull(this.dao.findById(userId, id));
    });

    return write();
  }

  /** The history behind a presentation, newest first. */
  reviews(presentationId: string): PresentationReview[] {
    return this.dao.listReviews(presentationId).map((row) => this.toReview(row));
  }

  /* -------------------------------------------------------- the admin's side */

  /**
   * The review queue, oldest submission first. Owner-blind by design — this is
   * moderation, and the route has already proved the caller is an admin.
   */
  listForReview(status: PresentationStatus = "pending"): PresentationForReview[] {
    return this.dao
      .listByStatus(status)
      .map((row) => ({ ...this.toEntity(row), authorId: row.user_id }));
  }

  /** Any draft, by id, for a reviewer to read before deciding. */
  findForReview(id: string): PresentationForReview | null {
    const row = this.dao.findForReview(id);
    if (!row) return null;

    return { ...this.toEntity(row), authorId: row.user_id };
  }

  /**
   * Approves a pending submission: freezes the draft's document into
   * `presentation_publications` and marks the draft `published`.
   *
   * `authorName` comes from the route (Clerk, server-side) rather than from the
   * document, because it is the byline students will see. `null` here means the
   * presentation is unknown or no longer pending — a second approval of the
   * same submission is a no-op, so two admins deciding at once cannot publish
   * it twice.
   */
  approve(
    adminId: string,
    id: string,
    authorName: string,
    note: string | null = null,
  ): PublishedPresentation | null {
    const write = this.transaction((): PublishedPresentation | null => {
      const draft = this.dao.findForReview(id);
      if (!draft || draft.status !== "pending") return null;

      const now = new Date().toISOString();
      if (this.dao.decide(id, "published", note, now).changes === 0) return null;

      // An existing publication keeps its slug: a link already handed to a
      // class has to go on working across re-approvals.
      const slug = draft.published_slug ?? this.mintSlug(draft.title);

      this.dao.upsertPublication({
        presentationId: id,
        slug,
        topic: draft.topic,
        title: draft.title,
        authorName,
        schemaVersion: draft.schema_version,
        document: publishable(draft.document),
        approvedBy: adminId,
        publishedAt: now,
      });

      this.log(id, adminId, "approve", note, now);

      const publication = this.dao.findPublicationByPresentation(id);
      return publication === null ? null : this.toPublished(publication);
    });

    return write();
  }

  /**
   * Refuses a pending submission. The note is required by the route, not by the
   * table: an author who cannot read why it was rejected has nothing to fix.
   * Any previous snapshot stays live — a rejected *new* version does not take
   * down the version that was already approved.
   */
  reject(adminId: string, id: string, note: string): PresentationForReview | null {
    const write = this.transaction((): PresentationForReview | null => {
      const now = new Date().toISOString();
      if (this.dao.decide(id, "rejected", note, now).changes === 0) return null;

      this.log(id, adminId, "reject", note, now);
      return this.findForReview(id);
    });

    return write();
  }

  /* ------------------------------------------------------------ Theory reads */

  /** The Theory index, optionally narrowed to one topic. Public. */
  listPublished(topic?: PresentationTopic): PublishedPresentationSummary[] {
    return this.dao.listPublications(topic).map((row) => this.toSummary(row));
  }

  /** The published snapshot behind a slug. Public: that is the point of it. */
  findPublishedBySlug(slug: string): PublishedPresentation | null {
    const row = this.dao.findPublicationBySlug(slug);
    return row === null ? null : this.toPublished(row);
  }

  /* ----------------------------------------------------------------- assets */

  /**
   * Stores an uploaded image against a draft the caller owns. The per-deck cap
   * is enforced in the same transaction as the insert, so two parallel uploads
   * cannot both see room for the last one.
   */
  addAsset(
    userId: string,
    presentationId: string,
    file: { filename: string; mime: string; bytes: Uint8Array },
  ): AddAssetResult {
    const write = this.transaction((): AddAssetResult => {
      if (!this.dao.findById(userId, presentationId)) {
        return { ok: false, reason: "notFound" };
      }
      if (this.dao.countAssets(presentationId) >= MAX_ASSETS_PER_PRESENTATION) {
        return { ok: false, reason: "tooMany" };
      }

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      this.dao.insertAsset({
        id,
        presentationId,
        userId,
        filename: file.filename,
        mime: file.mime,
        byteSize: file.bytes.byteLength,
        bytes: file.bytes,
        createdAt,
      });

      return {
        ok: true,
        asset: {
          id,
          filename: file.filename,
          mime: file.mime,
          byteSize: file.bytes.byteLength,
          createdAt,
        },
      };
    });

    return write();
  }

  /** The editor's asset panel. `null` when the presentation is not theirs. */
  listAssets(userId: string, presentationId: string): PresentationAsset[] | null {
    if (!this.dao.findById(userId, presentationId)) return null;

    return this.dao.listAssets(presentationId).map((row) => this.toAsset(row));
  }

  /**
   * The bytes behind an image, with the authorisation in the query: the owner
   * always, anyone else only once a snapshot of that presentation is published.
   * A signed-out reader passes the empty string, which matches no Clerk id.
   */
  readAsset(id: string, userId: string = ""): PresentationAssetContent | null {
    const row = this.dao.findAssetForRead(id, userId);
    if (!row) return null;

    return { ...this.toAsset(row), bytes: row.bytes };
  }

  /**
   * Deletes an image the caller owns — unless the published snapshot still
   * references it, in which case the delete is refused rather than allowed to
   * punch a hole in a page students are reading. Withdrawing the presentation
   * (or approving a version that no longer uses the image) frees it.
   */
  removeAsset(
    userId: string,
    presentationId: string,
    id: string,
  ): RemoveAssetResult {
    const write = this.transaction((): RemoveAssetResult => {
      const publication = this.dao.findPublicationByPresentation(presentationId);
      if (publication && publication.document.includes(id)) {
        return { ok: false, reason: "published" };
      }

      return this.dao.deleteAsset(userId, presentationId, id).changes > 0
        ? { ok: true }
        : { ok: false, reason: "notFound" };
    });

    return write();
  }

  /* --------------------------------------------------------------- progress */

  /**
   * Records how far a reader got through the presentation behind a slug, and
   * hands back the stored progress — which may be *higher* than what was just
   * sent, because the column keeps the furthest point reached.
   *
   * `null` means the slug is not published (any more): there is nothing to
   * track progress against, and the route answers 404.
   *
   * Any signed-in reader may write here, students included — this is the one
   * presentation table that is not the author's. The row is keyed on the
   * caller's id, so a reader can only ever move their own progress.
   */
  saveProgress(
    userId: string,
    slug: string,
    percent: number,
    position: string | null,
  ): ReadingProgress | null {
    const write = this.transaction((): ReadingProgress | null => {
      const presentationId = this.dao.findPresentationIdBySlug(slug);
      if (presentationId === null) return null;

      this.dao.upsertProgress({
        presentationId,
        userId,
        percent,
        // Opaque to the server, so the only thing it enforces is a length.
        position: position === null ? null : position.slice(0, MAX_PROGRESS_POSITION_LENGTH),
        updatedAt: new Date().toISOString(),
      });

      const saved = this.dao.findProgress(userId, presentationId);
      return saved === null ? null : this.toProgress(saved);
    });

    return write();
  }

  /**
   * A reader's progress on one presentation, or `null` when they have not
   * started it (or the slug is not published). "Not started" is not an error —
   * the route answers a zeroed progress and the UI shows no badge.
   */
  findProgress(userId: string, slug: string): ReadingProgress | null {
    const presentationId = this.dao.findPresentationIdBySlug(slug);
    if (presentationId === null) return null;

    const row = this.dao.findProgress(userId, presentationId);
    return row === null ? null : this.toProgress(row);
  }

  /** Everything one reader has started — one request badges the whole index. */
  listProgress(userId: string): ReadingProgress[] {
    return this.dao.listProgressByUser(userId).map((row) => this.toProgress(row));
  }

  /* ---------------------------------------------------------------- mapping */

  private toProgress(row: ProgressRow): ReadingProgress {
    return {
      slug: row.slug,
      percent: row.percent,
      position: row.position,
      updatedAt: row.updated_at,
    };
  }

  private toReview(row: ReviewRow): PresentationReview {
    return {
      id: row.id,
      actorId: row.actor_id,
      action: row.action as ReviewAction,
      note: row.note,
      createdAt: row.created_at,
    };
  }

  private toPublished(row: PublicationRow): PublishedPresentation {
    return {
      slug: row.slug,
      topic: row.topic as PresentationTopic,
      title: row.title,
      authorName: row.author_name,
      // Stripped again on the read: rows written before publications were
      // stripped at the write still hold the author's notes.
      document: withoutPrivateNotes(JSON.parse(row.document) as PresentationDocument),
      publishedAt: row.published_at,
    };
  }

  private toSummary(row: PublicationSummaryRow): PublishedPresentationSummary {
    return {
      slug: row.slug,
      topic: row.topic as PresentationTopic,
      title: row.title,
      authorName: row.author_name,
      // `json_array_length` is NULL if `slides` ever went missing; 0 reads the
      // same to the UI and needs no branch there.
      slideCount: row.slide_count ?? 0,
      publishedAt: row.published_at,
    };
  }

  private toAsset(row: AssetMetaRow | AssetRow): PresentationAsset {
    return {
      id: row.id,
      filename: row.filename,
      mime: row.mime,
      byteSize: row.byte_size,
      createdAt: row.created_at,
    };
  }

  /** Append-only: a review row is never updated, only added. */
  private log(
    presentationId: string,
    actorId: string,
    action: ReviewAction,
    note: string | null,
    createdAt: string,
  ): void {
    this.dao.insertReview({
      id: crypto.randomUUID(),
      presentationId,
      actorId,
      action,
      note,
      createdAt,
    });
  }

  /**
   * A readable slug plus a random suffix, so two presentations called
   * `Capa de transporte` both get a working link. The uniqueness is checked
   * inside the approval transaction; the `UNIQUE` index is the backstop.
   */
  private mintSlug(title: string): string {
    const base = slugifyTitle(title);

    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, SLUG_SUFFIX_LENGTH);
      const slug = `${base}-${suffix}`;
      if (!this.dao.findSlugOwner(slug)) return slug;
    }

    throw new Error("Could not mint a unique presentation slug");
  }
}

/**
 * The document to freeze into a publication: the draft's own JSON, minus the
 * notes. A document this process wrote and cannot parse is a bug worth failing
 * the approval over — publishing the notes instead is not the safer answer.
 */
function publishable(document: string): string {
  return JSON.stringify(withoutPrivateNotes(JSON.parse(document) as PresentationDocument));
}
