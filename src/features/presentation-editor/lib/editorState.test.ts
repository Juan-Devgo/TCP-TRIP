import { describe, expect, test } from "bun:test";

import {
  canRedo,
  canUndo,
  editorReducer,
  emptyDocument,
  initEditor,
  selectedElement,
  selectedSlide,
  type EditorAction,
  type EditorState,
} from "@/features/presentation-editor/lib/editorState";
import {
  parsePresentationDocument,
  type PresentationElement,
} from "@/lib/presentations/contract";

function start(): EditorState {
  return initEditor(emptyDocument("Capa de transporte", "s1"));
}

/** Applies a list of actions, the way the component does over time. */
function run(state: EditorState, ...actions: EditorAction[]): EditorState {
  return actions.reduce(editorReducer, state);
}

function withText(): EditorState {
  return run(start(), { type: "addText", id: "e1", text: "Hola" });
}

describe("a new document", () => {
  test("starts on its only slide with nothing selected and nothing to save", () => {
    const state = start();

    expect(state.document.slides).toHaveLength(1);
    expect(state.selectedSlideId).toBe("s1");
    expect(state.selectedElementId).toBeNull();
    expect(state.dirty).toBe(false);
  });

  test("is valid against the contract the server enforces", () => {
    expect(parsePresentationDocument(start().document).ok).toBe(true);
  });
});

describe("slides", () => {
  test("adding one selects it", () => {
    const state = run(start(), { type: "addSlide", id: "s2" });

    expect(state.document.slides.map((slide) => slide.id)).toEqual(["s1", "s2"]);
    expect(state.selectedSlideId).toBe("s2");
    expect(state.dirty).toBe(true);
  });

  test("duplicating copies the elements", () => {
    const state = run(withText(), { type: "duplicateSlide", id: "s1" });

    expect(state.document.slides).toHaveLength(2);
    expect(selectedSlide(state)?.elements).toHaveLength(1);
    expect(state.selectedSlideId).not.toBe("s1");
  });

  test("deleting the last slide leaves an empty one, not an empty deck", () => {
    const state = run(withText(), {
      type: "deleteSlide",
      id: "s1",
      replacementId: "fresh",
    });

    expect(state.document.slides).toHaveLength(1);
    expect(state.document.slides[0]).toEqual({ id: "fresh", elements: [] });
    expect(state.selectedSlideId).toBe("fresh");
  });

  test("deleting the selected slide moves the selection somewhere real", () => {
    const state = run(
      start(),
      { type: "addSlide", id: "s2" },
      { type: "deleteSlide", id: "s2", replacementId: "unused" },
    );

    expect(state.selectedSlideId).toBe("s1");
    expect(selectedSlide(state)).toBeDefined();
  });

  test("reordering moves a slide without touching the selection", () => {
    const state = run(
      start(),
      { type: "addSlide", id: "s2" },
      { type: "moveSlide", from: 1, to: 0 },
    );

    expect(state.document.slides.map((slide) => slide.id)).toEqual(["s2", "s1"]);
    expect(state.selectedSlideId).toBe("s2");
  });

  test("a slide's title, notes and background are dropped when cleared", () => {
    const filled = run(
      start(),
      { type: "slideTitle", value: "Portada" },
      { type: "slideNotes", value: "Saludar" },
      { type: "slideBackground", value: "card" },
    );
    expect(selectedSlide(filled)).toMatchObject({
      title: "Portada",
      notes: "Saludar",
      background: "card",
    });

    const cleared = run(
      filled,
      { type: "slideTitle", value: "" },
      { type: "slideNotes", value: "" },
      { type: "slideBackground", value: null },
    );

    // Absent, not empty strings: the contract treats them as optional.
    expect(selectedSlide(cleared)).toEqual({ id: "s1", elements: [] });
  });
});

