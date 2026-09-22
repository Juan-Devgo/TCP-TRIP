/**
 * The schema behind the RFC-style diagram: a protocol is an ordered list of
 * fields, each one a run of bits, and the diagram is that list laid out against
 * a ruler of a fixed width — exactly how RFC 791 draws a header.
 *
 * Everything here is pure and framework-free. Ids are passed in rather than
 * minted (like `src/lib/tabs.ts` does) so the operations stay deterministic
 * under StrictMode's double invocation and can be unit-tested without mocks.
 */

import { findFieldType, type FieldType } from "@/features/protocol-builder/lib/fieldTypes";
import { PROTOCOL_RULER_WIDTHS } from "@/lib/protocols/contract";

/** The ruler presets. Shrinking re-wraps the fields; it never truncates them. */
export const RULER_WIDTHS = PROTOCOL_RULER_WIDTHS;

export type RulerWidth = (typeof RULER_WIDTHS)[number];

export const DEFAULT_RULER_WIDTH: RulerWidth = 32;

export const MIN_FIELD_LENGTH = 1;
/** A field may outgrow the ruler — it wraps — but not without bound. */
export const MAX_FIELD_LENGTH = 256;
export const DEFAULT_FIELD_LENGTH = 8;
/** Composite members start narrow: a group is usually flags or small codes. */
export const DEFAULT_GROUP_CHILD_LENGTH = 4;

export function isRulerWidth(value: number): value is RulerWidth {
  return (RULER_WIDTHS as readonly number[]).includes(value);
}

/**
 * One cell of the diagram. A cell exists before it means anything: `typeId`
 * is `null` while it is still the `Free` slot the author dropped on the canvas.
 */
export type ProtocolField = {
  id: string;
  typeId: string | null;
  name: string;
  meaning: string;
  length: number;
  documentation: string;
  /** Extra values the field type asked for, keyed by option id. */
  options: Record<string, string>;
};

/** A field standing on its own. */
export type SingleNode = {
  kind: "single";
  id: string;
  field: ProtocolField;
};

/**
 * A named run of contiguous fields — «Flags» over its three bits. The group
 * owns the name and the meaning; each member is still defined on its own.
 */
export type GroupNode = {
  kind: "group";
  id: string;
  name: string;
  meaning: string;
  documentation: string;
  children: ProtocolField[];
};

export type ProtocolNode = SingleNode | GroupNode;

export type Protocol = {
  name: string;
  rulerWidth: RulerWidth;
  nodes: ProtocolNode[];
};

export function createProtocol(): Protocol {
  return { name: "", rulerWidth: DEFAULT_RULER_WIDTH, nodes: [] };
}

export function createField(id: string, length = DEFAULT_FIELD_LENGTH): ProtocolField {
  return {
    id,
    typeId: null,
    name: "",
    meaning: "",
    length,
    documentation: "",
    options: {},
  };
}

/** A cell nobody has given a type to yet: the diagram shows it as `Free`. */
export function isFreeField(field: ProtocolField): boolean {
  return field.typeId === null;
}

function clampLength(length: number, type?: FieldType): number {
  if (type?.fixedLength != null) return type.fixedLength;
  const max = Math.min(type?.maxLength ?? MAX_FIELD_LENGTH, MAX_FIELD_LENGTH);
  if (!Number.isFinite(length)) return MIN_FIELD_LENGTH;
  return Math.min(max, Math.max(MIN_FIELD_LENGTH, Math.round(length)));
}

/** The length a field takes when `typeId` is assigned to it. */
export function lengthForType(typeId: string | null, current: number): number {
  const type = findFieldType(typeId);
  if (!type) return clampLength(current);
  if (type.fixedLength != null) return type.fixedLength;
  return clampLength(current || type.defaultLength, type);
}

// --- structure ------------------------------------------------------------

export function addSingleField(protocol: Protocol, fieldId: string): Protocol {
  return {
    ...protocol,
    nodes: [
      ...protocol.nodes,
      { kind: "single", id: fieldId, field: createField(fieldId) },
    ],
  };
}

/** A composite starts divided in two, which is what makes it a composite. */
export function addGroup(
  protocol: Protocol,
  groupId: string,
  childIds: [string, string],
): Protocol {
  return {
    ...protocol,
    nodes: [
      ...protocol.nodes,
      {
        kind: "group",
        id: groupId,
        name: "",
        meaning: "",
        documentation: "",
        children: childIds.map((id) => createField(id, DEFAULT_GROUP_CHILD_LENGTH)),
      },
    ],
  };
}

