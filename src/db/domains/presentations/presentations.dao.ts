/**
 * SQL for the five presentation tables. Binds parameters, returns rows, decides
 * nothing — the transitions, the snapshot and the role rules are the
 * repository's.
 *
 * One DAO covers `presentations`, `presentation_publications`,
 * `presentation_reviews`, `presentation_assets` and `presentation_progress`
 * rather than five: they are one aggregate (a publication, a review, an image
 * and a reader's progress are all meaningless without the draft they hang off,
 * and every write touches at least two of them in the same transaction), so
 * splitting them would only move the joins one layer up.
 */

import { BaseDao } from "@/db/core/dao";
import type { WriteResult } from "@/db/core/types";
import {
  COUNT_ASSETS,
  DECIDE_PRESENTATION,
  DELETE_ASSET,
  DELETE_PRESENTATION,
  DELETE_PUBLICATION,
  INSERT_ASSET,
  INSERT_PRESENTATION,
  INSERT_REVIEW,
  SELECT_ASSET_FOR_READ,
  SELECT_ASSETS,
  SELECT_PRESENTATION,
  SELECT_PRESENTATION_FOR_REVIEW,
  SELECT_PRESENTATION_ID_BY_SLUG,
  SELECT_SPEAKER_NOTES_FOR_AUTHOR,
  SELECT_PRESENTATIONS_BY_STATUS,
  SELECT_PRESENTATIONS_BY_USER,
  SELECT_PUBLICATION_BY_PRESENTATION,
  SELECT_PUBLICATION_BY_SLUG,
  SELECT_PROGRESS,
  SELECT_PROGRESS_BY_USER,
  SELECT_PUBLICATIONS,
  SELECT_PUBLICATIONS_BY_TOPIC,
  SELECT_REVIEWS,
  SELECT_SLUG_OWNER,
  SUBMIT_PRESENTATION,
  UPDATE_PRESENTATION,
  UPSERT_PROGRESS,
  UPSERT_PUBLICATION,
  UPSERT_SPEAKER_NOTES,
  WITHDRAW_PRESENTATION,
} from "@/db/domains/presentations/presentations.queries";
import type {
  AssetRow,
  PresentationRow,
  PublicationRow,
  ReviewRow,
} from "@/db/domains/presentations/presentations.types";

/** What a draft write needs, minus the timestamps the repository decides. */
export type PresentationWrite = {
  id: string;
  userId: string;
  title: string;
  topic: string;
  mode: string;
  schemaVersion: number;
  /** The document, already serialized. */
  document: string;
};

/** The listing projection of `presentation_publications`. */
export type PublicationSummaryRow = {
  slug: string;
  topic: string;
  title: string;
  author_name: string;
  published_at: string;
  slide_count: number | null;
};

/** Metadata of an asset — the same row without the `bytes` column. */
export type AssetMetaRow = Omit<AssetRow, "bytes">;

/** A progress row already joined to the slug its presentation is read by. */
export type ProgressRow = {
  slug: string;
  percent: number;
  position: string | null;
  updated_at: string;
};

export class PresentationsDao extends BaseDao<PresentationRow> {
  /* ------------------------------------------------------------- the draft */

  insert(values: PresentationWrite & { createdAt: string; updatedAt: string }): WriteResult {
    return this.write(INSERT_PRESENTATION, { ...values });
  }

  update(values: PresentationWrite & { updatedAt: string }): WriteResult {
    return this.write(UPDATE_PRESENTATION, { ...values });
  }

  findById(userId: string, id: string): PresentationRow | null {
    return this.one(SELECT_PRESENTATION, { userId, id });
  }

  listByUser(userId: string): PresentationRow[] {
    return this.all(SELECT_PRESENTATIONS_BY_USER, { userId });
  }

  deleteById(userId: string, id: string): WriteResult {
    return this.write(DELETE_PRESENTATION, { userId, id });
  }

  submit(userId: string, id: string, submittedAt: string): WriteResult {
    return this.write(SUBMIT_PRESENTATION, { userId, id, submittedAt });
  }

  withdraw(userId: string, id: string, updatedAt: string): WriteResult {
    return this.write(WITHDRAW_PRESENTATION, { userId, id, updatedAt });
  }

  /* ------------------------------------------------------------- moderation */

  /** No owner filter: the caller's role is what the route checked. */
  listByStatus(status: string): PresentationRow[] {
    return this.all(SELECT_PRESENTATIONS_BY_STATUS, { status });
  }

  /** Likewise — a reviewer reads any draft by id. */
  findForReview(id: string): PresentationRow | null {
    return this.one(SELECT_PRESENTATION_FOR_REVIEW, { id });
  }

