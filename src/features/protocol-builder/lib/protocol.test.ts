import { describe, expect, test } from "bun:test";

import {
  addGroup,
  addGroupChild,
  addSingleField,
  createProtocol,
  draftToPatch,
  fieldToDraft,
  findFieldEntry,
  layoutProtocol,
  listFields,
  moveField,
  moveNode,
  nudgeField,
  nudgeNode,
  removeField,
  resolveMove,
  setFieldLength,
  setRulerWidth,
  totalBits,
  updateField,
  validateFieldDraft,
  validateProtocol,
  type Protocol,
} from "@/features/protocol-builder/lib/protocol";

/** A protocol whose fields are already typed, so nothing reads as `Free`. */
function defined(lengths: number[], typeId = "uint"): Protocol {
  let protocol = createProtocol();
  protocol = { ...protocol, name: "Test" };
  lengths.forEach((length, index) => {
    const id = `f${index}`;
    protocol = addSingleField(protocol, id);
    protocol = updateField(protocol, id, {
      typeId,
      name: `Field ${index}`,
      meaning: "…",
      length,
    });
  });
  return protocol;
}

describe("structure", () => {
  test("a single field lands at the end as a free cell", () => {
    const protocol = addSingleField(createProtocol(), "a");
    const [entry] = listFields(protocol);

    expect(entry?.field.typeId).toBeNull();
    expect(entry?.group).toBeNull();
  });

  test("a composite starts divided in two and grows one member at a time", () => {
    let protocol = addGroup(createProtocol(), "g", ["c1", "c2"]);
    expect(listFields(protocol)).toHaveLength(2);

    protocol = addGroupChild(protocol, "g", "c3");
    const entries = listFields(protocol);

    expect(entries).toHaveLength(3);
    expect(entries.every((entry) => entry.group?.id === "g")).toBe(true);
    expect(entries.at(-1)?.lastOfGroup).toBe(true);
  });

  test("a group disappears with its last member", () => {
    let protocol = addGroup(createProtocol(), "g", ["c1", "c2"]);
    protocol = removeField(protocol, "c1");
    expect(protocol.nodes).toHaveLength(1);

    protocol = removeField(protocol, "c2");
    expect(protocol.nodes).toHaveLength(0);
  });
});

describe("lengths", () => {
  test("a type with a fixed length imposes it, whatever is asked for", () => {
    let protocol = addSingleField(createProtocol(), "a");
    protocol = updateField(protocol, "a", { typeId: "flag", length: 9 });

    expect(findFieldEntry(protocol, "a")?.field.length).toBe(1);
  });

  test("a variable length is clamped to what the type allows", () => {
    let protocol = addSingleField(createProtocol(), "a");
    protocol = updateField(protocol, "a", { typeId: "uint" });

    expect(setFieldLength(protocol, "a", 0).nodes).toEqual(
      setFieldLength(protocol, "a", 1).nodes,
    );
    expect(findFieldEntry(setFieldLength(protocol, "a", 999), "a")?.field.length).toBe(
      64,
    );
  });

  test("total bits is the sum of every field, groups included", () => {
    let protocol = defined([16, 16]);
    protocol = addGroup(protocol, "g", ["c1", "c2"]);

    expect(totalBits(protocol)).toBe(16 + 16 + 4 + 4);
  });
});

