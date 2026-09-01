/**
 * Client for the protocols API — the contract the builder codes against.
 *
 * **The API does not exist yet.** Persistence lands with a `bun:sqlite` module
 * under `src/api/` mounted in `src/api/routes.ts`, with ownership scoped to the
 * Clerk user id verified server-side. Until then every call here resolves
 * against a module-level map that dies with the page, so a save survives a tab
 * switch but not a reload — `PROTOCOLS_PERSISTED` says so, and the UI must
 * tell the user rather than pretend otherwise.
 *
 * Wiring the real endpoints is a change inside this file: swap each body for a
 * `fetch` against `/api/protocols` reading the `ok`/`fail` envelope from
 * `src/api/http.ts`, and flip the flag. When that happens these functions
 * become the place a query cache (TanStack Query) calls into — the cache keys
 * (`['protocols']`, `['protocols', id]`) are what the message composer will
 * invalidate against.
 */

// Type-only, so the feature's barrel can point back here without a cycle.
import type { ProtocolDocument } from "@/features/protocol-builder";

/** `false` while the store below is in memory. Read it before promising a user anything. */
export const PROTOCOLS_PERSISTED = false;

export type StoredProtocol = {
  id: string;
  document: ProtocolDocument;
  /** ISO timestamps, as the API will return them. */
  createdAt: string;
  updatedAt: string;
  /** Set once the protocol has been shared; `null` until then. */
  shareId: string | null;
};

/** Stands in for the `protocols` table. */
const store = new Map<string, StoredProtocol>();

function now(): string {
  return new Date().toISOString();
}

/**
 * Creates or replaces a protocol. `id` is the one a previous save returned:
 * passing it updates in place, omitting it mints a new record.
 */
export async function saveProtocol(
  document: ProtocolDocument,
  id?: string,
): Promise<StoredProtocol> {
  const existing = id ? store.get(id) : undefined;
  const saved: StoredProtocol = {
    id: existing?.id ?? crypto.randomUUID(),
    document,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
    shareId: existing?.shareId ?? null,
  };
  store.set(saved.id, saved);
  return saved;
}

/** What `Mis Protocolos` lists, most recently touched first. */
export async function listProtocols(): Promise<StoredProtocol[]> {
  return [...store.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProtocol(id: string): Promise<StoredProtocol | null> {
  return store.get(id) ?? null;
}

export async function deleteProtocol(id: string): Promise<void> {
  store.delete(id);
}

/**
 * Mints (or reuses) the read-only share id of a saved protocol. Sharing an
 * unsaved protocol is not a thing: there would be nothing behind the link.
 */
export async function shareProtocol(id: string): Promise<string> {
  const saved = store.get(id);
  if (!saved) throw new Error(`Unknown protocol: ${id}`);

  const shareId = saved.shareId ?? crypto.randomUUID().slice(0, 8);
  store.set(id, { ...saved, shareId, updatedAt: now() });
  return shareId;
}

/** The public URL a share id resolves to, once the route exists. */
export function protocolShareUrl(shareId: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/protocol/shared/${shareId}`;
}
