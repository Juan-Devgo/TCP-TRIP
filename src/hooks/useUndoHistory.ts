import { useCallback, useMemo, useReducer } from "react";

import {
  canRedo,
  canUndo,
  createUndoHistory,
  pushUndo,
  redo,
  undo,
  type UndoHistory,
} from "@/lib/undoHistory";

/** What `set` accepts, so it reads like `useState`'s setter. */
type Updater<T> = T | ((current: T) => T);

type Action<T> =
  | { type: "set"; updater: Updater<T>; mergeKey: string | null }
  | { type: "undo" }
  | { type: "redo" };

function reducer<T>(history: UndoHistory<T>, action: Action<T>): UndoHistory<T> {
  switch (action.type) {
    case "set": {
      const next =
        typeof action.updater === "function"
          ? (action.updater as (current: T) => T)(history.present)
          : action.updater;
      return pushUndo(history, next, action.mergeKey);
    }
    case "undo":
      return undo(history);
    case "redo":
      return redo(history);
  }
}

export type UndoState<T> = {
  state: T;
  /**
   * Records an edit. Pass a `mergeKey` for a stream of small edits that is one
   * change to the reader — a resize dragged bit by bit, a name typed letter by
   * letter — and consecutive edits carrying it collapse into one undo step.
   */
  set: (updater: Updater<T>, mergeKey?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

/**
 * `useState` with an undo/redo stack behind it, over the pure history in
 * `src/lib/undoHistory.ts`.
 */
export function useUndoHistory<T>(initial: T | (() => T)): UndoState<T> {
  const [history, dispatch] = useReducer(
    reducer as (history: UndoHistory<T>, action: Action<T>) => UndoHistory<T>,
    initial,
    (value) =>
      createUndoHistory(
        typeof value === "function" ? (value as () => T)() : (value as T),
      ),
  );

  const set = useCallback(
    (updater: Updater<T>, mergeKey?: string) =>
      dispatch({ type: "set", updater, mergeKey: mergeKey ?? null }),
    [],
  );
  const stepBack = useCallback(() => dispatch({ type: "undo" }), []);
  const stepForward = useCallback(() => dispatch({ type: "redo" }), []);

  return useMemo(
    () => ({
      state: history.present,
      set,
      undo: stepBack,
      redo: stepForward,
      canUndo: canUndo(history),
      canRedo: canRedo(history),
    }),
    [history, set, stepBack, stepForward],
  );
}