describe("layout", () => {
  test("fields flow across the ruler in order", () => {
    const rows = layoutProtocol(defined([16, 16]));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.segments.map((segment) => segment.offset)).toEqual([0, 16]);
  });

  test("a field that does not fit is cut and continued on the next row", () => {
    const rows = layoutProtocol(defined([24, 16]));

    expect(rows).toHaveLength(2);
    const [first, second] = rows[0]!.segments;
    expect(first?.length).toBe(24);
    expect(second?.length).toBe(8);
    expect(second?.continues).toBe(true);

    const continuation = rows[1]?.segments[0];
    expect(continuation?.continued).toBe(true);
    expect(continuation?.length).toBe(8);
    expect(continuation?.fieldLength).toBe(16);
  });

  test("shrinking the ruler re-wraps without touching the fields", () => {
    const protocol = defined([16, 16]);
    const narrow = setRulerWidth(protocol, 8);

    expect(listFields(narrow).map((entry) => entry.field.length)).toEqual([16, 16]);
    expect(layoutProtocol(narrow)).toHaveLength(4);
  });

  test("a field wider than the ruler spans several rows", () => {
    const rows = layoutProtocol(setRulerWidth(defined([48], "mac"), 16));

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.segments.length === 1)).toBe(true);
  });
});

/** The field ids in diagram order — what a reorder is really about. */
function order(protocol: Protocol): string[] {
  return listFields(protocol).map((entry) => entry.field.id);
}

/** Three loose fields and a band of two, so both levels are reorderable. */
function mixed(): Protocol {
  let protocol = addSingleField(createProtocol(), "a");
  protocol = addGroup(protocol, "g", ["c1", "c2"]);
  protocol = addSingleField(protocol, "b");
  return protocol;
}

describe("ordering", () => {
  test("a field takes the place of the field it was dropped on", () => {
    const protocol = defined([4, 4, 4]);

    // Forward: everything it passed over shifts one step back.
    expect(order(moveField(protocol, "f0", "f2"))).toEqual(["f1", "f2", "f0"]);
    // Backward: the same move read the other way.
    expect(order(moveField(protocol, "f2", "f0"))).toEqual(["f2", "f0", "f1"]);
    expect(order(moveField(protocol, "f1", "f0"))).toEqual(["f1", "f0", "f2"]);
  });

  test("dropping a field on itself, or on nothing, changes nothing", () => {
    const protocol = defined([4, 4]);

    expect(moveField(protocol, "f0", "f0")).toBe(protocol);
    expect(moveField(protocol, "f0", "ghost")).toBe(protocol);
    expect(moveField(protocol, "ghost", "f0")).toBe(protocol);
  });

  test("a member reorders inside its own band and nowhere else", () => {
    const protocol = mixed();

    expect(order(moveField(protocol, "c1", "c2"))).toEqual(["a", "c2", "c1", "b"]);
    // Out of the band: the group would stop being contiguous.
    expect(moveField(protocol, "c1", "a")).toBe(protocol);
    expect(moveField(protocol, "c2", "b")).toBe(protocol);
  });

  test("a loose field dropped on a member takes the whole band's place", () => {
    const protocol = mixed();

    expect(order(moveField(protocol, "b", "c2"))).toEqual(["a", "b", "c1", "c2"]);
    expect(order(moveField(protocol, "a", "c1"))).toEqual(["c1", "c2", "a", "b"]);
  });

  test("a band travels whole, and never into itself", () => {
    const protocol = mixed();

    expect(order(moveNode(protocol, "g", "a"))).toEqual(["c1", "c2", "a", "b"]);
    expect(moveNode(protocol, "g", "c1")).toBe(protocol);
  });

  test("lengths and definitions survive a move", () => {
    const protocol = defined([4, 16, 8]);
    const moved = moveField(protocol, "f1", "f0");
    const [first] = listFields(moved);

    expect(first?.field.length).toBe(16);
    expect(first?.field.name).toBe("Field 1");
    expect(totalBits(moved)).toBe(totalBits(protocol));
    expect(order(protocol)).toEqual(["f0", "f1", "f2"]);
  });

  test("the ring points at the place the drop would really take", () => {
    const protocol = mixed();

    expect(resolveMove(protocol, { kind: "field", id: "a" }, "b")).toEqual({
      kind: "node",
      id: "b",
    });
    // A loose field over a member rings the band, not the member.
    expect(resolveMove(protocol, { kind: "field", id: "b" }, "c2")).toEqual({
      kind: "node",
      id: "g",
    });
    // Inside the band the member itself is the one being displaced.
    expect(resolveMove(protocol, { kind: "field", id: "c1" }, "c2")).toEqual({
      kind: "field",
      id: "c2",
    });
    // Drops that would do nothing carry no ring.
    expect(resolveMove(protocol, { kind: "field", id: "c1" }, "a")).toBeNull();
    expect(resolveMove(protocol, { kind: "node", id: "g" }, "c2")).toBeNull();
    expect(resolveMove(protocol, { kind: "field", id: "a" }, "a")).toBeNull();
  });

  test("the keyboard steps one position and stops at the edges", () => {
    const protocol = mixed();

    // A loose field steps over the whole band at once.
    expect(order(nudgeField(protocol, "a", 1))).toEqual(["c1", "c2", "a", "b"]);
    expect(order(nudgeField(protocol, "c1", 1))).toEqual(["a", "c2", "c1", "b"]);
    expect(nudgeField(protocol, "a", -1)).toBe(protocol);
    expect(nudgeField(protocol, "c2", 1)).toBe(protocol);
    expect(order(nudgeNode(protocol, "g", 1))).toEqual(["a", "b", "c1", "c2"]);
    expect(nudgeNode(protocol, "ghost", 1)).toBe(protocol);
  });
});