export function addGroupChild(
  protocol: Protocol,
  groupId: string,
  childId: string,
): Protocol {
  return mapNodes(protocol, (node) =>
    node.kind === "group" && node.id === groupId
      ? {
          ...node,
          children: [...node.children, createField(childId, DEFAULT_GROUP_CHILD_LENGTH)],
        }
      : node,
  );
}

/**
 * Removes a field wherever it sits. A group that loses its last member goes
 * with it: an empty band would be a row of the diagram meaning nothing.
 */
export function removeField(protocol: Protocol, fieldId: string): Protocol {
  const nodes: ProtocolNode[] = [];
  for (const node of protocol.nodes) {
    if (node.kind === "single") {
      if (node.field.id !== fieldId) nodes.push(node);
      continue;
    }
    const children = node.children.filter((child) => child.id !== fieldId);
    if (children.length > 0) nodes.push({ ...node, children });
  }
  return { ...protocol, nodes };
}

/** Removes a whole node — a single field or an entire group. */
export function removeNode(protocol: Protocol, nodeId: string): Protocol {
  return { ...protocol, nodes: protocol.nodes.filter((node) => node.id !== nodeId) };
}

// --- ordering -------------------------------------------------------------

/**
 * What a diagram drag carries, and what it lands on: a single field, or a
 * whole node — a loose field or an entire group band. A group is atomic: it
 * travels with its members, and a member never leaves it.
 */
export type MoveSource = { kind: "field"; id: string } | { kind: "node"; id: string };

/** Where a field sits in the tree: `childIndex` is null for a loose field. */
type FieldSpot = { nodeIndex: number; childIndex: number | null };

function locateField(protocol: Protocol, fieldId: string): FieldSpot | undefined {
  for (const [nodeIndex, node] of protocol.nodes.entries()) {
    if (node.kind === "single") {
      if (node.field.id === fieldId) return { nodeIndex, childIndex: null };
      continue;
    }
    const childIndex = node.children.findIndex((child) => child.id === fieldId);
    if (childIndex >= 0) return { nodeIndex, childIndex };
  }
  return undefined;
}

/**
 * Lifts `from` out of the list and puts it back at `to` — the same move the tab
 * strip makes (`src/lib/tabs.ts`): the dragged item takes the place the target
 * had, and whatever it passed over shifts one step the other way. No "before or
 * after" to aim at; you drop on the position you want.
 */
function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= list.length) return list;

  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item === undefined) return list;
  next.splice(to, 0, item);
  return next;
}

function moveNodeAt(protocol: Protocol, from: number, to: number): Protocol {
  const nodes = reorder(protocol.nodes, from, to);
  return nodes === protocol.nodes ? protocol : { ...protocol, nodes };
}

/**
 * Puts a field in another field's place. A group member only reorders inside
 * its own band; a loose field dropped on a member takes the whole band's place,
 * never a slot between two of its members — a split group is not a group.
 */
export function moveField(
  protocol: Protocol,
  fieldId: string,
  targetFieldId: string,
): Protocol {
  if (fieldId === targetFieldId) return protocol;

  const from = locateField(protocol, fieldId);
  const to = locateField(protocol, targetFieldId);
  if (!from || !to) return protocol;

  const childIndex = from.childIndex;
  if (childIndex !== null) {
    const targetIndex = to.childIndex;
    if (to.nodeIndex !== from.nodeIndex || targetIndex === null) return protocol;

    const node = protocol.nodes[from.nodeIndex];
    if (node?.kind !== "group") return protocol;

    const children = reorder(node.children, childIndex, targetIndex);
    return {
      ...protocol,
      nodes: protocol.nodes.map((candidate, index) =>
        index === from.nodeIndex ? { ...node, children } : candidate,
      ),
    };
  }

  return moveNodeAt(protocol, from.nodeIndex, to.nodeIndex);
}

/** Puts a whole node — a loose field or an entire band — in a field's place. */
export function moveNode(
  protocol: Protocol,
  nodeId: string,
  targetFieldId: string,
): Protocol {
  const from = protocol.nodes.findIndex((node) => node.id === nodeId);
  const to = locateField(protocol, targetFieldId);
  if (from < 0 || !to || to.nodeIndex === from) return protocol;

  return moveNodeAt(protocol, from, to.nodeIndex);
}

