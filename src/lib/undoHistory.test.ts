import { describe, expect, test } from "bun:test";

import {
  canRedo,
  canUndo,
  createUndoHistory,
  pushUndo,
  redo,
  undo,
  UNDO_LIMIT,
} from "@/lib/undoHistory";

describe("undoHistory", () => {
  test("starts with nothing to undo or redo", () => {
    const history = createUndoHistory("a");
    expect(history.present).toBe("a");
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  test("pushing the same value changes nothing", () => {
    const history = createUndoHistory("a");
    expect(pushUndo(history, "a")).toBe(history);
  });

  test("undo walks back through the pushed values", () => {
    let history = pushUndo(pushUndo(createUndoHistory("a"), "b"), "c");

    history = undo(history);
    expect(history.present).toBe("b");
    history = undo(history);
    expect(history.present).toBe("a");
    expect(canUndo(history)).toBe(false);
    expect(undo(history).present).toBe("a");
  });

  test("redo walks forward again", () => {
    let history = pushUndo(pushUndo(createUndoHistory("a"), "b"), "c");
    history = undo(undo(history));

    expect(canRedo(history)).toBe(true);
    history = redo(history);
    expect(history.present).toBe("b");
    history = redo(history);
    expect(history.present).toBe("c");
    expect(canRedo(history)).toBe(false);
    expect(redo(history).present).toBe("c");
  });

  test("a new edit drops the redo stack", () => {
    let history = pushUndo(pushUndo(createUndoHistory("a"), "b"), "c");
    history = pushUndo(undo(history), "d");

    expect(canRedo(history)).toBe(false);
    expect(history.present).toBe("d");
    expect(undo(history).present).toBe("b");
  });

  test("consecutive edits sharing a merge key are one step", () => {
    let history = createUndoHistory("");
    for (const value of ["T", "TC", "TCP"]) history = pushUndo(history, value, "name");

    expect(history.past).toEqual([""]);
    expect(undo(history).present).toBe("");
  });

  test("a different merge key starts a new step", () => {
    let history = pushUndo(createUndoHistory("a"), "b", "name");
    history = pushUndo(history, "c", "length");

    expect(undo(history).present).toBe("b");
  });

  test("a discrete edit never merges into the one before it", () => {
    const history = pushUndo(pushUndo(createUndoHistory("a"), "b"), "c");
    expect(history.past).toEqual(["a", "b"]);
  });

  test("typing after an undo starts its own step", () => {
    let history = pushUndo(createUndoHistory("a"), "b", "name");
    history = pushUndo(undo(history), "c", "name");

    expect(undo(history).present).toBe("a");
  });

  test("the past is capped, oldest first", () => {
    let history = createUndoHistory(0);
    for (let value = 1; value <= UNDO_LIMIT + 10; value += 1) {
      history = pushUndo(history, value);
    }

    expect(history.past.length).toBe(UNDO_LIMIT);
    expect(history.past[0]).toBe(10);
  });
});
