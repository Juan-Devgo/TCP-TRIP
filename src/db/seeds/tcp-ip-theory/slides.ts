import type {
  PresentationElement,
  PresentationSlide,
  ShapeElement,
  TableElement,
  TextElement,
  TextElementProps,
} from "@/lib/presentations/contract";

/**
 * The building blocks of the seeded decks, in the vocabulary the editor saves:
 * every helper returns plain contract elements on the 1920×1080 stage, with
 * colours as theme **token names** — exactly what a teacher placing text boxes,
 * shapes and tables on the canvas would produce.
 */

export const STAGE = { width: 1920, height: 1080 } as const;

/** Left and right margin of every content slide. */
const MARGIN = 120;
const CONTENT_WIDTH = STAGE.width - MARGIN * 2;

/** Where a content slide's body starts, below its title and accent rule. */
export const BODY_TOP = 230;

/** The accents a figure may be outlined with. Text stays on `foreground`. */
export type Accent = "primary" | "secondary" | "tertiary" | "quaternary";

type TextOptions = Partial<Pick<TextElementProps, "size" | "weight" | "align" | "color" | "mono">>;

function id(): string {
  return crypto.randomUUID();
}

/** `TextElementProps.weight` is a closed set; this keeps literals inside it. */
type Weight = TextElementProps["weight"];

export function text(
  x: number,
  y: number,
  width: number,
  height: number,
  value: string,
  options: TextOptions = {},
): TextElement {
  return {
    id: id(),
    type: "text",
    x,
    y,
    width,
    height,
    rotation: 0,
    props: {
      text: value,
      size: options.size ?? 40,
      weight: options.weight ?? (400 as Weight),
      align: options.align ?? "left",
      color: options.color ?? "foreground",
      ...(options.mono ? { mono: true } : {}),
    },
  };
}

export function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill?: string; stroke?: string; strokeWidth?: number; kind?: "rect" | "ellipse" } = {},
): ShapeElement {
  return {
    id: id(),
    type: "shape",
    x,
    y,
    width,
    height,
    rotation: 0,
    props: {
      kind: options.kind ?? "rect",
      fill: options.fill ?? "card",
      stroke: options.stroke ?? "foreground",
      strokeWidth: options.strokeWidth ?? 4,
    },
  };
}

/**
 * A connector from one point to another. The stage draws an arrow along the
 * middle of its box and turns it around the box's top-left corner, so the box
 * is placed where that corner has to be for the shaft to start at `(x1, y1)`.
 */
export function arrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: { stroke?: string; strokeWidth?: number; kind?: "arrow" | "line" } = {},
): ShapeElement {
  const height = 40;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const half = height / 2;

  return {
    id: id(),
    type: "shape",
    x: Math.round(x1 + half * Math.sin(angle)),
    y: Math.round(y1 - half * Math.cos(angle)),
    width: Math.round(length),
    height,
    rotation: Math.round(((angle * 180) / Math.PI) * 100) / 100,
    props: {
      kind: options.kind ?? "arrow",
      fill: "none",
      stroke: options.stroke ?? "foreground",
      strokeWidth: options.strokeWidth ?? 6,
    },
  };
}

export function table(
  x: number,
  y: number,
  width: number,
  height: number,
  rows: string[][],
  options: { size?: number; mono?: boolean; header?: boolean } = {},
): TableElement {
  return {
    id: id(),
    type: "table",
    x,
    y,
    width,
    height,
    rotation: 0,
    props: {
      rows,
      header: options.header ?? true,
      size: options.size ?? 32,
      color: "foreground",
      ...(options.mono ? { mono: true } : {}),
    },
  };
}

/**
 * A labelled box: an outlined rectangle with its text centred inside. The text
 * box is top-aligned on the stage, so it is offset by the height its lines take.
 */
