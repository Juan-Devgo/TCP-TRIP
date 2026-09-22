/**
 * The presentation editor as a pure reducer: a document, what is selected,
 * whether anything is unsaved, and the history behind it.
 *
 * No React import, no fetch, no `Date.now()` — every transition is a function
 * of the state and the action, which is what makes the whole editing model
 * testable without rendering a canvas. The component around it owns the
 * pointer maths and the network.
 *
 * Four invariants the reducer maintains and the UI therefore never has to
 * check:
 *
 * - **A document always has at least one slide.** Deleting the last one leaves
 *   an empty slide behind rather than a deck with nothing to show.
 * - **The selection is always real.** Deleting the selected slide or element —
 *   or undoing back past its creation — moves the selection instead of leaving
 *   a dangling id.
 * - **A gesture is one undo step.** Dragging an element dispatches a move per
 *   pointer event; they coalesce into a single history entry through `label`,
 *   so Ctrl+Z undoes the drag and not the last pixel of it.
 * - **Redo dies on the next edit**, the way every editor behaves.
 */

import {
  DEFAULT_PRESENTATION_CANVAS,
  MAX_ELEMENTS_PER_SLIDE,
  MAX_SLIDES,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  PRESENTATION_SCHEMA_VERSION,
  type ImageElementProps,
  type PresentationCanvas,
  type PresentationDocument,
  type PresentationElement,
  type PresentationMode,
  type PresentationSlide,
  type PresentationTopic,
  type ShapeElementProps,
  type ShapeKind,
  type TableElementProps,
  type TextElementProps,
} from "@/lib/presentations/contract";

/** How far back Ctrl+Z goes. Documents are small; fifty steps is a lecture. */
export const HISTORY_LIMIT = 50;

export type EditorState = {
  document: PresentationDocument;
  /** Always an id of `document.slides`. */
  selectedSlideId: string;
  /** An element of the selected slide, or nothing selected. */
  selectedElementId: string | null;
  /** Set by every edit, cleared by `saved` — what the save button reads. */
  dirty: boolean;
  /** Documents behind the current one, oldest first. */
  past: readonly PresentationDocument[];
  /** Documents undone out of the way, most recently undone first. */
  future: readonly PresentationDocument[];
  /**
   * What produced the current document, when that is a gesture the next
   * identical action should merge into (`move:<id>`, `markdown`, …). `null`
   * means the next edit starts a new history entry whatever it is.
   */
  lastEdit: string | null;
};

export type EditorAction =
  /** Replaces the document, e.g. after loading a draft from the server. */
  | { type: "load"; document: PresentationDocument }
  | { type: "title"; value: string }
  | { type: "topic"; value: PresentationTopic }
  | { type: "mode"; value: PresentationMode }
  | { type: "markdown"; value: string }
  /** The author's own notes on the deck — never published. */
  | { type: "notes"; value: string }
  | { type: "canvas"; value: PresentationCanvas }
  | { type: "selectSlide"; id: string }
  | { type: "addSlide"; id: string }
  | { type: "duplicateSlide"; id: string }
  | { type: "deleteSlide"; id: string; replacementId: string }
  | { type: "moveSlide"; from: number; to: number }
  | { type: "slideTitle"; value: string }
  | { type: "slideNotes"; value: string }
  | { type: "slideBackground"; value: string | null }
  | { type: "selectElement"; id: string | null }
  | { type: "addText"; id: string; text: string }
  | {
      type: "addImage";
      id: string;
      assetId: string;
      alt: string;
      width: number;
      height: number;
    }
  | { type: "addTable"; id: string; rows: number; columns: number }
  | { type: "addShape"; id: string; kind: ShapeKind }
  | { type: "moveElement"; id: string; x: number; y: number }
  | { type: "resizeElement"; id: string; width: number; height: number }
  | { type: "rotateElement"; id: string; rotation: number }
  /** One drag of the canvas transformer: position, size and angle together. */
  | {
      type: "transformElement";
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    }
  | { type: "textProps"; id: string; props: Partial<TextElementProps> }
  | { type: "imageProps"; id: string; props: Partial<ImageElementProps> }
  | { type: "tableProps"; id: string; props: Partial<Omit<TableElementProps, "rows">> }
  | { type: "tableCell"; id: string; row: number; column: number; value: string }
  | { type: "tableSize"; id: string; rows: number; columns: number }
  | { type: "shapeProps"; id: string; props: Partial<ShapeElementProps> }
  | { type: "toggleLock"; id: string }
  | { type: "bringToFront"; id: string }
  | { type: "sendToBack"; id: string }
  | { type: "deleteElement"; id: string }
  | { type: "duplicateElement"; id: string; newId: string }
  | { type: "undo" }
  | { type: "redo" }
  /** Ends a gesture: the next edit starts a fresh history entry. */
  | { type: "commit" }
  | { type: "saved" };

