import { describe, expect, test } from "bun:test";

import {
  isWithinDocumentLimit,
  MAX_PROTOCOL_DOCUMENT_BYTES,
  MAX_PROTOCOL_NAME_LENGTH,
  parseProtocolDocument,
  PROTOCOL_SCHEMA_VERSION,
} from "@/lib/protocols/contract";

function document(overrides: Record<string, unknown> = {}) {
  return {
    version: PROTOCOL_SCHEMA_VERSION,
    name: "Encabezado UDP",
    rulerWidth: 32,
    totalBits: 64,
    fieldCount: 4,
    nodes: [],
    ...overrides,
  };
}

describe("parseProtocolDocument", () => {
  test("accepts a document the builder would export", () => {
    const result = parseProtocolDocument(document({ nodes: [{ kind: "single" }] }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.name).toBe("Encabezado UDP");
      expect(result.document.nodes).toHaveLength(1);
    }
  });

  test("trims the name it stores", () => {
    const result = parseProtocolDocument(document({ name: "  UDP  " }));

    expect(result.ok && result.document.name).toBe("UDP");
  });

  // Wrapped one level: `test.each` spreads a row, and a bare `[]` row would
  // arrive as zero arguments.
  test.each([[null], ["a string"], [[]], [42]])(
    "refuses %p, which is not an object",
    (value) => {
      expect(parseProtocolDocument(value)).toEqual({ ok: false, issue: "notAnObject" });
    },
  );

  test("refuses a version from the future", () => {
    const result = parseProtocolDocument(
      document({ version: PROTOCOL_SCHEMA_VERSION + 1 }),
    );

    expect(result).toEqual({ ok: false, issue: "version" });
  });

  test.each([{ name: "" }, { name: "   " }, { name: 7 }, { name: "x".repeat(MAX_PROTOCOL_NAME_LENGTH + 1) }])(
    "refuses %p as a name",
    (overrides) => {
      expect(parseProtocolDocument(document(overrides))).toEqual({
        ok: false,
        issue: "name",
      });
    },
  );

  test("refuses a ruler width that is not a preset", () => {
    expect(parseProtocolDocument(document({ rulerWidth: 12 }))).toEqual({
      ok: false,
      issue: "rulerWidth",
    });
  });

  test.each([{ totalBits: -1 }, { fieldCount: 1.5 }, { totalBits: "64" }])(
    "refuses %p as a counter",
    (overrides) => {
      expect(parseProtocolDocument(document(overrides))).toEqual({
        ok: false,
        issue: "counters",
      });
    },
  );

  test("refuses nodes that are not a list", () => {
    expect(parseProtocolDocument(document({ nodes: { kind: "single" } }))).toEqual({
      ok: false,
      issue: "nodes",
    });
  });
});

describe("isWithinDocumentLimit", () => {
  test("measures bytes, not characters", () => {
    // A multi-byte name must not slip past a length check that counts chars.
    const half = "ñ".repeat(MAX_PROTOCOL_DOCUMENT_BYTES / 2);

    expect(isWithinDocumentLimit(half)).toBe(true);
    expect(isWithinDocumentLimit(`${half}x`)).toBe(false);
  });
});
