/**
 * What a protocol document is once it leaves the builder: the shape the API
 * accepts, the database stores and a share link hands back.
 *
 * It lives in `lib/` rather than in the feature because **both halves of the
 * app need it**. The server cannot import `@/features/protocol-builder` — that
 * barrel exports the React component, so the import would drag the whole UI
 * into the Bun process — and the feature must not redeclare the format either,
 * or the two definitions drift the first time a field is added.
 *
 * The checks here are deliberately **structural**. Whether a field's length
 * fits its type, whether a group has a name, whether anything is still `Free`
 * — that is `validateProtocol` in the feature, and the builder runs it before
 * it ever calls save. The server's job is ownership and integrity: refuse what
 * would corrupt a row or blow up a `JSON.parse` on the way back out.
 */

/** Bumped whenever the shape stops being readable by an older reader. */
export const PROTOCOL_SCHEMA_VERSION = 1;

/** The ruler presets. The feature re-exports these as its `RULER_WIDTHS`. */
export const PROTOCOL_RULER_WIDTHS = [8, 16, 24, 32] as const;

/** Long enough for `Encabezado UDP (RFC 768)`, short enough to index. */
export const MAX_PROTOCOL_NAME_LENGTH = 120;

/** A header diagram that does not fit in 256 KB of JSON is not a diagram. */
export const MAX_PROTOCOL_DOCUMENT_BYTES = 256 * 1024;

/** Hex characters of a share id — collisions are retried, not tolerated. */
export const SHARE_ID_LENGTH = 8;

/**
 * Where a share link points. The service builds its URLs with it and the app
 * routes on it, so the two cannot drift.
 */
export const SHARED_PROTOCOL_PREFIX = "/protocol/shared/";

/**
 * The document as the server sees it: enough to store, index and hand back,
 * with the node tree left opaque. The feature's `ProtocolDocument` is the
 * precise version of this and is assignable to it.
 */
export type ProtocolDocumentShape = {
  version: number;
  name: string;
  rulerWidth: number;
  totalBits: number;
  fieldCount: number;
  nodes: readonly unknown[];
};

/** Why a document was refused. The route turns it into a 400's message. */
export type ProtocolDocumentIssue =
  | "notAnObject"
  | "version"
  | "name"
  | "rulerWidth"
  | "counters"
  | "nodes";

export type ParseResult =
  | { ok: true; document: ProtocolDocumentShape }
  | { ok: false; issue: ProtocolDocumentIssue };

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function parseProtocolDocument(value: unknown): ParseResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, issue: "notAnObject" };
  }

  const candidate = value as Record<string, unknown>;
  const { version, name, rulerWidth, totalBits, fieldCount, nodes } = candidate;

  // A document from a future version is refused rather than half-read: the
  // reader that could make sense of it is the one that should store it.
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > PROTOCOL_SCHEMA_VERSION
  ) {
    return { ok: false, issue: "version" };
  }

  // `name` is a column, and a NOT NULL / non-empty one — the builder already
  // blocks a save without it, so an empty name here is a client that lied.
  if (
    typeof name !== "string" ||
    name.trim() === "" ||
    name.length > MAX_PROTOCOL_NAME_LENGTH
  ) {
    return { ok: false, issue: "name" };
  }

  if (
    typeof rulerWidth !== "number" ||
    !(PROTOCOL_RULER_WIDTHS as readonly number[]).includes(rulerWidth)
  ) {
    return { ok: false, issue: "rulerWidth" };
  }

  if (!isCount(totalBits) || !isCount(fieldCount)) {
    return { ok: false, issue: "counters" };
  }

  if (!Array.isArray(nodes)) return { ok: false, issue: "nodes" };

  return {
    ok: true,
    document: {
      version,
      name: name.trim(),
      rulerWidth,
      totalBits,
      fieldCount,
      nodes,
    },
  };
}

/** Guards the request body before it is even parsed as JSON. */
export function isWithinDocumentLimit(body: string): boolean {
  return Buffer.byteLength(body, "utf8") <= MAX_PROTOCOL_DOCUMENT_BYTES;
}