/** A new deck, before it has ever been saved. */
export function emptyDocument(title: string, slideId: string): PresentationDocument {
  return {
    version: PRESENTATION_SCHEMA_VERSION,
    title,
    topic: "general",
    mode: "slides",
    markdown: "",
    notes: "",
    canvas: { ...DEFAULT_PRESENTATION_CANVAS },
    slides: [{ id: slideId, elements: [] }],
  };
}

export function initEditor(document: PresentationDocument): EditorState {
  return {
    document,
    selectedSlideId: document.slides[0]?.id ?? "",
    selectedElementId: null,
    dirty: false,
    past: [],
    future: [],
    lastEdit: null,
  };
}

/** The slide being edited. Never `undefined` in a state the reducer produced. */
export function selectedSlide(state: EditorState): PresentationSlide | undefined {
  return state.document.slides.find((slide) => slide.id === state.selectedSlideId);
}

export function selectedElement(state: EditorState): PresentationElement | undefined {
  if (state.selectedElementId === null) return undefined;

  return selectedSlide(state)?.elements.find(
    (element) => element.id === state.selectedElementId,
  );
}

export function canUndo(state: EditorState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: EditorState): boolean {
  return state.future.length > 0;
}

/**
 * A text box roughly in the middle of the stage, sized so the default font fits
 * on one line — the editor's "add text" has to land somewhere usable.
 */
function newText(id: string, canvas: PresentationCanvas, text: string): PresentationElement {
  const width = Math.round(canvas.width * 0.6);
  const height = Math.round(canvas.height * 0.15);

  return {
    id,
    type: "text",
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    props: {
      text,
      size: Math.round(canvas.height * 0.06),
      weight: 400,
      align: "left",
      color: "foreground",
    },
  };
}

/**
 * An image placed at its own aspect ratio, scaled down to fit the stage. An
 * upload straight off a phone is 4000 px wide; dropping it in unscaled would
 * put a slide's only content off-screen.
 */
function newImage(
  id: string,
  canvas: PresentationCanvas,
  assetId: string,
  alt: string,
  width: number,
  height: number,
): PresentationElement {
  const maxWidth = canvas.width * 0.7;
  const maxHeight = canvas.height * 0.7;
  const ratio = Math.min(1, maxWidth / Math.max(width, 1), maxHeight / Math.max(height, 1));
  const box = { width: Math.round(width * ratio), height: Math.round(height * ratio) };

  return {
    id,
    type: "image",
    x: Math.round((canvas.width - box.width) / 2),
    y: Math.round((canvas.height - box.height) / 2),
    ...box,
    rotation: 0,
    props: { assetId, alt, fit: "contain" },
  };
}

/** An empty grid, sized so its rows are readable from the back of a room. */
function newTable(
  id: string,
  canvas: PresentationCanvas,
  rows: number,
  columns: number,
): PresentationElement {
  const grid = blankGrid(clampRows(rows), clampColumns(columns));
  const width = Math.round(canvas.width * 0.7);
  const height = Math.round(
    Math.min(canvas.height * 0.7, grid.length * canvas.height * 0.09),
  );

  return {
    id,
    type: "table",
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    props: {
      rows: grid,
      header: true,
      size: Math.round(canvas.height * 0.032),
      color: "foreground",
    },
  };
}

/**
 * A figure. A line or an arrow is born thin and wide — it is a connector, and
 * a square one would have to be flattened by hand before it read as a line.
 */
function newShape(
  id: string,
  canvas: PresentationCanvas,
  kind: ShapeKind,
): PresentationElement {
  const connector = kind === "line" || kind === "arrow";
  const width = Math.round(canvas.width * (connector ? 0.45 : 0.3));
  const height = Math.round(connector ? canvas.height * 0.02 : canvas.height * 0.25);

  return {
    id,
    type: "shape",
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    props: connector
      ? { kind, fill: "none", stroke: "primary", strokeWidth: 8 }
      : { kind, fill: "primary", stroke: "foreground", strokeWidth: 0 },
  };
}

