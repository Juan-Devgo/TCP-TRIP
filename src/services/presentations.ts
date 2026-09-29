/**
 * Client for the presentations API — what the editor, the Theory section and
 * the admin review panel code against.
 *
 * Every call goes to `src/api/presentations.ts` and reads the `ok`/`fail`
 * envelope from `src/api/http.ts`. Ownership and role are not decided here: the
 * request carries a Clerk session token and the server resolves both from it,
 * so this module never sends, and never needs to know, a user id or a role.
 *
 * These are the functions a query cache (TanStack Query) calls into. The keys
 * it will invalidate: `['presentations']` and `['presentations', id]` for the
 * editor, `['theory', 'presentations']` for the listing, `['reviewQueue']` for
 * the admin panel, and `['progress']` for the badges.
 */

import type {
  PresentationAsset,
  PresentationReview,
  PublishedPresentation,
  PublishedPresentationSummary,
  SavedPresentation,
} from "@/db/domains/presentations";
import { ApiError, request } from "@/services/client";
import {
  presentationAssetUrl,
  publishedPresentationPath,
  type PresentationDocument,
  type PresentationStatus,
  type PresentationTopic,
  type ReadingProgress,
  type SpeakerNotes,
} from "@/lib/presentations/contract";
import type { TheoryPlacement } from "@/lib/theory/contract";

/** Re-exported so a component imports one module, not two. */
export type {
  PresentationAsset,
  PresentationReview,
  PublishedPresentation,
  PublishedPresentationSummary,
  SavedPresentation,
};
export { presentationAssetUrl, publishedPresentationPath };

/**
 * The error every call below throws. It is the shared `ApiError`, exported
 * under this name because that is what the presentation components already
 * catch — `instanceof` keeps working because it is the same class.
 */
export { ApiError as PresentationApiError };

/** A queued draft as the admin panel reads it: the entity plus its author. */
export type PresentationInReview = Omit<SavedPresentation, never> & {
  authorName: string;
};

/* ------------------------------------------------------------- the author's */

/**
 * Creates or replaces a draft. `id` is the one a previous save returned:
 * passing it updates in place, omitting it mints a new record.
 *
 * A save never changes the review status — submitting is a separate call, so an
 * autosave cannot pull a presentation out of the queue.
 */
export async function savePresentation(
  document: PresentationDocument,
  id?: string,
): Promise<SavedPresentation> {
  return request<SavedPresentation>(
    id ? `/api/presentations/${id}` : "/api/presentations",
    { method: id ? "PUT" : "POST", body: JSON.stringify({ document }) },
  );
}

/** What `Mis Presentaciones` lists, most recently touched first. */
export async function listPresentations(): Promise<SavedPresentation[]> {
  return request<SavedPresentation[]>("/api/presentations");
}