export function box(
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  accent: Accent | "foreground" | "muted-foreground" = "foreground",
  options: TextOptions & { fill?: string; strokeWidth?: number } = {},
): PresentationElement[] {
  const size = options.size ?? 36;
  const lines = label.split("\n").length;
  const textHeight = Math.round(lines * size * 1.2);

  return [
    rect(x, y, width, height, {
      fill: options.fill ?? "card",
      stroke: accent,
      strokeWidth: options.strokeWidth ?? 5,
    }),
    text(x + 12, y + Math.round((height - textHeight) / 2), width - 24, textHeight, label, {
      align: "center",
      weight: (options.weight ?? 600) as Weight,
      size,
      color: options.color ?? "foreground",
      ...(options.mono ? { mono: true } : {}),
    }),
  ];
}

/** A bulleted list as one text box, the way it is typed in the editor. */
export function bullets(
  x: number,
  y: number,
  width: number,
  items: string[],
  options: { size?: number; gap?: boolean } = {},
): TextElement {
  const size = options.size ?? 40;
  const separator = options.gap === false ? "\n" : "\n\n";
  const lineCount = items.length * (options.gap === false ? 1 : 2);

  return text(
    x,
    y,
    width,
    Math.round(lineCount * size * 1.2),
    items.map((item) => `•  ${item}`).join(separator),
    { size },
  );
}

/**
 * A header or frame laid out to scale: one row of boxes whose widths are
 * proportional to their size in bits (or bytes). This is the figure every RFC
 * draws in ASCII, drawn here so the widths actually mean something.
 */
export function fieldRow(
  x: number,
  y: number,
  width: number,
  height: number,
  total: number,
  fields: readonly (readonly [label: string, units: number, accent?: Accent])[],
  options: { size?: number } = {},
): PresentationElement[] {
  const unit = width / total;
  const elements: PresentationElement[] = [];
  let cursor = x;

  for (const [label, units, accent] of fields) {
    const fieldWidth = Math.round(units * unit);
    elements.push(
      ...box(cursor, y, fieldWidth, height, label, accent ?? "foreground", {
        size: options.size ?? 26,
        strokeWidth: 3,
      }),
    );
    cursor += fieldWidth;
  }

  return elements;
}

/* ------------------------------------------------------------ slide types */

type SlideBase = {
  title: string;
  notes: string;
};

/** The cover of a deck: kicker, title, subtitle and an accent bar. */
export function titleSlide({
  kicker,
  title,
  subtitle,
  notes,
  figure = [],
}: {
  kicker: string;
  title: string;
  subtitle: string;
  notes: string;
  /** Optional drawing on the right half. */
  figure?: PresentationElement[];
}): PresentationSlide {
  return {
    id: id(),
    title,
    notes,
    elements: [
      rect(0, 0, 28, STAGE.height, { fill: "primary", stroke: "primary", strokeWidth: 0 }),
      text(MARGIN + 40, 300, 1100, 50, kicker.toUpperCase(), {
        size: 34,
        weight: 600,
        color: "secondary",
        mono: true,
      }),
      text(MARGIN + 40, 370, 1100, 280, title, { size: 104, weight: 700 }),
      text(MARGIN + 40, 680, 1000, 160, subtitle, { size: 42, color: "muted-foreground" }),
      text(MARGIN + 40, 960, 1100, 40, "Redes de Computadores · Modelo TCP/IP", {
        size: 28,
        color: "muted-foreground",
        mono: true,
      }),
      ...figure,
    ],
  };
}

/** A content slide: title, accent rule, footer, and whatever the body draws. */
export function contentSlide(
  deck: string,
  { title, notes, body }: SlideBase & { body: PresentationElement[] },
): PresentationSlide {
  return {
    id: id(),
    title,
    notes,
    elements: [
      text(MARGIN, 70, CONTENT_WIDTH, 90, title, { size: 64, weight: 700 }),
      rect(MARGIN, 175, 160, 10, { fill: "primary", stroke: "primary", strokeWidth: 0 }),
      ...body,
      text(MARGIN, 1010, CONTENT_WIDTH, 36, deck, {
        size: 24,
        color: "muted-foreground",
        mono: true,
      }),
    ],
  };
}

export { MARGIN, CONTENT_WIDTH };
