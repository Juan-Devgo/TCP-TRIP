/**
 * What a theory presentation is once it leaves the editor: the shape the API
 * accepts, the database stores and the Theory section renders.
 *
 * It lives in `lib/` for the same reason `lib/protocols/contract.ts` does —
 * **both halves of the app need it**. The Bun process cannot import
 * `@/features/presentation-editor` (that barrel exports React components), and
 * the feature must not redeclare the format or the two definitions drift.
 *
 * Unlike a protocol document, whose node tree the server keeps opaque, the
 * element tree here is validated field by field: it drives a canvas renderer on
 * a projector, so a malformed element is a blank slide in front of a class, not
 * a rendering nicety. The checks stay *structural* (types, ranges, counts);
 * whether a slide looks good is the editor's problem.
 *
 * Two modes, both stored, neither derived from the other (`mode` says which one
 * the author treats as the source). Markdown is for writing linearly; slides
 * are a free canvas. Converting between them is lossy in both directions —
 * rotation and absolute positions have no markdown spelling — so nothing here
 * converts.
 */

/** Bumped whenever the shape stops being readable by an older reader. */
export const PRESENTATION_SCHEMA_VERSION = 1;

/**
 * The Theory topics a presentation can be published under. The value is a URL
 * slug *and* an i18n key suffix (`theory.topics.<topic>`), so the picker, the
 * Theory listing and the published URL cannot drift.
 */
export const PRESENTATION_TOPICS = [
  "tcp-ip-model",
  "application-layer",
  "transport-layer",
  "internet-layer",
  "link-layer",
  "general",
] as const;

export type PresentationTopic = (typeof PRESENTATION_TOPICS)[number];

/** Which view the author authored in. Both halves of the document survive. */
export const PRESENTATION_MODES = ["slides", "markdown"] as const;

export type PresentationMode = (typeof PRESENTATION_MODES)[number];

/**
 * Slide coordinates are **canvas pixels on a fixed stage**, not fractions: the
 * renderer scales the whole stage to whatever it is projected on, so the editor
 * and the projector are pixel-identical and a font size is a real font size.
 * Only these stages exist — an arbitrary one would make a stored slide
 * unreadable on the next screen.
 */
export const PRESENTATION_CANVASES = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 960 },
] as const;

export const DEFAULT_PRESENTATION_CANVAS = PRESENTATION_CANVASES[0];

/**
 * Element kinds. A fifth (`protocol`, embedding a saved diagram) fits here.
 *
 * `table` and `shape` exist because a networking slide is mostly those two: a
 * header laid out field by field is a table, and a packet travelling between
 * two hosts is an arrow. Building either out of positioned text boxes is what
 * a teacher would otherwise have to do by hand.
 */
export const PRESENTATION_ELEMENT_TYPES = ["text", "image", "table", "shape"] as const;

export type PresentationElementType = (typeof PRESENTATION_ELEMENT_TYPES)[number];

export const TEXT_ALIGNMENTS = ["left", "center", "right"] as const;
export const TEXT_WEIGHTS = [400, 600, 700] as const;
export const IMAGE_FITS = ["contain", "cover"] as const;

/** The figures the canvas can draw. Anything else is an uploaded image. */
export const SHAPE_KINDS = ["rect", "ellipse", "triangle", "line", "arrow"] as const;

export type ShapeKind = (typeof SHAPE_KINDS)[number];

/**
 * Text colour is a **theme token name**, never a raw hex value: a slide written
 * in light mode has to stay readable when the projector is in dark mode, and
 * the tokens are the only values that flip.
 */
export const TEXT_COLOR_TOKENS = [
  "foreground",
  "muted-foreground",
  "primary",
  "secondary",
  "tertiary",
  "quaternary",
] as const;

/** Same tokens plus the surfaces a slide background may use. */
export const SLIDE_BACKGROUND_TOKENS = [
  "background",
  "card",
  "muted",
  "primary",
  "secondary",
  "quaternary",
] as const;

/**
 * What a figure may be painted with — the same token discipline as text, plus
 * `none` for an outline-only shape. A diagram drawn in hex would be the one
 * thing on the slide that does not follow the projector's theme.
 */