/** What the diagram calls on drop, whatever the drag turned out to carry. */
export function applyMove(
  protocol: Protocol,
  source: MoveSource,
  targetFieldId: string,
): Protocol {
  return source.kind === "field"
    ? moveField(protocol, source.id, targetFieldId)
    : moveNode(protocol, source.id, targetFieldId);
}

/**
 * The place the drop would take, or `null` when it would do nothing — this is
 * what the diagram rings while dragging. A member of a band resolves to the
 * member it swaps with; everything else resolves to a whole node, so hovering
 * any part of a band rings the band it is about to displace.
 */
export function resolveMove(
  protocol: Protocol,
  source: MoveSource,
  targetFieldId: string,
): MoveSource | null {
  const to = locateField(protocol, targetFieldId);
  if (!to) return null;

  const targetNode = protocol.nodes[to.nodeIndex];
  if (!targetNode) return null;

  if (source.kind === "field") {
    if (source.id === targetFieldId) return null;

    const from = locateField(protocol, source.id);
    if (!from) return null;

    if (from.childIndex !== null) {
      return from.nodeIndex === to.nodeIndex && to.childIndex !== null
        ? { kind: "field", id: targetFieldId }
        : null;
    }
    if (from.nodeIndex === to.nodeIndex) return null;
  } else if (protocol.nodes.findIndex((node) => node.id === source.id) === to.nodeIndex) {
    return null;
  }

  return { kind: "node", id: targetNode.id };
}

function nudgeNodeAt(protocol: Protocol, index: number, direction: -1 | 1): Protocol {
  return moveNodeAt(protocol, index, index + direction);
}

/**
 * One step of the same reorder, for the keyboard path. A member steps inside
 * its band; a loose field steps over a whole band at once, since a band moves
 * as one thing.
 */
export function nudgeField(
  protocol: Protocol,
  fieldId: string,
  direction: -1 | 1,
): Protocol {
  const spot = locateField(protocol, fieldId);
  if (!spot) return protocol;

  const node = protocol.nodes[spot.nodeIndex];
  const childIndex = spot.childIndex;
  if (node?.kind === "group" && childIndex !== null) {
    const target = node.children[childIndex + direction];
    return target ? moveField(protocol, fieldId, target.id) : protocol;
  }
  return nudgeNodeAt(protocol, spot.nodeIndex, direction);
}

export function nudgeNode(
  protocol: Protocol,
  nodeId: string,
  direction: -1 | 1,
): Protocol {
  const index = protocol.nodes.findIndex((node) => node.id === nodeId);
  return index < 0 ? protocol : nudgeNodeAt(protocol, index, direction);
}

// --- editing --------------------------------------------------------------

export type FieldPatch = Partial<Omit<ProtocolField, "id">>;

/** Applies a patch and re-clamps the length against whatever type now applies. */
export function updateField(
  protocol: Protocol,
  fieldId: string,
  patch: FieldPatch,
): Protocol {
  return mapFields(protocol, (field) => {
    if (field.id !== fieldId) return field;
    const merged = { ...field, ...patch };
    const type = findFieldType(merged.typeId);
    return { ...merged, length: clampLength(merged.length, type) };
  });
}

export type GroupPatch = Partial<Pick<GroupNode, "name" | "meaning" | "documentation">>;

export function updateGroup(
  protocol: Protocol,
  groupId: string,
  patch: GroupPatch,
): Protocol {
  return mapNodes(protocol, (node) =>
    node.kind === "group" && node.id === groupId ? { ...node, ...patch } : node,
  );
}

/** What the resize handle calls: same clamping as the form, one bit at a time. */
export function setFieldLength(
  protocol: Protocol,
  fieldId: string,
  length: number,
): Protocol {
  return updateField(protocol, fieldId, { length });
}

export function setRulerWidth(protocol: Protocol, width: RulerWidth): Protocol {
  return { ...protocol, rulerWidth: width };
}

export function setProtocolName(protocol: Protocol, name: string): Protocol {
  return { ...protocol, name };
}

function mapNodes(
  protocol: Protocol,
  fn: (node: ProtocolNode) => ProtocolNode,
): Protocol {
  return { ...protocol, nodes: protocol.nodes.map(fn) };
}

