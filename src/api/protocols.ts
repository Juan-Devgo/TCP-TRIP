/**
 * The protocols API: what `src/services/protocols.ts` calls, and the public
 * read behind a share link.
 *
 * Handlers are plain `Bun.serve` route functions — one per method, receiving a
 * `BunRequest` whose `params` are already decoded and typed from the path
 * literal. Nothing wraps them: an uncaught throw is caught by the server's
 * `error` callback (`onError` in `src/api/http.ts`), which answers the same
 * `{ error: { message } }` a `fail` does.
 *
 * Every authenticated route resolves the caller with `requireUserId` and hands
 * that id to the repository, which puts it in the `WHERE` clause. A protocol id
 * belonging to somebody else therefore matches nothing and comes back as a 404
 * — the same answer as an id that never existed, so the API does not confirm
 * that another user's protocol is there.
 *
 * Messages here are English and for the developer; the client turns the status
 * into translated copy.
 */

import type { BunRequest } from "bun";

import { requireUserId } from "@/api/auth";
import { fail, ok } from "@/api/http";
import { ProtocolsRepository } from "@/db/domains/protocols";
import {
  isWithinDocumentLimit,
  parseProtocolDocument,
  type ProtocolDocumentShape,
} from "@/lib/protocols/contract";

function repository(): ProtocolsRepository {
  // Cheap: the connection is the process-wide singleton and `db.query` caches
  // the prepared statements on it.
  return new ProtocolsRepository();
}

const UNAUTHENTICATED = "Sign in to manage your protocols";
const NOT_FOUND = "Protocol not found";

/**
 * The document out of a request body, or the response that refuses it. The
 * size is checked on the raw text, before anything parses it.
 */
async function readDocument(
  req: Request,
): Promise<{ document: ProtocolDocumentShape } | { error: Response }> {
  const body = await req.text();
  if (!isWithinDocumentLimit(body)) {
    return { error: fail(413, "Protocol document too large") };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    return { error: fail(400, "Body is not valid JSON") };
  }

  const wrapper = payload as { document?: unknown } | null;
  const parsed = parseProtocolDocument(wrapper?.document);
  if (!parsed.ok) {
    return { error: fail(400, "Invalid protocol document", { issue: parsed.issue }) };
  }

  return { document: parsed.document };
}

export const protocolRoutes = {
  "/api/protocols": {
    GET: async (req: BunRequest<"/api/protocols">) => {
      const userId = await requireUserId(req);
      if (!userId) return fail(401, UNAUTHENTICATED);

      return ok(repository().listForUser(userId));
    },

    POST: async (req: BunRequest<"/api/protocols">) => {
      const userId = await requireUserId(req);
      if (!userId) return fail(401, UNAUTHENTICATED);

      const body = await readDocument(req);
      if ("error" in body) return body.error;

      const saved = repository().save(userId, body.document);
      if (!saved) return fail(500, "Could not save the protocol");

      return ok(saved, { status: 201 });
    },
  },

  "/api/protocols/:id": {
    GET: async (req: BunRequest<"/api/protocols/:id">) => {
      const userId = await requireUserId(req);
      if (!userId) return fail(401, UNAUTHENTICATED);

      const saved = repository().findForUser(userId, req.params.id);
      return saved ? ok(saved) : fail(404, NOT_FOUND);
    },

    PUT: async (req: BunRequest<"/api/protocols/:id">) => {
      const userId = await requireUserId(req);
      if (!userId) return fail(401, UNAUTHENTICATED);

      const body = await readDocument(req);
      if ("error" in body) return body.error;

      // `null` covers both "no such protocol" and "not yours".
      const saved = repository().save(userId, body.document, req.params.id);
      return saved ? ok(saved) : fail(404, NOT_FOUND);
    },

    DELETE: async (req: BunRequest<"/api/protocols/:id">) => {
      const userId = await requireUserId(req);
      if (!userId) return fail(401, UNAUTHENTICATED);

      return repository().remove(userId, req.params.id)
        ? ok({ deleted: true })
        : fail(404, NOT_FOUND);
    },
  },

  "/api/protocols/:id/share": {
    POST: async (req: BunRequest<"/api/protocols/:id/share">) => {
      const userId = await requireUserId(req);
      if (!userId) return fail(401, UNAUTHENTICATED);

      const shareId = repository().share(userId, req.params.id);
      return shareId ? ok({ shareId }) : fail(404, NOT_FOUND);
    },
  },

  /**
   * Public: a share link works signed out, which is the whole point of it.
   * It answers with the protocol only — never the owner's id, and never the
   * protocol's own id, which is what the owner's routes are keyed on.
   */
  "/api/shared/protocols/:shareId": {
    GET: async (req: BunRequest<"/api/shared/protocols/:shareId">) => {
      const shared = repository().findByShareId(req.params.shareId);
      if (!shared) return fail(404, NOT_FOUND);

      return ok({ name: shared.name, document: shared.document });
    },
  },
} as const;