export const SHAPE_COLOR_TOKENS = [
  "foreground",
  "muted-foreground",
  "muted",
  "card",
  "background",
  "primary",
  "secondary",
  "tertiary",
  "quaternary",
] as const;

export const NO_FILL = "none";

export const SHAPE_FILL_VALUES = [NO_FILL, ...SHAPE_COLOR_TOKENS] as const;

/** Long enough for a real lecture title, short enough to index. */
export const MAX_PRESENTATION_TITLE_LENGTH = 160;

/** The whole document — markdown and slides, images excluded (they are rows). */
export const MAX_PRESENTATION_DOCUMENT_BYTES = 1024 * 1024;

export const MAX_MARKDOWN_LENGTH = 100_000;
export const MAX_SLIDES = 200;
export const MAX_ELEMENTS_PER_SLIDE = 100;
export const MAX_TEXT_ELEMENT_LENGTH = 5_000;
export const MAX_SLIDE_NOTES_LENGTH = 5_000;
export const MAX_ALT_TEXT_LENGTH = 300;
export const MAX_TABLE_ROWS = 20;
export const MAX_TABLE_COLUMNS = 10;
export const MAX_TABLE_CELL_LENGTH = 200;
export const MAX_SHAPE_STROKE_WIDTH = 64;

/**
 * The author's own notes on the whole presentation — never published. Bigger
 * than a slide's notes because this is where a teacher keeps the plan for the
 * class, not one line per slide.
 */
export const MAX_PRESENTATION_NOTES_LENGTH = 10_000;
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 400;

/** Why an admin rejected it — shown to the author, so it is not optional. */
export const MAX_REVIEW_NOTE_LENGTH = 2_000;

/** One image. Bigger than this is a photo nobody needed at slide resolution. */
export const MAX_ASSET_BYTES = 2 * 1024 * 1024;

/** Per presentation. A deck needing more than this is not a deck. */
export const MAX_ASSETS_PER_PRESENTATION = 50;

/**
 * Raster only, and **no SVG on purpose**: an SVG served from this origin can
 * carry a `<script>`, so accepting one would turn an image upload into stored
 * XSS on every student who opens the published presentation.
 */
export const ALLOWED_ASSET_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type AssetMimeType = (typeof ALLOWED_ASSET_MIME_TYPES)[number];

/**
 * The review lifecycle of a draft.
 *
 * - `draft` — the author's, invisible to everyone else.
 * - `pending` — submitted, waiting in the admin queue.
 * - `published` — an approved snapshot exists in Theory.
 * - `rejected` — an admin refused it; the note says why.
 *
 * The status describes the **draft**, not the published copy: an author may
 * keep editing a `published` presentation, and Theory keeps serving the frozen
 * snapshot until a new submission is approved.
 */
export const PRESENTATION_STATUSES = [
  "draft",
  "pending",
  "published",
  "rejected",
] as const;

export type PresentationStatus = (typeof PRESENTATION_STATUSES)[number];

/** Every entry the review log can hold. Append-only, never updated. */
export const REVIEW_ACTIONS = ["submit", "approve", "reject", "withdraw"] as const;

export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

/** Where a published presentation is read. The app routes on this prefix. */
export const PUBLISHED_PRESENTATION_PREFIX = "/theory/presentations/";

/** Characters of the random half of a publication slug. */
export const SLUG_SUFFIX_LENGTH = 6;

/* ------------------------------------------------------------------ shapes */

export type PresentationCanvas = {
  width: number;
  height: number;
};

export type TextElementProps = {
  text: string;
  /** Canvas pixels — the stage scales, so this is an absolute size. */
  size: number;
  weight: (typeof TEXT_WEIGHTS)[number];
  align: (typeof TEXT_ALIGNMENTS)[number];
  /** A `TEXT_COLOR_TOKENS` name, not a hex value. */
  color: string;
  /** JetBrains Mono — for hex dumps, headers and code. */
  mono?: boolean;
};

export type ImageElementProps = {
  /** A `presentation_assets` row id. Images are never inlined in the JSON. */
  assetId: string;
  /** Required: a slide read out loud is the accessibility floor here. */
  alt: string;
  fit: (typeof IMAGE_FITS)[number];
};

/**
 * A table is stored as its **cells**, not as a laid-out grid: the renderer
 * divides the element box into equal columns and rows, so a table resized on
 * the canvas stays a table instead of becoming a set of drifting text boxes.
 * Every row has the same length — the parser refuses a ragged one.
 */
