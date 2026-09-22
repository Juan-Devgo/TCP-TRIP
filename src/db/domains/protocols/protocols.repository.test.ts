import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";

import { openDatabase } from "@/db/client";
import { ProtocolsRepository } from "@/db/domains/protocols";
import {
  PROTOCOL_SCHEMA_VERSION,
  type ProtocolDocumentShape,
} from "@/lib/protocols/contract";

/** Two Clerk ids, because ownership is what these tests are about. */
const ANA = "user_ana";
const BRUNO = "user_bruno";

function document(overrides: Partial<ProtocolDocumentShape> = {}): ProtocolDocumentShape {
  return {
    version: PROTOCOL_SCHEMA_VERSION,
    name: "Encabezado UDP",
    rulerWidth: 32,
    totalBits: 64,
    fieldCount: 4,
    nodes: [
      {
        kind: "group",
        id: "g1",
        name: "Flags",
        meaning: "Banderas de control",
        documentation: "",
        children: [
          {
            id: "f1",
            typeId: "enum",
            name: "Code",
            meaning: "Tipo de mensaje",
            length: 4,
            documentation: "",
            options: { values: "0 = ACK\n1 = NAK" },
          },
        ],
      },
    ],
    ...overrides,
  };
}

let db: Database;
let protocols: ProtocolsRepository;

beforeEach(() => {
  // An isolated database per test — never the singleton.
  db = openDatabase(":memory:");
  protocols = new ProtocolsRepository(db);
});

afterEach(() => {
  // Not `close(true)`: the statements `db.query` caches are still alive, and
  // the strict close reads that as a locked database.
  db.close();
});

describe("save", () => {
  test("stores a protocol and reads it back unchanged", () => {
    const saved = protocols.save(ANA, document());

    expect(saved).not.toBeNull();
    expect(saved?.name).toBe("Encabezado UDP");
    expect(saved?.shareId).toBeNull();
    // The node tree round-trips through JSON with its options intact.
    expect(saved?.document).toEqual(document());
    expect(protocols.findForUser(ANA, saved!.id)).toEqual(saved!);
  });

  test("updating in place keeps the row and its creation time", () => {
    const first = protocols.save(ANA, document())!;
    const second = protocols.save(ANA, document({ name: "Encabezado TCP" }), first.id)!;

    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Encabezado TCP");
    expect(second.createdAt).toBe(first.createdAt);
    expect(protocols.listForUser(ANA)).toHaveLength(1);
  });

  test("refuses to update a protocol that is not the caller's", () => {
    const ana = protocols.save(ANA, document())!;

    expect(protocols.save(BRUNO, document({ name: "Secuestrado" }), ana.id)).toBeNull();
    expect(protocols.findForUser(ANA, ana.id)?.name).toBe("Encabezado UDP");
  });

  test("refuses to update an id that does not exist", () => {
    expect(protocols.save(ANA, document(), "nope")).toBeNull();
  });
});

describe("reading", () => {
  test("lists only the caller's protocols, most recently updated first", () => {
    const older = protocols.save(ANA, document({ name: "Primero" }))!;
    protocols.save(BRUNO, document({ name: "De Bruno" }));
    const newer = protocols.save(ANA, document({ name: "Segundo" }))!;
    // `updated_at` has millisecond resolution, so the touch that reorders the
    // list has to land in a later one.
    Bun.sleepSync(2);
    protocols.save(ANA, document({ name: "Primero, revisado" }), older.id);

    const listed = protocols.listForUser(ANA);

    expect(listed.map((protocol) => protocol.name)).toEqual([
      "Primero, revisado",
      "Segundo",
    ]);
    expect(listed.map((protocol) => protocol.id)).toEqual([older.id, newer.id]);
  });

  test("does not hand one user another user's protocol", () => {
    const ana = protocols.save(ANA, document())!;

    expect(protocols.findForUser(BRUNO, ana.id)).toBeNull();
  });
});

describe("remove", () => {
  test("deletes the caller's protocol and reports it", () => {
    const saved = protocols.save(ANA, document())!;

    expect(protocols.remove(ANA, saved.id)).toBe(true);
    expect(protocols.findForUser(ANA, saved.id)).toBeNull();
  });

  test("leaves another user's protocol alone", () => {
    const ana = protocols.save(ANA, document())!;

    expect(protocols.remove(BRUNO, ana.id)).toBe(false);
    expect(protocols.findForUser(ANA, ana.id)).not.toBeNull();
  });
});

describe("share", () => {
  test("mints a share id once and keeps it", () => {
    const saved = protocols.save(ANA, document())!;

    const shareId = protocols.share(ANA, saved.id);

    expect(shareId).toHaveLength(8);
    expect(protocols.share(ANA, saved.id)).toBe(shareId!);
  });

  test("a share id resolves to the protocol, with no user needed", () => {
    const saved = protocols.save(ANA, document())!;
    const shareId = protocols.share(ANA, saved.id)!;

    const shared = protocols.findByShareId(shareId);

    expect(shared?.id).toBe(saved.id);
    expect(shared?.document).toEqual(document());
  });

  test("survives a later save of the same protocol", () => {
    const saved = protocols.save(ANA, document())!;
    const shareId = protocols.share(ANA, saved.id)!;

    protocols.save(ANA, document({ name: "Revisado" }), saved.id);

    expect(protocols.findByShareId(shareId)?.name).toBe("Revisado");
  });

  test("will not share a protocol that is not the caller's", () => {
    const ana = protocols.save(ANA, document())!;

    expect(protocols.share(BRUNO, ana.id)).toBeNull();
  });

  test("an unknown share id resolves to nothing", () => {
    expect(protocols.findByShareId("deadbeef")).toBeNull();
  });
});
