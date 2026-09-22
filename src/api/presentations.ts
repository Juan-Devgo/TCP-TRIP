/**
 * The presentations API: the teacher's editor, the admin's review queue, and
 * the public reads behind a published slug.
 *
 * Handlers are plain `Bun.serve` route functions — nothing wraps them, and an
 * uncaught throw is answered by the server's `error` callback (`onError` in
 * `src/api/http.ts`) with the same `{ error: { message } }` a `fail` produces.
 *
 * Three levels of access, and each one is a single guard at the top of the
 * handler:
 *
 * - **Teacher**, for everything that authors content. Authoring presentations
 *   is the teacher's job per `docs/users/roles.md`, so a student gets a 403
 *   even on their own (non-existent) drafts.
 * - **Admin**, for the queue and the decisions. These are the only routes in
 *   the app that read another user's unpublished work; the role is what guards
 *   them, and every decision is written to the review log with the admin's id.
 * - **Public**, for the Theory reads. A published presentation is educational
 *   content — no session required, and the response carries no author id, no
 *   presentation id and no reviewer.
 *
 * Messages here are English and for the developer; the client turns the status
 * into translated copy.
 */

import type { BunRequest } from "bun";

import { getDisplayName, optionalUserId, requireUserId } from "@/api/auth";
import { adminOnly, authorOnly, isRefusal } from "@/api/guards";
import { fail, ok } from "@/api/http";
import { PresentationsRepository } from "@/db/domains/presentations";
import {
  ALLOWED_ASSET_MIME_TYPES,
  isWithinPresentationLimit,
  MAX_ASSET_BYTES,
  MAX_PROGRESS_POSITION_LENGTH,
  MAX_REVIEW_NOTE_LENGTH,
  normalizeProgressPercent,
  parsePresentationDocument,
  PRESENTATION_STATUSES,
  PRESENTATION_TOPICS,
  type AssetMimeType,
  type PresentationDocument,
  type PresentationStatus,
  type PresentationTopic,
} from "@/lib/presentations/contract";

function repository(): PresentationsRepository {
  // Cheap: the connection is the process-wide singleton and `db.query` caches
  // the prepared statements on it.
  return new PresentationsRepository();
}

const NOT_FOUND = "Presentation not found";
const ASSET_NOT_FOUND = "Image not found";
const PROGRESS_UNAUTHENTICATED = "Sign in to save your reading progress";

/**
 * The document out of a request body, or the response that refuses it. The size
 * is checked on the raw text, before anything parses it.
 */
async function readDocument(
  req: Request,
): Promise<{ document: PresentationDocument } | { error: Response }> {
  const body = await req.text();
  if (!isWithinPresentationLimit(body)) {
    return { error: fail(413, "Presentation document too large") };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    return { error: fail(400, "Body is not valid JSON") };
  }

  const wrapper = payload as { document?: unknown } | null;
  const parsed = parsePresentationDocument(wrapper?.document);
  if (!parsed.ok) {
    return {
      error: fail(400, "Invalid presentation document", { issue: parsed.issue }),
    };
  }

  return { document: parsed.document };
}

/** The `note` of a decision, which a rejection may not go without. */
async function readNote(req: Request, required: boolean): Promise<string | Response> {
  const payload = (await req.json().catch(() => null)) as { note?: unknown } | null;
  const note = typeof payload?.note === "string" ? payload.note.trim() : "";

  if (required && note === "") {
    return fail(400, "A rejection needs a reason the author can act on");
  }
  if (note.length > MAX_REVIEW_NOTE_LENGTH) {
    return fail(400, "Review note too long");
  }

  return note;
}

/**
 * The image type as the **bytes** say it is, not as the upload claims.
 *
 * A client-declared `Content-Type` is a client-declared fact, and this file is
 * served back from the app's own origin: sniffing the signature is what keeps
 * an `image/png` upload from actually being an HTML document. SVG is not in the
 * allowed list at all — it can carry a `<script>`, which would make an upload
 * stored XSS on every student reading the published presentation.
 */
function sniffMime(bytes: Uint8Array): AssetMimeType | null {
  const starts = (...signature: number[]): boolean =>
    signature.every((byte, index) => bytes[index] === byte);

  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";

  // RIFF....WEBP and the ISO-BMFF box `ftypavif` — both carry their real
  // marker a few bytes in.
  const tag = (offset: number, text: string): boolean =>
    text.split("").every((char, index) => bytes[offset + index] === char.charCodeAt(0));

  if (tag(0, "RIFF") && tag(8, "WEBP")) return "image/webp";
  if (tag(4, "ftypavif") || tag(4, "ftypavis")) return "image/avif";

  return null;
}