describe("elements", () => {
  test("a new text box lands on the stage and gets selected", () => {
    const state = withText();
    const element = selectedElement(state);

    expect(element?.type).toBe("text");
    expect(element?.x).toBeGreaterThan(0);
    expect(element?.y).toBeGreaterThan(0);
    expect(state.selectedElementId).toBe("e1");
  });

  test("an image keeps its aspect ratio and is scaled to fit the stage", () => {
    const state = run(start(), {
      type: "addImage",
      id: "img",
      assetId: "asset-1",
      alt: "Diagrama",
      width: 4000,
      height: 3000,
    });

    const element = selectedElement(state);
    expect(element?.width).toBeLessThanOrEqual(state.document.canvas.width * 0.7);
    // 4:3 in, 4:3 out.
    expect((element!.width / element!.height)).toBeCloseTo(4 / 3, 2);
  });

  test("moving and resizing round to whole canvas units", () => {
    const state = run(
      withText(),
      { type: "moveElement", id: "e1", x: 10.6, y: 20.2 },
      { type: "resizeElement", id: "e1", width: 300.7, height: 120.4 },
    );

    expect(selectedElement(state)).toMatchObject({
      x: 11,
      y: 20,
      width: 301,
      height: 120,
    });
  });

  test("a box never shrinks to something that cannot be grabbed again", () => {
    const state = run(withText(), {
      type: "resizeElement",
      id: "e1",
      width: 0,
      height: -50,
    });

    expect(selectedElement(state)).toMatchObject({ width: 16, height: 16 });
  });

  test("a locked element ignores moves, resizes and rotations", () => {
    const locked = run(withText(), { type: "toggleLock", id: "e1" });
    const before = selectedElement(locked);

    const after = run(
      locked,
      { type: "moveElement", id: "e1", x: 999, y: 999 },
      { type: "resizeElement", id: "e1", width: 999, height: 999 },
      { type: "rotateElement", id: "e1", rotation: 45 },
    );

    expect(selectedElement(after)).toEqual(before);
  });

  test("unlocking drops the flag rather than storing `false`", () => {
    const state = run(
      withText(),
      { type: "toggleLock", id: "e1" },
      { type: "toggleLock", id: "e1" },
    );

    expect("locked" in selectedElement(state)!).toBe(false);
  });

  test("text props are patched, not replaced", () => {
    const state = run(withText(), {
      type: "textProps",
      id: "e1",
      props: { weight: 700, align: "center" },
    });

    const element = selectedElement(state) as Extract<PresentationElement, { type: "text" }>;
    expect(element.props).toMatchObject({ text: "Hola", weight: 700, align: "center" });
  });

  test("image props only apply to an image", () => {
    const state = run(withText(), {
      type: "imageProps",
      id: "e1",
      props: { alt: "nope" },
    });

    expect(selectedElement(state)).toEqual(selectedElement(withText()));
  });

  test("stacking is the array order", () => {
    const two = run(
      start(),
      { type: "addText", id: "a", text: "A" },
      { type: "addText", id: "b", text: "B" },
    );
    expect(selectedSlide(two)?.elements.map((element) => element.id)).toEqual(["a", "b"]);

    const front = run(two, { type: "bringToFront", id: "a" });
    expect(selectedSlide(front)?.elements.map((element) => element.id)).toEqual(["b", "a"]);

    const back = run(front, { type: "sendToBack", id: "a" });
    expect(selectedSlide(back)?.elements.map((element) => element.id)).toEqual(["a", "b"]);
  });

  test("deleting clears the selection when it was the one deleted", () => {
    const state = run(withText(), { type: "deleteElement", id: "e1" });

    expect(selectedSlide(state)?.elements).toHaveLength(0);
    expect(state.selectedElementId).toBeNull();
  });

  test("rotation wraps instead of growing without bound", () => {
    const state = run(withText(), { type: "rotateElement", id: "e1", rotation: 725 });

    expect(selectedElement(state)?.rotation).toBe(5);
  });
});