export type TableElementProps = {
  rows: readonly (readonly string[])[];
  /** The first row is a heading: bold, on the `muted` surface. */
  header: boolean;
  size: number;
  /** A `TEXT_COLOR_TOKENS` name. */
  color: string;
  mono?: boolean;
};

export type ShapeElementProps = {
  kind: ShapeKind;
  /** A `SHAPE_COLOR_TOKENS` name, or `none` for an outline. */
  fill: string;
  /** A `SHAPE_COLOR_TOKENS` name. `strokeWidth: 0` hides it. */
  stroke: string;
  strokeWidth: number;
};

type ElementBox = {
  id: string;
  /** Top-left corner in canvas units. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise, around the box centre. */
  rotation: number;
  /** The editor refuses to drag it. Never a security boundary. */
  locked?: boolean;
};

export type TextElement = ElementBox & { type: "text"; props: TextElementProps };
export type ImageElement = ElementBox & { type: "image"; props: ImageElementProps };
export type TableElement = ElementBox & { type: "table"; props: TableElementProps };
export type ShapeElement = ElementBox & { type: "shape"; props: ShapeElementProps };

/**
 * One element on a slide. **Array order is paint order** — there is no `z`
 * field: two sources of stacking would drift the first time something is
 * reordered, and "bring to front" is a splice to the end of the array.
 */
export type PresentationElement =
  | TextElement
  | ImageElement
  | TableElement
  | ShapeElement;

export type PresentationSlide = {
  id: string;
  /** Outline and thumbnail label. Not rendered on the slide itself. */
  title?: string;
  /** Speaker notes — the presenter screen only, never projected. */
  notes?: string;
  /** A `SLIDE_BACKGROUND_TOKENS` name. Absent = the theme's background. */
  background?: string;
  elements: readonly PresentationElement[];
};

/**
 * The document as it is stored. `author` and the timestamps are deliberately
 * **not** in here: they are columns the server writes. A client-supplied author
 * is a forgeable author, and the published byline has to be trustworthy.
 *
 * `notes` is the author's own: it is stored with the draft and **stripped on
 * the way out to a student** (`withoutPrivateNotes`), so writing the plan for
 * the class in here cannot leak it to the people the class is for.
 */
export type PresentationDocument = {
  version: number;
  title: string;
  topic: PresentationTopic;
  mode: PresentationMode;
  markdown: string;
  /** Plain text, the teacher's only. Never rendered on a slide. */
  notes: string;
  canvas: PresentationCanvas;
  slides: readonly PresentationSlide[];
};

/* -------------------------------------------------------------- validation */

/** Why a document was refused. The route turns it into a 400's message. */
export type PresentationIssue =
  | "notAnObject"
  | "version"
  | "title"
  | "topic"
  | "mode"
  | "markdown"
  | "notes"
  | "canvas"
  | "slides"
  | "slideCount"
  | "slide"
  | "elementCount"
  | "element"
  | "elementBox"
  | "elementProps";