function mapFields(
  protocol: Protocol,
  fn: (field: ProtocolField) => ProtocolField,
): Protocol {
  return mapNodes(protocol, (node) =>
    node.kind === "single"
      ? { ...node, field: fn(node.field) }
      : { ...node, children: node.children.map(fn) },
  );
}

// --- reading --------------------------------------------------------------

/** A field together with the group it belongs to, if any. */
export type FieldEntry = {
  field: ProtocolField;
  group: GroupNode | null;
  /** Last member of its group — the cell that carries the `+` button. */
  lastOfGroup: boolean;
};

/** Every field in diagram order, groups flattened into their members. */
export function listFields(protocol: Protocol): FieldEntry[] {
  const entries: FieldEntry[] = [];
  for (const node of protocol.nodes) {
    if (node.kind === "single") {
      entries.push({ field: node.field, group: null, lastOfGroup: false });
      continue;
    }
    node.children.forEach((field, index) => {
      entries.push({
        field,
        group: node,
        lastOfGroup: index === node.children.length - 1,
      });
    });
  }
  return entries;
}

export function findFieldEntry(
  protocol: Protocol,
  fieldId: string,
): FieldEntry | undefined {
  return listFields(protocol).find((entry) => entry.field.id === fieldId);
}

export function findGroup(protocol: Protocol, groupId: string): GroupNode | undefined {
  const node = protocol.nodes.find((candidate) => candidate.id === groupId);
  return node?.kind === "group" ? node : undefined;
}

export function totalBits(protocol: Protocol): number {
  return listFields(protocol).reduce((sum, entry) => sum + entry.field.length, 0);
}

export function isEmpty(protocol: Protocol): boolean {
  return protocol.nodes.length === 0 && protocol.name.trim() === "";
}

// --- layout ---------------------------------------------------------------

/**
 * One field's share of one row. A field wider than what is left in the row is
 * cut here and continued on the next, the way a real RFC diagram draws it.
 */
export type FieldSegment = {
  fieldId: string;
  groupId: string | null;
  /** Absolute bit offset where this segment starts. */
  offset: number;
  /** Bits drawn in this row. */
  length: number;
  /** Continues a field that started on an earlier row. */
  continued: boolean;
  /** The field carries on into the next row. */
  continues: boolean;
  /** Where the whole field starts, for the cell's offset label. */
  fieldOffset: number;
  /** The whole field's length, which is what the cell reports. */
  fieldLength: number;
  /** First member of its group: the cell that shows the group name. */
  firstOfGroup: boolean;
  /** Last member of its group: the cell that carries the `+` button. */
  lastOfGroup: boolean;
};

export type LayoutRow = {
  index: number;
  /** Absolute bit offset of the row's first column. */
  startBit: number;
  segments: FieldSegment[];
};

/**
 * Flows the fields across rows of `rulerWidth` bits. Nothing here depends on
 * pixels: the row is a grid of `rulerWidth` columns and a segment spans
 * `length` of them, which is what keeps a cell aligned with the ruler above it.
 */
export function layoutProtocol(protocol: Protocol): LayoutRow[] {
  const width = protocol.rulerWidth;
  const rows: LayoutRow[] = [];
  let cursor = 0;

  function rowAt(index: number): LayoutRow {
    while (rows.length <= index) {
      rows.push({ index: rows.length, startBit: rows.length * width, segments: [] });
    }
    return rows[index]!;
  }

  for (const entry of listFields(protocol)) {
    const fieldOffset = cursor;
    let remaining = entry.field.length;
    let continued = false;

    while (remaining > 0) {
      const room = width - (cursor % width);
      const take = Math.min(room, remaining);
      remaining -= take;

      rowAt(Math.floor(cursor / width)).segments.push({
        fieldId: entry.field.id,
        groupId: entry.group?.id ?? null,
        offset: cursor,
        length: take,
        continued,
        continues: remaining > 0,
        fieldOffset,
        fieldLength: entry.field.length,
        firstOfGroup:
          entry.group !== null && entry.group.children[0]?.id === entry.field.id,
        lastOfGroup: entry.lastOfGroup,
      });

      cursor += take;
      continued = true;
    }
  }

  return rows;
}

// --- validation -----------------------------------------------------------