describe("the document as a whole", () => {
  test("both modes are kept, so switching loses nothing", () => {
    const state = run(
      start(),
      { type: "markdown", value: "# Hola" },
      { type: "mode", value: "markdown" },
      { type: "addText", id: "e1", text: "En el lienzo" },
      { type: "mode", value: "slides" },
    );

    expect(state.document.markdown).toBe("# Hola");
    expect(selectedSlide(state)?.elements).toHaveLength(1);
  });

  test("every edit marks the document unsaved, and `saved` clears it", () => {
    const edited = run(start(), { type: "title", value: "Otro" });
    expect(edited.dirty).toBe(true);

    expect(editorReducer(edited, { type: "saved" }).dirty).toBe(false);
  });

  test("selecting is not an edit", () => {
    const state = run(
      editorReducer(withText(), { type: "saved" }),
      { type: "selectElement", id: null },
      { type: "selectSlide", id: "s1" },
    );

    expect(state.dirty).toBe(false);
  });

  test("an edited document still satisfies the contract", () => {
    const state = run(
      start(),
      { type: "title", value: "Capa de enlace" },
      { type: "topic", value: "link-layer" },
      { type: "addText", id: "e1", text: "Tramas" },
      { type: "textProps", id: "e1", props: { color: "primary", mono: true } },
      { type: "rotateElement", id: "e1", rotation: 15 },
      { type: "addSlide", id: "s2" },
      { type: "slideNotes", value: "Preguntar por CSMA/CD" },
    );

    expect(parsePresentationDocument(state.document).ok).toBe(true);
  });

  test("loading a draft resets the selection and the unsaved flag", () => {
    const state = editorReducer(withText(), {
      type: "load",
      document: emptyDocument("Otra", "x1"),
    });

    expect(state.selectedSlideId).toBe("x1");
    expect(state.selectedElementId).toBeNull();
    expect(state.dirty).toBe(false);
  });
});

describe("tables and figures", () => {
  test("a table is born as a rectangular grid inside the stage", () => {
    const state = run(start(), { type: "addTable", id: "t1", rows: 3, columns: 2 });
    const element = selectedElement(state);

    expect(element?.type).toBe("table");
    if (element?.type !== "table") return;

    expect(element.props.rows).toEqual([
      ["", ""],
      ["", ""],
      ["", ""],
    ]);
    expect(element.x).toBeGreaterThanOrEqual(0);
    expect(element.x + element.width).toBeLessThanOrEqual(state.document.canvas.width);
  });

  test("typing in one cell leaves the grid rectangular", () => {
    const state = run(
      start(),
      { type: "addTable", id: "t1", rows: 2, columns: 2 },
      { type: "tableCell", id: "t1", row: 0, column: 1, value: "Bits" },
    );

    const element = selectedElement(state);
    expect(element?.type === "table" && element.props.rows).toEqual([
      ["", "Bits"],
      ["", ""],
    ]);
  });

  test("resizing the grid keeps what is still inside it", () => {
    const state = run(
      start(),
      { type: "addTable", id: "t1", rows: 2, columns: 2 },
      { type: "tableCell", id: "t1", row: 0, column: 0, value: "Campo" },
      { type: "tableCell", id: "t1", row: 1, column: 1, value: "16" },
      { type: "tableSize", id: "t1", rows: 3, columns: 1 },
    );

    const element = selectedElement(state);
    expect(element?.type === "table" && element.props.rows).toEqual([
      ["Campo"],
      [""],
      [""],
    ]);
  });

  test("the document stays valid with every element kind on one slide", () => {
    const state = run(
      start(),
      { type: "addText", id: "e1", text: "Hola" },
      { type: "addTable", id: "t1", rows: 2, columns: 3 },
      { type: "addShape", id: "f1", kind: "arrow" },
      { type: "addShape", id: "f2", kind: "ellipse" },
    );

    expect(parsePresentationDocument(JSON.parse(JSON.stringify(state.document))).ok).toBe(
      true,
    );
  });

  test("a connector is born wide and thin, a solid figure filled", () => {
    const state = run(
      start(),
      { type: "addShape", id: "f1", kind: "line" },
      { type: "addShape", id: "f2", kind: "rect" },
    );

    const [line, rect] = selectedSlide(state)?.elements ?? [];
    expect(line && line.width > line.height).toBe(true);
    expect(line?.type === "shape" && line.props.fill).toBe("none");
    expect(rect?.type === "shape" && rect.props.fill).toBe("primary");
  });
});