export type PresentationParseResult =
  | { ok: true; document: PresentationDocument }
  | { ok: false; issue: PresentationIssue; at?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A finite number inside a range — `NaN` and `Infinity` are not coordinates. */
function isFinite(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function includes<T extends string | number>(
  allowed: readonly T[],
  value: unknown,
): value is T {
  return (allowed as readonly unknown[]).includes(value);
}

/**
 * Coordinates may sit outside the stage (an element half off-screen is a
 * legitimate design) but not absurdly far — a runaway drag must not produce a
 * number the renderer cannot deal with.
 */
const COORDINATE_LIMIT = 100_000;

function parseElement(
  value: unknown,
): { ok: true; element: PresentationElement } | { ok: false; issue: PresentationIssue } {
  if (!isRecord(value)) return { ok: false, issue: "element" };

  const { id, type, x, y, width, height, rotation, locked, props } = value;

  if (!isId(id)) return { ok: false, issue: "element" };
  if (!includes(PRESENTATION_ELEMENT_TYPES, type)) return { ok: false, issue: "element" };

  if (
    !isFinite(x, -COORDINATE_LIMIT, COORDINATE_LIMIT) ||
    !isFinite(y, -COORDINATE_LIMIT, COORDINATE_LIMIT) ||
    !isFinite(width, 0, COORDINATE_LIMIT) ||
    !isFinite(height, 0, COORDINATE_LIMIT) ||
    !isFinite(rotation, -360, 360) ||
    (locked !== undefined && typeof locked !== "boolean")
  ) {
    return { ok: false, issue: "elementBox" };
  }

  if (!isRecord(props)) return { ok: false, issue: "elementProps" };

  const box: ElementBox = {
    id,
    x,
    y,
    width,
    height,
    rotation,
    ...(locked === true ? { locked: true } : {}),
  };

  if (type === "text") {
    const { text, size, weight, align, color, mono } = props;
    if (typeof text !== "string" || text.length > MAX_TEXT_ELEMENT_LENGTH) {
      return { ok: false, issue: "elementProps" };
    }
    if (
      !isFinite(size, MIN_FONT_SIZE, MAX_FONT_SIZE) ||
      !includes(TEXT_WEIGHTS, weight) ||
      !includes(TEXT_ALIGNMENTS, align) ||
      !includes(TEXT_COLOR_TOKENS, color) ||
      (mono !== undefined && typeof mono !== "boolean")
    ) {
      return { ok: false, issue: "elementProps" };
    }

    return {
      ok: true,
      element: {
        ...box,
        type: "text",
        props: { text, size, weight, align, color, ...(mono === true ? { mono: true } : {}) },
      },
    };
  }

  if (type === "table") {
    const { rows, header, size, color, mono } = props;

    if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_TABLE_ROWS) {
      return { ok: false, issue: "elementProps" };
    }

    // The grid is rectangular by construction: a ragged row would leave the
    // renderer dividing the box by a column count that is only true of one row.
    const columns = Array.isArray(rows[0]) ? (rows[0] as unknown[]).length : 0;
    if (columns === 0 || columns > MAX_TABLE_COLUMNS) {
      return { ok: false, issue: "elementProps" };
    }

    const cells: string[][] = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== columns) {
        return { ok: false, issue: "elementProps" };
      }

      const parsed: string[] = [];
      for (const cell of row) {
        if (typeof cell !== "string" || cell.length > MAX_TABLE_CELL_LENGTH) {
          return { ok: false, issue: "elementProps" };
        }
        parsed.push(cell);
      }
      cells.push(parsed);
    }

    if (
      typeof header !== "boolean" ||
      !isFinite(size, MIN_FONT_SIZE, MAX_FONT_SIZE) ||
      !includes(TEXT_COLOR_TOKENS, color) ||
      (mono !== undefined && typeof mono !== "boolean")
    ) {
      return { ok: false, issue: "elementProps" };
    }

    return {
      ok: true,
      element: {
        ...box,
        type: "table",
        props: { rows: cells, header, size, color, ...(mono === true ? { mono: true } : {}) },
      },
    };
  }

  if (type === "shape") {
    const { kind, fill, stroke, strokeWidth } = props;

    if (
      !includes(SHAPE_KINDS, kind) ||
      !includes(SHAPE_FILL_VALUES, fill) ||
      !includes(SHAPE_COLOR_TOKENS, stroke) ||
      !isFinite(strokeWidth, 0, MAX_SHAPE_STROKE_WIDTH)
    ) {
      return { ok: false, issue: "elementProps" };
    }

    return { ok: true, element: { ...box, type: "shape", props: { kind, fill, stroke, strokeWidth } } };
  }

  const { assetId, alt, fit } = props;
  if (!isId(assetId) || typeof alt !== "string" || alt.length > MAX_ALT_TEXT_LENGTH) {
    return { ok: false, issue: "elementProps" };
  }
  if (!includes(IMAGE_FITS, fit)) return { ok: false, issue: "elementProps" };

  return { ok: true, element: { ...box, type: "image", props: { assetId, alt, fit } } };
}