export type ProtocolIssueCode =
  /** The protocol has no name, so nothing could be listed under it. */
  | "noName"
  /** Nothing has been added to the diagram yet. */
  | "noFields"
  /** Cells still say `Free`: the schema is not finished. */
  | "freeFields"
  /** A composite band nobody named. */
  | "unnamedGroups";

export type ProtocolIssue = {
  code: ProtocolIssueCode;
  /** How many cells or groups the issue covers, for the message's plural. */
  count: number;
};

/** What blocks a save, in the order a reader would fix it. */
export function validateProtocol(protocol: Protocol): ProtocolIssue[] {
  const issues: ProtocolIssue[] = [];
  const fields = listFields(protocol);

  if (protocol.name.trim() === "") issues.push({ code: "noName", count: 0 });
  if (fields.length === 0) issues.push({ code: "noFields", count: 0 });

  const free = fields.filter((entry) => isFreeField(entry.field)).length;
  if (free > 0) issues.push({ code: "freeFields", count: free });

  const unnamed = protocol.nodes.filter(
    (node) => node.kind === "group" && node.name.trim() === "",
  ).length;
  if (unnamed > 0) issues.push({ code: "unnamedGroups", count: unnamed });

  return issues;
}

export function canSave(protocol: Protocol): boolean {
  return validateProtocol(protocol).length === 0;
}

// --- the field form -------------------------------------------------------

/** The form's raw values: length stays a string so it can be cleared. */
export type FieldDraft = {
  typeId: string | null;
  name: string;
  meaning: string;
  length: string;
  documentation: string;
  options: Record<string, string>;
};

export type DraftIssue =
  | { code: "required" }
  | { code: "range"; min: number; max: number }
  | { code: "fixed"; length: number };

/** Keyed by form control: `name`, `length`, or `option:<id>`. */
export type DraftIssues = Record<string, DraftIssue>;

export function fieldToDraft(field: ProtocolField): FieldDraft {
  return {
    typeId: field.typeId,
    name: field.name,
    meaning: field.meaning,
    length: String(field.length),
    documentation: field.documentation,
    options: { ...field.options },
  };
}

/**
 * Everything that stops the form from being confirmed. Codes, not messages:
 * the dialog owns the translated copy.
 */
export function validateFieldDraft(draft: FieldDraft): DraftIssues {
  const issues: DraftIssues = {};
  const type = findFieldType(draft.typeId);

  if (!type) issues["typeId"] = { code: "required" };
  if (draft.name.trim() === "") issues["name"] = { code: "required" };
  if (draft.meaning.trim() === "") issues["meaning"] = { code: "required" };

  const length = Number(draft.length);
  const max = Math.min(type?.maxLength ?? MAX_FIELD_LENGTH, MAX_FIELD_LENGTH);
  if (type?.fixedLength != null) {
    if (length !== type.fixedLength) {
      issues["length"] = { code: "fixed", length: type.fixedLength };
    }
  } else if (
    draft.length.trim() === "" ||
    !Number.isInteger(length) ||
    length < MIN_FIELD_LENGTH ||
    length > max
  ) {
    issues["length"] = { code: "range", min: MIN_FIELD_LENGTH, max };
  }

  for (const option of type?.options ?? []) {
    if (option.required && (draft.options[option.id] ?? "").trim() === "") {
      issues[`option:${option.id}`] = { code: "required" };
    }
  }

  return issues;
}

/** The group form asks for the name and the meaning, and nothing else. */
export type GroupDraft = { name: string; meaning: string; documentation: string };

export function validateGroupDraft(draft: GroupDraft): DraftIssues {
  const issues: DraftIssues = {};
  if (draft.name.trim() === "") issues["name"] = { code: "required" };
  if (draft.meaning.trim() === "") issues["meaning"] = { code: "required" };
  return issues;
}

export function draftToPatch(draft: FieldDraft): FieldPatch {
  const type = findFieldType(draft.typeId);
  return {
    typeId: draft.typeId,
    name: draft.name.trim(),
    meaning: draft.meaning.trim(),
    length: clampLength(Number(draft.length), type),
    documentation: draft.documentation.trim(),
    options: Object.fromEntries(
      (type?.options ?? []).map((option) => [
        option.id,
        (draft.options[option.id] ?? "").trim(),
      ]),
    ),
  };
}