export async function getPresentation(id: string): Promise<SavedPresentation | null> {
  try {
    return await request<SavedPresentation>(`/api/presentations/${id}`);
  } catch (error) {
    // "Not there" and "not yours" are the same answer, and neither is a fault.
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

export async function deletePresentation(id: string): Promise<void> {
  await request(`/api/presentations/${id}`, { method: "DELETE" });
}

/** Sends the draft to the admin queue. */
export async function submitPresentation(id: string): Promise<SavedPresentation> {
  return request<SavedPresentation>(`/api/presentations/${id}/submit`, { method: "POST" });
}

/** Cancels a submission, or takes a published presentation off Theory. */
export async function withdrawPresentation(id: string): Promise<SavedPresentation> {
  return request<SavedPresentation>(`/api/presentations/${id}/withdraw`, { method: "POST" });
}

/** The decision history — how the author reads why something was rejected. */
export async function listReviews(id: string): Promise<PresentationReview[]> {
  return request<PresentationReview[]>(`/api/presentations/${id}/reviews`);
}

/* ------------------------------------------------------------------ images */

export async function listAssets(id: string): Promise<PresentationAsset[]> {
  return request<PresentationAsset[]>(`/api/presentations/${id}/assets`);
}

/**
 * Uploads one image and returns its stored metadata. The type is decided by the
 * server from the bytes, so the `File`'s own `type` is a hint and nothing more.
 */
export async function uploadAsset(id: string, file: File): Promise<PresentationAsset> {
  const body = new FormData();
  body.set("file", file);

  return request<PresentationAsset>(`/api/presentations/${id}/assets`, {
    method: "POST",
    body,
  });
}

export async function deleteAsset(id: string, assetId: string): Promise<void> {
  await request(`/api/presentations/${id}/assets/${assetId}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------- admin */

/** The review queue. `pending` by default; other statuses audit past work. */
export async function listReviewQueue(
  status: PresentationStatus = "pending",
): Promise<PresentationInReview[]> {
  return request<PresentationInReview[]>(`/api/admin/presentations?status=${status}`);
}

/** Any draft, for a reviewer to read before deciding. */
export async function getPresentationForReview(
  id: string,
): Promise<PresentationInReview | null> {
  try {
    return await request<PresentationInReview>(`/api/admin/presentations/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

/**
 * Approves the submission: the reviewed document is frozen into Theory. A
 * presentation with no place in the Theory menu yet needs a `placement` — the
 * server refuses the approval without one, so nothing is published unfindable.
 */
export async function approvePresentation(
  id: string,
  note?: string,
  placement?: TheoryPlacement,
): Promise<PublishedPresentation> {
  return request<PublishedPresentation>(`/api/admin/presentations/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ note: note ?? "", ...(placement ? { placement } : {}) }),
  });
}

/** Refuses it. The note is required — it is the author's only feedback. */
export async function rejectPresentation(
  id: string,
  note: string,
): Promise<SavedPresentation> {
  return request<SavedPresentation>(`/api/admin/presentations/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

/* ------------------------------------------------------------------ Theory */

/** The index of approved presentations. Public — no session needed. */
export async function listPublishedPresentations(
  topic?: PresentationTopic,
): Promise<PublishedPresentationSummary[]> {
  const query = topic ? `?topic=${topic}` : "";
  const response = await fetch(`/api/theory/presentations${query}`);
  if (!response.ok) {
    throw new ApiError(response.status, `Request failed with ${response.status}`);
  }

  return (await response.json()) as PublishedPresentationSummary[];
}

/** The approved snapshot behind a slug. Public: that is the point of it. */
export async function getPublishedPresentation(
  slug: string,
): Promise<PublishedPresentation | null> {
  const response = await fetch(`/api/theory/presentations/${slug}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ApiError(response.status, `Request failed with ${response.status}`);
  }

  return (await response.json()) as PublishedPresentation;
}

/**
 * The speaker notes of a published deck, or `null` unless the caller is its
 * author. Signed out, not a teacher, or somebody else's deck all mean the same
 * thing to the player — no notes — so none of them is an error here.
 */
export async function getSpeakerNotes(slug: string): Promise<SpeakerNotes | null> {
  try {
    return await request<SpeakerNotes>(`/api/theory/presentations/${slug}/notes`);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.isNotFound || error.isForbidden || error.isUnauthenticated)
    ) {
      return null;
    }
    throw error;
  }
}

/* --------------------------------------------------------- reading progress */

/** What a reader has started, in one request — enough to badge the listing. */
export async function listProgress(): Promise<ReadingProgress[]> {
  return request<ReadingProgress[]>("/api/theory/progress");
}

/** Where this reader left off, zeroed when they have not started it. */
export async function getProgress(slug: string): Promise<ReadingProgress> {
  return request<ReadingProgress>(`/api/theory/presentations/${slug}/progress`);
}

/**
 * Records a percentage, whichever view measured it.
 *
 * The answer may be **higher** than what was sent, because the server keeps the
 * furthest point reached — so the caller takes the response as the truth rather
 * than its own number.
 */
export async function saveProgress(
  slug: string,
  percent: number,
  position?: string,
): Promise<ReadingProgress> {
  return request<ReadingProgress>(`/api/theory/presentations/${slug}/progress`, {
    method: "PUT",
    body: JSON.stringify({ percent, ...(position === undefined ? {} : { position }) }),
  });
}

export type { PresentationDocument, ReadingProgress };
