/**
 * The catalogue the palette offers, grouped the way the course groups them:
 * primitives first, then the types a given layer contributes.
 *
 * A type carries only what changes the *behaviour* of a field — the bits it
 * imposes, the extra questions its form asks, the ink the diagram paints it
 * with. Labels and descriptions live in the locale files: the component owns
 * the copy, this module owns the rules.
 */

export const FIELD_TYPE_CATEGORIES = [
  "primitives",
  "layer2",
  "layer3",
  "layer4",
] as const;

export type FieldTypeCategory = (typeof FIELD_TYPE_CATEGORIES)[number];

/** An extra input the form shows for this type, on top of the shared ones. */
export type FieldTypeOption = {
  /** Key inside `ProtocolField.options`, and the i18n key under `options.`. */
  id: string;
  kind: "text" | "textarea";
  required: boolean;
};

/** Which brand ink the diagram paints a field of this type with. */
export type FieldAccent = "primary" | "secondary" | "tertiary" | "quaternary" | "muted";

export type FieldType = {
  id: string;
  category: FieldTypeCategory;
  /**
   * Bits the type imposes — a flag is one bit, an IPv4 address is thirty-two.
   * `null` means the author decides, which is what makes the field resizable.
   */
  fixedLength: number | null;
  /** Applied when the type lands on a free cell, for the variable types. */
  defaultLength: number;
  maxLength: number;
  options: FieldTypeOption[];
  accent: FieldAccent;
};

export const FIELD_TYPES: FieldType[] = [
  {
    id: "uint",
    category: "primitives",
    fixedLength: null,
    defaultLength: 8,
    maxLength: 64,
    options: [],
    accent: "primary",
  },
  {
    id: "flag",
    category: "primitives",
    fixedLength: 1,
    defaultLength: 1,
    maxLength: 1,
    options: [],
    accent: "tertiary",
  },
  {
    id: "enum",
    category: "primitives",
    fixedLength: null,
    defaultLength: 4,
    maxLength: 32,
    // `0 = ACK` per line: the meaning of a code is part of the schema.
    options: [{ id: "values", kind: "textarea", required: true }],
    accent: "secondary",
  },
  {
    id: "reserved",
    category: "primitives",
    fixedLength: null,
    defaultLength: 4,
    maxLength: 64,
    options: [],
    accent: "muted",
  },
  {
    id: "checksum",
    category: "primitives",
    fixedLength: null,
    defaultLength: 16,
    maxLength: 64,
    options: [{ id: "algorithm", kind: "text", required: false }],
    accent: "quaternary",
  },
  {
    id: "mac",
    category: "layer2",
    fixedLength: 48,
    defaultLength: 48,
    maxLength: 48,
    options: [],
    accent: "secondary",
  },
  {
    id: "ipv4",
    category: "layer3",
    fixedLength: 32,
    defaultLength: 32,
    maxLength: 32,
    options: [],
    accent: "tertiary",
  },
  {
    id: "port",
    category: "layer4",
    fixedLength: 16,
    defaultLength: 16,
    maxLength: 16,
    options: [],
    accent: "quaternary",
  },
];

const TYPES_BY_ID = new Map(FIELD_TYPES.map((type) => [type.id, type]));

export function findFieldType(id: string | null | undefined): FieldType | undefined {
  return id ? TYPES_BY_ID.get(id) : undefined;
}

export function isFieldTypeId(id: string): boolean {
  return TYPES_BY_ID.has(id);
}

/** The palette's reading order: every category, each with its own types. */
export function fieldTypesByCategory(): {
  category: FieldTypeCategory;
  types: FieldType[];
}[] {
  return FIELD_TYPE_CATEGORIES.map((category) => ({
    category,
    types: FIELD_TYPES.filter((type) => type.category === category),
  }));
}