function clampRows(rows: number): number {
  return Math.min(MAX_TABLE_ROWS, Math.max(1, Math.round(rows)));
}

function clampColumns(columns: number): number {
  return Math.min(MAX_TABLE_COLUMNS, Math.max(1, Math.round(columns)));
}

function blankGrid(rows: number, columns: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => ""));
}

/**
 * Pads or truncates a grid to `rows` × `columns`, keeping whatever was typed
 * inside the new bounds. Shrinking loses the cells outside it — which is what
 * undo is for.
 */
function resizeGrid(
  rows: readonly (readonly string[])[],
  rowCount: number,
  columnCount: number,
): string[][] {
  return Array.from({ length: rowCount }, (_unused, row) =>
    Array.from({ length: columnCount }, (_also, column) => rows[row]?.[column] ?? ""),
  );
}

/**
 * Every edit goes through here, so `dirty` and the history cannot be forgotten
 * in a branch. `label` is what makes a drag one undo step: an edit carrying the
 * same label as the one before it replaces the current document instead of
 * pushing another entry.
 */
function edited(
  state: EditorState,
  document: PresentationDocument,
  label: string | null = null,
): EditorState {
  const merge = label !== null && label === state.lastEdit;

  return {
    ...state,
    document,
    dirty: true,
    past: merge ? state.past : [...state.past, state.document].slice(-HISTORY_LIMIT),
    // Editing after an undo abandons what was undone, as every editor does.
    future: [],
    lastEdit: label,
  };
}

/**
 * The selection, moved onto whatever the given document actually contains.
 * Undo can take the document back past the creation of the selected element.
 */
function reselect(
  state: EditorState,
  document: PresentationDocument,
): Pick<EditorState, "selectedSlideId" | "selectedElementId"> {
  const slide =
    document.slides.find((candidate) => candidate.id === state.selectedSlideId) ??
    document.slides[0];

  const element = slide?.elements.some(
    (candidate) => candidate.id === state.selectedElementId,
  );

  return {
    selectedSlideId: slide?.id ?? "",
    selectedElementId: element === true ? state.selectedElementId : null,
  };
}

function mapSlides(
  state: EditorState,
  update: (slide: PresentationSlide) => PresentationSlide,
): PresentationDocument {
  return {
    ...state.document,
    slides: state.document.slides.map((slide) =>
      slide.id === state.selectedSlideId ? update(slide) : slide,
    ),
  };
}

function mapElements(
  state: EditorState,
  id: string,
  update: (element: PresentationElement) => PresentationElement,
): PresentationDocument {
  return mapSlides(state, (slide) => ({
    ...slide,
    elements: slide.elements.map((element) =>
      element.id === id ? update(element) : element,
    ),
  }));
}

/** Adds one element to the selected slide and selects it. The cap is the cap. */
function inserted(
  state: EditorState,
  element: PresentationElement | null,
): EditorState {
  const slide = selectedSlide(state);
  if (!slide || !element || slide.elements.length >= MAX_ELEMENTS_PER_SLIDE) return state;

  return {
    ...edited(
      state,
      mapSlides(state, (current) => ({
        ...current,
        elements: [...current.elements, element],
      })),
    ),
    selectedElementId: element.id,
  };
}