describe("the author's notes", () => {
  test("live on the document, not on a slide", () => {
    const state = run(start(), { type: "notes", value: "Empezar con el handshake" });

    expect(state.document.notes).toBe("Empezar con el handshake");
    expect(state.document.slides[0]?.notes).toBeUndefined();
    expect(state.dirty).toBe(true);
  });
});

describe("undo and redo", () => {
  test("a new document has nothing to undo", () => {
    const state = start();

    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(false);
    expect(editorReducer(state, { type: "undo" })).toBe(state);
    expect(editorReducer(state, { type: "redo" })).toBe(state);
  });

  test("undo takes the document back and redo brings it forward", () => {
    const added = withText();
    const undone = editorReducer(added, { type: "undo" });

    expect(undone.document.slides[0]?.elements).toHaveLength(0);
    expect(canRedo(undone)).toBe(true);

    const redone = editorReducer(undone, { type: "redo" });
    expect(redone.document.slides[0]?.elements).toHaveLength(1);
    expect(canRedo(redone)).toBe(false);
  });

  test("a drag is one undo step, not one per pointer event", () => {
    const dragged = run(
      withText(),
      { type: "moveElement", id: "e1", x: 10, y: 10 },
      { type: "moveElement", id: "e1", x: 40, y: 10 },
      { type: "moveElement", id: "e1", x: 90, y: 10 },
    );

    const undone = editorReducer(dragged, { type: "undo" });
    // Back where the element was inserted, not two pixels back.
    expect(selectedElement(undone)?.x).toBe(selectedElement(withText())?.x);
  });

  test("committing a gesture starts a new undo step", () => {
    const state = run(
      withText(),
      { type: "moveElement", id: "e1", x: 10, y: 10 },
      { type: "commit" },
      { type: "moveElement", id: "e1", x: 500, y: 10 },
    );

    expect(selectedElement(editorReducer(state, { type: "undo" }))?.x).toBe(10);
  });

  test("typing coalesces, but a formatting change is its own step", () => {
    const typed = run(
      withText(),
      { type: "textProps", id: "e1", props: { text: "H" } },
      { type: "textProps", id: "e1", props: { text: "Ho" } },
      { type: "textProps", id: "e1", props: { text: "Hol" } },
      { type: "textProps", id: "e1", props: { color: "primary" } },
    );

    const undone = editorReducer(typed, { type: "undo" });
    const element = selectedElement(undone);

    expect(element?.type === "text" && element.props.color).toBe("foreground");
    expect(element?.type === "text" && element.props.text).toBe("Hol");
  });

  test("editing after an undo abandons what was undone", () => {
    const state = run(
      withText(),
      { type: "undo" },
      { type: "addShape", id: "f1", kind: "rect" },
    );

    expect(canRedo(state)).toBe(false);
    expect(state.document.slides[0]?.elements).toHaveLength(1);
  });

  test("undoing past an element's creation moves the selection off it", () => {
    const state = editorReducer(withText(), { type: "undo" });

    expect(state.selectedElementId).toBeNull();
    expect(selectedSlide(state)).toBeDefined();
  });

  test("history is capped, and the oldest step is the one that goes", () => {
    let state = start();
    for (let step = 0; step < 60; step += 1) {
      state = run(
        state,
        { type: "addShape", id: `f${step}`, kind: "rect" },
        { type: "commit" },
      );
    }

    expect(state.past.length).toBeLessThanOrEqual(50);
  });
});
