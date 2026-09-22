/**
 * Client for the protocols API — the contract the builder codes against.
 *
 * Every call goes to `src/api/protocols.ts` and reads the `ok`/`fail` envelope
 * from `src/api/http.ts`. Ownership is not decided here: the request carries a
 * Clerk session token and the server resolves the user from it, so this module
 * never sends, and never needs to know, a user id.
 *
 * These functions are the place a query cache (TanStack Query) would call into
 * when `Mis Protocolos` lands — the keys it will invalidate are `['protocols']`
 * and `['protocols', id]`.
 */

// Type-only, so the feature's barrel can point back here without a cycle.
import type { ProtocolDocument } from "@/features/protocol-builder";
import { SHARED_PROTOCOL_PREFIX } from "@/lib/protocols/contract";

/** The store is real now: a save survives a reload. */
export const PROTOCOLS_PERSISTED = true;

export type StoredProtocol = {
  id: string;
  document: ProtocolDocument;
  /** ISO timestamps, as the API returns them. */
  createdAt: string;
  updatedAt: string;
  /** Set once the protocol has been shared; `null` until then. */
  shareId: string | null;
};

/**
 * Thrown by every call below, carrying the HTTP status so the UI can tell the
 * cases apart — 401 asks the user to sign in, 404 means it is gone.
 */
export class ProtocolApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProtocolApiError";
  }

  /** The user is signed out (or the session expired mid-session). */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

/**
 * `ClerkProvider` mounts the instance on `window`, which is how a plain module
 * reaches the session. A same-origin session cookie would also authenticate the
 * request, but the header is deterministic and needs no handshake.
 */
async function authHeaders(): Promise<HeadersInit> {
  const token = await window.Clerk?.session?.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(await authHeaders()),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new ProtocolApiError(
      response.status,
      body?.error?.message ?? `Request failed with ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

/**
 * Creates or replaces a protocol. `id` is the one a previous save returned:
 * passing it updates in place, omitting it mints a new record.
 */
export async function saveProtocol(
  document: ProtocolDocument,
  id?: string,
): Promise<StoredProtocol> {
  return request<StoredProtocol>(id ? `/api/protocols/${id}` : "/api/protocols", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify({ document }),
  });
}

/** What `Mis Protocolos` lists, most recently touched first. */
export async function listProtocols(): Promise<StoredProtocol[]> {
  return request<StoredProtocol[]>("/api/protocols");
}

export async function getProtocol(id: string): Promise<StoredProtocol | null> {
  try {
    return await request<StoredProtocol>(`/api/protocols/${id}`);
  } catch (error) {
    // "Not there" and "not yours" are the same answer, and neither is a fault.
    if (error instanceof ProtocolApiError && error.status === 404) return null;
    throw error;
  }
}

export async function deleteProtocol(id: string): Promise<void> {
  await request(`/api/protocols/${id}`, { method: "DELETE" });
}

/**
 * Mints (or reuses) the read-only share id of a saved protocol. Sharing an
 * unsaved protocol is not a thing: there would be nothing behind the link.
 */
export async function shareProtocol(id: string): Promise<string> {
  const { shareId } = await request<{ shareId: string }>(
    `/api/protocols/${id}/share`,
    { method: "POST" },
  );
  return shareId;
}

/** What a share link points at — the page `src/app.tsx` routes to. */
export function protocolShareUrl(shareId: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${SHARED_PROTOCOL_PREFIX}${shareId}`;
}

/** The public read behind a share link. No session: that is the point of it. */
export async function getSharedProtocol(
  shareId: string,
): Promise<{ name: string; document: ProtocolDocument } | null> {
  const response = await fetch(`/api/shared/protocols/${shareId}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ProtocolApiError(response.status, `Request failed with ${response.status}`);
  }

  return (await response.json()) as { name: string; document: ProtocolDocument };
}