describe("validation", () => {
  test("a nameless, empty protocol reports both problems", () => {
    const codes = validateProtocol(createProtocol()).map((issue) => issue.code);
    expect(codes).toContain("noName");
    expect(codes).toContain("noFields");
  });

  test("free cells block the save and are counted", () => {
    let protocol = defined([8]);
    protocol = addSingleField(protocol, "free1");
    protocol = addSingleField(protocol, "free2");

    const issue = validateProtocol(protocol).find((item) => item.code === "freeFields");
    expect(issue?.count).toBe(2);
  });

  test("a named protocol with every cell defined is saveable", () => {
    expect(validateProtocol(defined([8, 8]))).toEqual([]);
  });

  test("an unnamed group blocks the save", () => {
    const protocol = addGroup(defined([8]), "g", ["c1", "c2"]);
    const codes = validateProtocol(protocol).map((issue) => issue.code);

    expect(codes).toContain("unnamedGroups");
  });
});

describe("the field form", () => {
  const draft = {
    typeId: "uint",
    name: "TTL",
    meaning: "Time to live",
    length: "8",
    documentation: "",
    options: {},
  };

  test("name, meaning and a type are required", () => {
    const issues = validateFieldDraft({
      ...draft,
      typeId: null,
      name: " ",
      meaning: "",
    });

    expect(issues["typeId"]?.code).toBe("required");
    expect(issues["name"]?.code).toBe("required");
    expect(issues["meaning"]?.code).toBe("required");
  });

  test("a length outside the type's range is reported with its bounds", () => {
    const issue = validateFieldDraft({ ...draft, length: "0" })["length"];
    expect(issue).toEqual({ code: "range", min: 1, max: 64 });
  });

  test("a fixed-length type refuses any other length", () => {
    expect(validateFieldDraft({ ...draft, typeId: "ipv4", length: "16" })["length"]).toEqual(
      { code: "fixed", length: 32 },
    );
    expect(validateFieldDraft({ ...draft, typeId: "ipv4", length: "32" })).toEqual({});
  });

  test("an option the type marks required is required", () => {
    const issues = validateFieldDraft({ ...draft, typeId: "enum", length: "4" });
    expect(issues["option:values"]?.code).toBe("required");
  });

  test("a draft round-trips through the field it describes", () => {
    let protocol = addSingleField(createProtocol(), "a");
    protocol = updateField(protocol, "a", draftToPatch({ ...draft, name: " TTL " }));

    const field = findFieldEntry(protocol, "a")!.field;
    expect(field.name).toBe("TTL");
    expect(fieldToDraft(field).length).toBe("8");
  });
});