function parseSlide(
  value: unknown,
): { ok: true; slide: PresentationSlide } | { ok: false; issue: PresentationIssue } {
  if (!isRecord(value)) return { ok: false, issue: "slide" };

  const { id, title, notes, background, elements } = value;

  if (!isId(id)) return { ok: false, issue: "slide" };
  if (
    (title !== undefined &&
      (typeof title !== "string" || title.length > MAX_PRESENTATION_TITLE_LENGTH)) ||
    (notes !== undefined &&
      (typeof notes !== "string" || notes.length > MAX_SLIDE_NOTES_LENGTH)) ||
    (background !== undefined && !includes(SLIDE_BACKGROUND_TOKENS, background))
  ) {
    return { ok: false, issue: "slide" };
  }

  if (!Array.isArray(elements)) return { ok: false, issue: "slide" };
  if (elements.length > MAX_ELEMENTS_PER_SLIDE) return { ok: false, issue: "elementCount" };

  const parsed: PresentationElement[] = [];
  for (const element of elements) {
    const result = parseElement(element);
    if (!result.ok) return result;
    parsed.push(result.element);
  }

  return {
    ok: true,
    slide: {
      id,
      ...(title === undefined ? {} : { title }),
      ...(notes === undefined ? {} : { notes }),
      ...(background === undefined ? {} : { background }),
      elements: parsed,
    },
  };
}

/**
 * The single gate every stored document goes through — the route calls it on
 * the way in, and the editor can call it on its own draft to catch its bugs
 * before the server does.
 */
export function parsePresentationDocument(value: unknown): PresentationParseResult {
  if (!isRecord(value)) return { ok: false, issue: "notAnObject" };

  const { version, title, topic, mode, markdown, notes, canvas, slides } = value;

  // A document from a future version is refused rather than half-read: the
  // reader that could make sense of it is the one that should store it.
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > PRESENTATION_SCHEMA_VERSION
  ) {
    return { ok: false, issue: "version" };
  }

  // `title` is a NOT NULL, non-empty column, and the editor already blocks a
  // save without one — an empty title here is a client that lied.
  if (
    typeof title !== "string" ||
    title.trim() === "" ||
    title.length > MAX_PRESENTATION_TITLE_LENGTH
  ) {
    return { ok: false, issue: "title" };
  }

  if (!includes(PRESENTATION_TOPICS, topic)) return { ok: false, issue: "topic" };
  if (!includes(PRESENTATION_MODES, mode)) return { ok: false, issue: "mode" };

  if (typeof markdown !== "string" || markdown.length > MAX_MARKDOWN_LENGTH) {
    return { ok: false, issue: "markdown" };
  }

  // Absent is not invalid: documents stored before notes existed are still
  // readable, and read back as a presentation with no notes.
  if (
    notes !== undefined &&
    (typeof notes !== "string" || notes.length > MAX_PRESENTATION_NOTES_LENGTH)
  ) {
    return { ok: false, issue: "notes" };
  }

  if (!isRecord(canvas)) return { ok: false, issue: "canvas" };
  const stage = PRESENTATION_CANVASES.find(
    (preset) => preset.width === canvas.width && preset.height === canvas.height,
  );
  if (!stage) return { ok: false, issue: "canvas" };

  if (!Array.isArray(slides)) return { ok: false, issue: "slides" };
  if (slides.length > MAX_SLIDES) return { ok: false, issue: "slideCount" };

  const parsedSlides: PresentationSlide[] = [];
  for (const slide of slides) {
    const result = parseSlide(slide);
    if (!result.ok) return result;
    parsedSlides.push(result.slide);
  }

  return {
    ok: true,
    document: {
      version,
      title: title.trim(),
      topic,
      mode,
      markdown,
      notes: typeof notes === "string" ? notes : "",
      canvas: { width: stage.width, height: stage.height },
      slides: parsedSlides,
    },
  };
}

/** Guards the request body before anything parses it as JSON. */
export function isWithinPresentationLimit(body: string): boolean {
  return Buffer.byteLength(body, "utf8") <= MAX_PRESENTATION_DOCUMENT_BYTES;
}

/** An empty deck, as the editor starts one. Shared so tests agree with the UI. */
export function emptyPresentationDocument(
  title: string,
  topic: PresentationTopic = "general",
): PresentationDocument {
  return {
    version: PRESENTATION_SCHEMA_VERSION,
    title,
    topic,
    mode: "slides",
    markdown: "",
    notes: "",
    canvas: { ...DEFAULT_PRESENTATION_CANVAS },
    slides: [{ id: crypto.randomUUID(), elements: [] }],
  };
}