/** Reorders one element within its slide — the only stacking there is. */
function restack(
  state: EditorState,
  id: string,
  where: "front" | "back",
): PresentationDocument {
  return mapSlides(state, (slide) => {
    const element = slide.elements.find((candidate) => candidate.id === id);
    if (!element) return slide;

    const rest = slide.elements.filter((candidate) => candidate.id !== id);
    return {
      ...slide,
      elements: where === "front" ? [...rest, element] : [element, ...rest],
    };
  });
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "load":
      return initEditor(action.document);

    case "title":
      return edited(state, { ...state.document, title: action.value }, "title");

    case "topic":
      return edited(state, { ...state.document, topic: action.value });

    case "mode":
      return edited(state, { ...state.document, mode: action.value });

    case "markdown":
      return edited(state, { ...state.document, markdown: action.value }, "markdown");

    case "notes":
      return edited(state, { ...state.document, notes: action.value }, "notes");

    case "canvas":
      // Elements keep their coordinates: the stage changes shape, and whatever
      // now hangs off the edge is visible in the editor and can be moved.
      return edited(state, { ...state.document, canvas: action.value });

    case "selectSlide":
      return state.selectedSlideId === action.id
        ? state
        : { ...state, selectedSlideId: action.id, selectedElementId: null };

    case "addSlide": {
      if (state.document.slides.length >= MAX_SLIDES) return state;

      const slides = [...state.document.slides, { id: action.id, elements: [] }];
      return {
        ...edited(state, { ...state.document, slides }),
        selectedSlideId: action.id,
        selectedElementId: null,
      };
    }

    case "duplicateSlide": {
      if (state.document.slides.length >= MAX_SLIDES) return state;

      const index = state.document.slides.findIndex((slide) => slide.id === action.id);
      const source = state.document.slides[index];
      if (!source) return state;

      // Element ids are only unique within a slide, so the copies can keep
      // theirs — nothing addresses an element across slides.
      const copy: PresentationSlide = { ...source, id: `${action.id}-copy-${index}` };
      const slides = [...state.document.slides];
      slides.splice(index + 1, 0, copy);

      return {
        ...edited(state, { ...state.document, slides }),
        selectedSlideId: copy.id,
        selectedElementId: null,
      };
    }

    case "deleteSlide": {
      const remaining = state.document.slides.filter((slide) => slide.id !== action.id);

      // A deck always has a slide: the last delete empties it instead.
      const slides =
        remaining.length > 0 ? remaining : [{ id: action.replacementId, elements: [] }];

      const stillThere = slides.some((slide) => slide.id === state.selectedSlideId);

      return {
        ...edited(state, { ...state.document, slides }),
        selectedSlideId: stillThere ? state.selectedSlideId : (slides[0]?.id ?? ""),
        selectedElementId: stillThere ? state.selectedElementId : null,
      };
    }

    case "moveSlide": {
      const slides = [...state.document.slides];
      const [moved] = slides.splice(action.from, 1);
      if (!moved) return state;
      slides.splice(action.to, 0, moved);

      return edited(state, { ...state.document, slides });
    }

    case "slideTitle":
      return edited(
        state,
        mapSlides(state, (slide) => {
          const { title: _dropped, ...rest } = slide;
          return action.value === "" ? rest : { ...rest, title: action.value };
        }),
        `slideTitle:${state.selectedSlideId}`,
      );

    case "slideNotes":
      return edited(
        state,
        mapSlides(state, (slide) => {
          const { notes: _dropped, ...rest } = slide;
          return action.value === "" ? rest : { ...rest, notes: action.value };
        }),
        `slideNotes:${state.selectedSlideId}`,
      );

    case "slideBackground":
      return edited(
        state,
        mapSlides(state, (slide) => {
          const { background: _dropped, ...rest } = slide;
          return action.value === null ? rest : { ...rest, background: action.value };
        }),
      );

    case "selectElement":
      return { ...state, selectedElementId: action.id };

    case "addText":
      return inserted(state, newText(action.id, state.document.canvas, action.text));

    case "addImage":
      return inserted(
        state,
        newImage(
          action.id,
          state.document.canvas,
          action.assetId,
          action.alt,
          action.width,
          action.height,
        ),
      );

    case "addTable":
      return inserted(
        state,
        newTable(action.id, state.document.canvas, action.rows, action.columns),
      );

    case "addShape":
      return inserted(state, newShape(action.id, state.document.canvas, action.kind));

    case "duplicateElement": {
      const source = selectedSlide(state)?.elements.find(
        (element) => element.id === action.id,
      );
      if (!source) return state;

      // Offset, so the copy is visibly a copy and not hiding the original.
      return inserted(state, {
        ...source,
        id: action.newId,
        x: source.x + 32,
        y: source.y + 32,
      });
    }

    case "moveElement":
      return edited(
        state,
        mapElements(state, action.id, (element) =>
          element.locked
            ? element
            : { ...element, x: Math.round(action.x), y: Math.round(action.y) },
        ),
        `move:${action.id}`,
      );

    case "resizeElement":
      return edited(
        state,
        mapElements(state, action.id, (element) =>
          element.locked ? element : { ...element, ...sizeOf(action) },
        ),
        `resize:${action.id}`,
      );

    case "rotateElement":
      return edited(
        state,
        mapElements(state, action.id, (element) =>
          element.locked
            ? element
            : { ...element, rotation: normalizeRotation(action.rotation) },
        ),
        `rotate:${action.id}`,
      );

    case "transformElement":
      return edited(
        state,
        mapElements(state, action.id, (element) =>
          element.locked
            ? element
            : {
                ...element,
                x: Math.round(action.x),
                y: Math.round(action.y),
                ...sizeOf(action),
                rotation: normalizeRotation(action.rotation),
              },
        ),
        `transform:${action.id}`,
      );

    case "textProps":
      return edited(
        state,
        mapElements(state, action.id, (element) =>
          element.type === "text"
            ? { ...element, props: { ...element.props, ...action.props } }
            : element,
        ),
        // Typing is one entry; a colour change is its own.
        action.props.text === undefined ? null : `text:${action.id}`,
      );

    case "imageProps":
      return edited(
        state,
        mapElements(state, action.id, (element) =>
          element.type === "image"
            ? { ...element, props: { ...element.props, ...action.props } }
            : element,
        ),
        action.props.alt === undefined ? null : `alt:${action.id}`,
      );

    case "tableProps":
      return edited(
        state,
        mapElements(state, action.id, (element) =>
          element.type === "table"
            ? { ...element, props: { ...element.props, ...action.props } }
            : element,
        ),
      );

    case "tableCell":
      return edited(
        state,
        mapElements(state, action.id, (element) => {
          if (element.type !== "table") return element;

          const rows = element.props.rows.map((row, index) =>
            index === action.row
              ? row.map((cell, column) => (column === action.column ? action.value : cell))
              : row,
          );

          return { ...element, props: { ...element.props, rows } };
        }),
        `cell:${action.id}:${action.row}:${action.column}`,
      );

    case "tableSize":
      return edited(
        state,
        mapElements(state, action.id, (element) =>
          element.type === "table"
            ? {
                ...element,
                props: {
                  ...element.props,
                  rows: resizeGrid(
                    element.props.rows,
                    clampRows(action.rows),
                    clampColumns(action.columns),
                  ),
                },
              }
            : element,
        ),
      );

    case "shapeProps":
      return edited(
        state,
        mapElements(state, action.id, (element) =>
          element.type === "shape"
            ? { ...element, props: { ...element.props, ...action.props } }
            : element,
        ),
      );

    case "toggleLock":
      return edited(
        state,
        mapElements(state, action.id, (element) => {
          const { locked: _dropped, ...rest } = element;
          return element.locked ? rest : { ...rest, locked: true };
        }),
      );

    case "bringToFront":
      return edited(state, restack(state, action.id, "front"));

    case "sendToBack":
      return edited(state, restack(state, action.id, "back"));

    case "deleteElement": {
      const document = mapSlides(state, (slide) => ({
        ...slide,
        elements: slide.elements.filter((element) => element.id !== action.id),
      }));

      return {
        ...edited(state, document),
        selectedElementId:
          state.selectedElementId === action.id ? null : state.selectedElementId,
      };
    }

    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;

      return {
        ...state,
        document: previous,
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future],
        // Undoing to the document that was last saved is not tracked: a save
        // that writes an identical document is harmless, a missing one is not.
        dirty: true,
        lastEdit: null,
        ...reselect(state, previous),
      };
    }

    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;

      return {
        ...state,
        document: next,
        past: [...state.past, state.document].slice(-HISTORY_LIMIT),
        future: rest,
        dirty: true,
        lastEdit: null,
        ...reselect(state, next),
      };
    }

    case "commit":
      return state.lastEdit === null ? state : { ...state, lastEdit: null };

    case "saved":
      return state.dirty ? { ...state, dirty: false } : state;
  }
}

/** A zero-sized box cannot be grabbed again, so it never gets one. */
function sizeOf(box: { width: number; height: number }): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(16, Math.round(box.width)),
    height: Math.max(16, Math.round(box.height)),
  };
}

/** Keeps rotation inside the ±360 the contract stores. */
function normalizeRotation(degrees: number): number {
  const wrapped = Math.round(degrees) % 360;
  return wrapped;
}
