/**
 * The presentation tables as SQLite returns them, and as the rest of the
 * server reads them.
 */

import type {
  PresentationDocument,
  PresentationMode,
  PresentationStatus,
  PresentationTopic,
  ReviewAction,
} from "@/lib/presentations/contract";

/**
 * One `presentations` row, plus the two columns the `LEFT JOIN` on
 * `presentation_publications` adds — every read goes through that join, because
 * "is it live, and where?" is part of what a draft's owner needs to see.
 */
export type PresentationRow = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  mode: string;
  schema_version: number;
  document: string;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  /** From the join: NULL while nothing of this presentation is published. */
  published_slug: string | null;
  published_at: string | null;
};

/**
 * A draft as its owner (or a reviewing admin) sees it. `user_id` does not
 * survive the mapping: the caller had to prove who it was to get here, so
 * handing the id back would only invite trusting the copy over the session.
 */
export type SavedPresentation = {
  id: string;
  title: string;
  topic: PresentationTopic;
  mode: PresentationMode;
  document: PresentationDocument;
  status: PresentationStatus;
  /** ISO-8601 UTC, or `null` when that step has not happened. */
  submittedAt: string | null;
  reviewedAt: string | null;
  /** The reason behind the last decision — what a rejected author reads. */
  reviewNote: string | null;
  /** The live snapshot's slug, or `null` when nothing is published. */
  publishedSlug: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A draft in the admin queue: the same entity plus who wrote it. */
export type PresentationForReview = SavedPresentation & {
  /** The author's Clerk id — an admin needs it to resolve the display name. */
  authorId: string;
};

/** A row of `presentation_publications`. */
export type PublicationRow = {
  presentation_id: string;
  slug: string;
  topic: string;
  title: string;
  author_name: string;
  schema_version: number;
  document: string;
  approved_by: string;
  published_at: string;
};

/**
 * What Theory serves. No author id, no presentation id, no reviewer: a public
 * page says what was approved and who wrote it, and nothing about the
 * machinery behind it.
 */
export type PublishedPresentation = {
  slug: string;
  topic: PresentationTopic;
  title: string;
  authorName: string;
  document: PresentationDocument;
  publishedAt: string;
};

/** The listing form — the Theory index, with no document to parse. */
export type PublishedPresentationSummary = Omit<PublishedPresentation, "document"> & {
  slideCount: number;
};

export type ReviewRow = {
  id: string;
  presentation_id: string;
  actor_id: string;
  action: string;
  note: string | null;
  created_at: string;
};

/**
 * One entry of the review history. `actorId` is kept: the author needs to know
 * a decision was made by staff, and the admin panel shows who decided.
 */
export type PresentationReview = {
  id: string;
  actorId: string;
  action: ReviewAction;
  note: string | null;
  createdAt: string;
};

export type AssetRow = {
  id: string;
  presentation_id: string;
  user_id: string;
  filename: string;
  mime: string;
  byte_size: number;
  bytes: Uint8Array;
  created_at: string;
};

/** An asset's metadata — what the editor lists, without the bytes. */
export type PresentationAsset = {
  id: string;
  filename: string;
  mime: string;
  byteSize: number;
  createdAt: string;
};

/** An asset ready to be answered with: metadata plus the bytes. */
export type PresentationAssetContent = PresentationAsset & {
  bytes: Uint8Array;
};