function parseTopic(value: string | null): PresentationTopic | null {
  return value !== null && (PRESENTATION_TOPICS as readonly string[]).includes(value)
    ? (value as PresentationTopic)
    : null;
}

export const presentationRoutes = {
  /* ---------------------------------------------------------- the author's */

  "/api/presentations": {
    GET: async (req: BunRequest<"/api/presentations">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      return ok(repository().listForUser(caller.userId));
    },

    POST: async (req: BunRequest<"/api/presentations">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      const body = await readDocument(req);
      if ("error" in body) return body.error;

      const saved = repository().save(caller.userId, body.document);
      if (!saved) return fail(500, "Could not save the presentation");

      return ok(saved, { status: 201 });
    },
  },

  "/api/presentations/:id": {
    GET: async (req: BunRequest<"/api/presentations/:id">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      const saved = repository().findForUser(caller.userId, req.params.id);
      return saved ? ok(saved) : fail(404, NOT_FOUND);
    },

    PUT: async (req: BunRequest<"/api/presentations/:id">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      const body = await readDocument(req);
      if ("error" in body) return body.error;

      // `null` covers both "no such presentation" and "not yours".
      const saved = repository().save(caller.userId, body.document, req.params.id);
      return saved ? ok(saved) : fail(404, NOT_FOUND);
    },

    DELETE: async (req: BunRequest<"/api/presentations/:id">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      return repository().remove(caller.userId, req.params.id)
        ? ok({ deleted: true })
        : fail(404, NOT_FOUND);
    },
  },

  /**
   * Sends a draft to the review queue. A 409 rather than a 404 when the draft
   * exists but cannot be submitted (it is already pending), because the author
   * needs to be told the difference.
   */
  "/api/presentations/:id/submit": {
    POST: async (req: BunRequest<"/api/presentations/:id/submit">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      const presentations = repository();
      const submitted = presentations.submit(caller.userId, req.params.id);
      if (submitted) return ok(submitted);

      const existing = presentations.findForUser(caller.userId, req.params.id);
      return existing
        ? fail(409, "This presentation is already waiting for review")
        : fail(404, NOT_FOUND);
    },
  },

  /** Cancels a submission, or takes a published presentation off Theory. */
  "/api/presentations/:id/withdraw": {
    POST: async (req: BunRequest<"/api/presentations/:id/withdraw">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      const presentations = repository();
      const withdrawn = presentations.withdraw(caller.userId, req.params.id);
      if (withdrawn) return ok(withdrawn);

      const existing = presentations.findForUser(caller.userId, req.params.id);
      return existing
        ? fail(409, "Only a pending or published presentation can be withdrawn")
        : fail(404, NOT_FOUND);
    },
  },

  /** The review history — how the author reads why something was rejected. */
  "/api/presentations/:id/reviews": {
    GET: async (req: BunRequest<"/api/presentations/:id/reviews">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      const presentations = repository();
      if (!presentations.findForUser(caller.userId, req.params.id)) {
        return fail(404, NOT_FOUND);
      }

      return ok(presentations.reviews(req.params.id));
    },
  },

  /* ------------------------------------------------------------- the images */

  "/api/presentations/:id/assets": {
    GET: async (req: BunRequest<"/api/presentations/:id/assets">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      const assets = repository().listAssets(caller.userId, req.params.id);
      return assets ? ok(assets) : fail(404, NOT_FOUND);
    },

    /**
     * One image, as `multipart/form-data` under the field `file`. The size is
     * checked before the bytes are read, and the stored type is the sniffed
     * one — the upload's own `Content-Type` is never trusted.
     */
    POST: async (req: BunRequest<"/api/presentations/:id/assets">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      const form = await req.formData().catch(() => null);
      const file = form?.get("file");
      if (!(file instanceof File)) return fail(400, "Expected a `file` field");
      if (file.size === 0) return fail(400, "The image is empty");
      if (file.size > MAX_ASSET_BYTES) {
        return fail(413, "Image too large", { maxBytes: MAX_ASSET_BYTES });
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = sniffMime(bytes);
      if (!mime) {
        return fail(415, "Unsupported image format", {
          allowed: ALLOWED_ASSET_MIME_TYPES,
        });
      }

      const result = repository().addAsset(caller.userId, req.params.id, {
        // The name is a label in the editor, never a path: it is stored as
        // given and never used to open anything.
        filename: file.name.slice(0, 200),
        mime,
        bytes,
      });

      if (!result.ok) {
        return result.reason === "notFound"
          ? fail(404, NOT_FOUND)
          : fail(409, "This presentation already has the maximum number of images");
      }

      return ok(result.asset, { status: 201 });
    },
  },

  "/api/presentations/:id/assets/:assetId": {
    DELETE: async (req: BunRequest<"/api/presentations/:id/assets/:assetId">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      const result = repository().removeAsset(
        caller.userId,
        req.params.id,
        req.params.assetId,
      );

      if (result.ok) return ok({ deleted: true });

      return result.reason === "published"
        ? fail(
            409,
            "This image is used by the published version — withdraw it first",
          )
        : fail(404, ASSET_NOT_FOUND);
    },
  },

  /**
   * The bytes of an image. The authorisation is in the repository's query: the
   * owner always, everyone else only once a snapshot of that presentation is
   * published — which is what makes images load for a student who owns nothing
   * and for a signed-out reader following a link.
   */
  "/api/assets/presentations/:assetId": {
    GET: async (req: BunRequest<"/api/assets/presentations/:assetId">) => {
      const userId = await optionalUserId(req);
      const asset = repository().readAsset(req.params.assetId, userId);
      if (!asset) return fail(404, ASSET_NOT_FOUND);

      return new Response(asset.bytes as unknown as BodyInit, {
        headers: {
          "Content-Type": asset.mime,
          // The id is random and the bytes behind it never change, so this can
          // be cached hard. `private`: a draft's image must not sit in a shared
          // proxy cache.
          "Cache-Control": "private, max-age=31536000, immutable",
          // The type is the sniffed one; tell the browser not to guess another.
          "X-Content-Type-Options": "nosniff",
          "Content-Length": String(asset.byteSize),
        },
      });
    },
  },

  /* -------------------------------------------------------------- the admin */

  /**
   * The review queue. `?status=` narrows it — `pending` by default, which is
   * the queue proper; the other values are how an admin audits what was
   * already decided.
   */
  "/api/admin/presentations": {
    GET: async (req: BunRequest<"/api/admin/presentations">) => {
      const caller = await adminOnly(req);
      if (isRefusal(caller)) return caller;

      const requested = new URL(req.url).searchParams.get("status");
      if (requested !== null && !(PRESENTATION_STATUSES as readonly string[]).includes(requested)) {
        return fail(400, "Unknown status", { allowed: PRESENTATION_STATUSES });
      }

      const queue = repository().listForReview(
        (requested ?? "pending") as PresentationStatus,
      );

      // The author's name is resolved here and not stored on the draft: until
      // approval there is no snapshot, and the reviewer wants the current name.
      return ok(
        await Promise.all(
          queue.map(async ({ authorId, ...presentation }) => ({
            ...presentation,
            authorName: await getDisplayName(authorId),
          })),
        ),
      );
    },
  },

  "/api/admin/presentations/:id": {
    GET: async (req: BunRequest<"/api/admin/presentations/:id">) => {
      const caller = await adminOnly(req);
      if (isRefusal(caller)) return caller;

      const found = repository().findForReview(req.params.id);
      if (!found) return fail(404, NOT_FOUND);

      const { authorId, ...presentation } = found;
      return ok({ ...presentation, authorName: await getDisplayName(authorId) });
    },
  },

  /**
   * Approves the pending submission: the draft's document is frozen into the
   * publication, which is what Theory serves from then on. The byline is
   * resolved from Clerk here — never from the document, which the author
   * controls.
   */
  "/api/admin/presentations/:id/approve": {
    POST: async (req: BunRequest<"/api/admin/presentations/:id/approve">) => {
      const caller = await adminOnly(req);
      if (isRefusal(caller)) return caller;

      const note = await readNote(req, false);
      if (note instanceof Response) return note;

      const presentations = repository();
      const draft = presentations.findForReview(req.params.id);
      if (!draft) return fail(404, NOT_FOUND);
      if (draft.status !== "pending") {
        return fail(409, "This presentation is not waiting for review");
      }

      const published = presentations.approve(
        caller.userId,
        req.params.id,
        await getDisplayName(draft.authorId),
        note === "" ? null : note,
      );

      // Lost the race with another admin deciding the same submission.
      return published ? ok(published) : fail(409, "This presentation was just decided");
    },
  },

  /**
   * Refuses the pending submission. The note is required: a rejection the
   * author cannot act on is a dead end, and it is the only feedback channel
   * between the admin and the teacher.
   */
  "/api/admin/presentations/:id/reject": {
    POST: async (req: BunRequest<"/api/admin/presentations/:id/reject">) => {
      const caller = await adminOnly(req);
      if (isRefusal(caller)) return caller;

      const note = await readNote(req, true);
      if (note instanceof Response) return note;

      const rejected = repository().reject(caller.userId, req.params.id, note);
      if (rejected) {
        const { authorId, ...presentation } = rejected;
        return ok(presentation);
      }

      return repository().findForReview(req.params.id)
        ? fail(409, "This presentation is not waiting for review")
        : fail(404, NOT_FOUND);
    },
  },

  /* ------------------------------------------------------------ Theory, public */

  /**
   * The Theory index of approved presentations, optionally narrowed to one
   * topic. Public, and a listing only — no document is parsed here.
   */
  "/api/theory/presentations": {
    GET: (req: BunRequest<"/api/theory/presentations">) => {
      const requested = new URL(req.url).searchParams.get("topic");
      if (requested !== null && parseTopic(requested) === null) {
        return fail(400, "Unknown topic", { allowed: PRESENTATION_TOPICS });
      }

      const topic = parseTopic(requested);
      return ok(topic === null ? repository().listPublished() : repository().listPublished(topic));
    },
  },

  /** The approved snapshot behind a slug. Public: that is the point of it. */
  "/api/theory/presentations/:slug": {
    GET: (req: BunRequest<"/api/theory/presentations/:slug">) => {
      const published = repository().findPublishedBySlug(req.params.slug);
      return published ? ok(published) : fail(404, NOT_FOUND);
    },
  },

  /* --------------------------------------------------- reading progress */

  /**
   * How far the caller has read every presentation they have opened — one
   * request, so the Theory index can badge its whole listing without a call per
   * card.
   *
   * Progress is the one presentation resource **any signed-in reader** writes,
   * students included, so these two routes ask for a session and nothing more.
   * Signing in is required because the row is keyed on the reader: there is
   * nowhere to put a signed-out reader's percentage.
   */
  "/api/theory/progress": {
    GET: async (req: BunRequest<"/api/theory/progress">) => {
      const userId = await requireUserId(req);
      if (!userId) return fail(401, PROGRESS_UNAUTHENTICATED);

      return ok(repository().listProgress(userId));
    },
  },

  "/api/theory/presentations/:slug/progress": {
    GET: async (req: BunRequest<"/api/theory/presentations/:slug/progress">) => {
      const userId = await requireUserId(req);
      if (!userId) return fail(401, PROGRESS_UNAUTHENTICATED);

      const presentations = repository();
      const progress = presentations.findProgress(userId, req.params.slug);
      if (progress) return ok(progress);

      // A reader who has not started it is not an error. The zeroed answer
      // saves the client a "was it 404 because the slug is wrong?" branch —
      // except when the slug really is wrong, which the publication decides.
      return presentations.findPublishedBySlug(req.params.slug)
        ? ok({ slug: req.params.slug, percent: 0, position: null, updatedAt: null })
        : fail(404, NOT_FOUND);
    },

    /**
     * Records a percentage, whichever view measured it — the reading view and
     * presentation mode write to the same row on purpose, because they are two
     * renderings of the same content.
     *
     * The stored value is the furthest point reached, so a reply may come back
     * *higher* than what was just sent; the client takes the response as the
     * truth rather than its own number.
     */
    PUT: async (req: BunRequest<"/api/theory/presentations/:slug/progress">) => {
      const userId = await requireUserId(req);
      if (!userId) return fail(401, PROGRESS_UNAUTHENTICATED);

      const payload = (await req.json().catch(() => null)) as {
        percent?: unknown;
        position?: unknown;
      } | null;

      const percent = normalizeProgressPercent(payload?.percent);
      if (percent === null) return fail(400, "`percent` must be a number from 0 to 100");

      const rawPosition = payload?.position;
      if (
        rawPosition !== undefined &&
        rawPosition !== null &&
        (typeof rawPosition !== "string" || rawPosition.length > MAX_PROGRESS_POSITION_LENGTH)
      ) {
        return fail(400, "`position` must be a short string");
      }

      const saved = repository().saveProgress(
        userId,
        req.params.slug,
        percent,
        typeof rawPosition === "string" ? rawPosition : null,
      );

      return saved ? ok(saved) : fail(404, NOT_FOUND);
    },
  },
} as const;