/**
 * The document as a **student** may see it: both kinds of note removed.
 *
 * Hiding notes in the UI is not hiding them — the published document is JSON a
 * reader can open in the network tab. So the copy that leaves the server for a
 * published presentation goes through here, at the write (approving) and again
 * on the read (rows written before this existed).
 */
export function withoutPrivateNotes(document: PresentationDocument): PresentationDocument {
  return {
    ...document,
    notes: "",
    slides: document.slides.map((slide) => {
      const { notes: _private, ...rest } = slide;
      return rest;
    }),
  };
}

/**
 * A deck's speaker notes, keyed on slide id — what an approval freezes beside
 * the publication, for its author only. Slides without notes have no key.
 */
export type SpeakerNotes = Readonly<Record<string, string>>;

/** The speaker notes a document carries, before `withoutPrivateNotes` drops them. */
export function speakerNotesOf(document: PresentationDocument): SpeakerNotes {
  const notes: Record<string, string> = {};
  for (const slide of document.slides) {
    if (slide.notes && slide.notes.trim() !== "") notes[slide.id] = slide.notes;
  }
  return notes;
}

/** Puts frozen speaker notes back onto a published document, for its author. */
export function withSpeakerNotes(
  document: PresentationDocument,
  notes: SpeakerNotes,
): PresentationDocument {
  return {
    ...document,
    slides: document.slides.map((slide) => {
      const text = notes[slide.id];
      return text === undefined ? slide : { ...slide, notes: text };
    }),
  };
}

/**
 * The readable half of a publication slug. The random half is added by the
 * repository, which is what makes two presentations with the same title work.
 */
export function slugifyTitle(title: string): string {
  const base = title
    .normalize("NFD")
    // Combining marks: `presentación` must not slug to `presentacin`.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base === "" ? "presentacion" : base;
}

/** Where the SPA reads a published presentation. */
export function publishedPresentationPath(slug: string): string {
  return `${PUBLISHED_PRESENTATION_PREFIX}${slug}`;
}

/** Where the browser reads an uploaded image. Used by the canvas renderer. */
export function presentationAssetUrl(assetId: string): string {
  return `/api/assets/presentations/${assetId}`;
}

/* ------------------------------------------------------- reading progress */

/**
 * How far a student has got through a published presentation, as a percentage.
 *
 * One number for **both modes on purpose**: the reading view and the projector
 * view are two renderings of the same content, so a student who read half of it
 * as markdown and then opened it in presentation mode has still read half of
 * it. The two views only differ in how they *measure* — which is what the two
 * helpers below are for.
 *
 * The stored percentage is the **furthest** point reached, not the last one:
 * scrolling back up to re-read a paragraph is not losing progress.
 */
export type ReadingProgress = {
  /** The published presentation this belongs to. */
  slug: string;
  /** 0–100, integer. */
  percent: number;
  /**
   * Where to resume, as an opaque short string the renderer wrote and only it
   * interprets (`slide:4`, `scroll:0.42`). The server stores it and never
   * parses it, so a new view can invent its own spelling without a migration.
   */
  position: string | null;
  updatedAt: string;
};

/** Long enough for `slide:<index>` or `scroll:<ratio>`, short enough to index. */
export const MAX_PROGRESS_POSITION_LENGTH = 64;

/** Below this the presentation counts as unread; at or above it, as finished. */
export const PROGRESS_COMPLETE_PERCENT = 95;

export function isProgressComplete(percent: number): boolean {
  return percent >= PROGRESS_COMPLETE_PERCENT;
}

/** Clamps anything a client sends into a storable percentage. */
export function normalizeProgressPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Presentation mode's measure: the last slide reached out of the deck. The
 * first of four slides is 25 %, not 0 % — a slide seen is a slide read.
 */
export function slideProgressPercent(index: number, total: number): number {
  if (total <= 0) return 0;

  return Math.min(100, Math.round(((index + 1) / total) * 100));
}

/**
 * The reading view's measure: how much of the scrollable height is behind the
 * bottom of the viewport. A document shorter than its viewport has nothing to
 * scroll and is therefore fully read.
 */
export function scrollProgressPercent(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const scrollable = scrollHeight - clientHeight;
  if (scrollable <= 0) return 100;

  return Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));
}