  decide(
    id: string,
    status: string,
    note: string | null,
    reviewedAt: string,
  ): WriteResult {
    return this.write(DECIDE_PRESENTATION, { id, status, note, reviewedAt });
  }

  /* ------------------------------------------------------------ publication */

  upsertPublication(values: {
    presentationId: string;
    slug: string;
    topic: string;
    title: string;
    authorName: string;
    schemaVersion: number;
    document: string;
    approvedBy: string;
    publishedAt: string;
  }): WriteResult {
    return this.write(UPSERT_PUBLICATION, { ...values });
  }

  deletePublication(presentationId: string): WriteResult {
    return this.write(DELETE_PUBLICATION, { presentationId });
  }

  findPublicationByPresentation(presentationId: string): PublicationRow | null {
    return this.one(SELECT_PUBLICATION_BY_PRESENTATION, { presentationId });
  }

  findPublicationBySlug(slug: string): PublicationRow | null {
    return this.one(SELECT_PUBLICATION_BY_SLUG, { slug });
  }

  /** `null` when the slug is free — what the mint loop checks. */
  findSlugOwner(slug: string): { presentation_id: string } | null {
    return this.one(SELECT_SLUG_OWNER, { slug });
  }

  listPublications(topic?: string): PublicationSummaryRow[] {
    return topic === undefined
      ? this.all<PublicationSummaryRow>(SELECT_PUBLICATIONS)
      : this.all<PublicationSummaryRow>(SELECT_PUBLICATIONS_BY_TOPIC, { topic });
  }

  /* ------------------------------------------------------------- review log */

  insertReview(values: {
    id: string;
    presentationId: string;
    actorId: string;
    action: string;
    note: string | null;
    createdAt: string;
  }): WriteResult {
    return this.write(INSERT_REVIEW, { ...values });
  }

  listReviews(presentationId: string): ReviewRow[] {
    return this.all<ReviewRow>(SELECT_REVIEWS, { presentationId });
  }

  /* ---------------------------------------------------------------- assets */

  insertAsset(values: {
    id: string;
    presentationId: string;
    userId: string;
    filename: string;
    mime: string;
    byteSize: number;
    bytes: Uint8Array;
    createdAt: string;
  }): WriteResult {
    return this.write(INSERT_ASSET, { ...values });
  }

  countAssets(presentationId: string): number {
    return this.one<{ count: number }>(COUNT_ASSETS, { presentationId })?.count ?? 0;
  }

  listAssets(presentationId: string): AssetMetaRow[] {
    return this.all<AssetMetaRow>(SELECT_ASSETS, { presentationId });
  }

  /**
   * The authorised read: the row comes back when the caller owns it or when a
   * snapshot of its presentation is published. A signed-out reader passes the
   * empty string, which matches no Clerk id.
   */
  findAssetForRead(id: string, userId: string): AssetRow | null {
    return this.one<AssetRow>(SELECT_ASSET_FOR_READ, { id, userId });
  }

  deleteAsset(userId: string, presentationId: string, id: string): WriteResult {
    return this.write(DELETE_ASSET, { userId, presentationId, id });
  }

  /* -------------------------------------------------------------- progress */

  upsertProgress(values: {
    presentationId: string;
    userId: string;
    percent: number;
    position: string | null;
    updatedAt: string;
  }): WriteResult {
    return this.write(UPSERT_PROGRESS, { ...values });
  }

  findProgress(userId: string, presentationId: string): ProgressRow | null {
    return this.one<ProgressRow>(SELECT_PROGRESS, { userId, presentationId });
  }

  listProgressByUser(userId: string): ProgressRow[] {
    return this.all<ProgressRow>(SELECT_PROGRESS_BY_USER, { userId });
  }

  /** `null` when the slug is not published (any more). */
  findPresentationIdBySlug(slug: string): string | null {
    return (
      this.one<{ presentation_id: string }>(SELECT_PRESENTATION_ID_BY_SLUG, { slug })
        ?.presentation_id ?? null
    );
  }

  upsertSpeakerNotes(presentationId: string, notes: string): WriteResult {
    return this.write(UPSERT_SPEAKER_NOTES, { presentationId, notes });
  }

  /** `null` when the slug is unknown **or** the caller is not its author. */
  findSpeakerNotesForAuthor(userId: string, slug: string): string | null {
    return (
      this.one<{ notes: string }>(SELECT_SPEAKER_NOTES_FOR_AUTHOR, { userId, slug })?.notes ??
      null
    );
  }
}
