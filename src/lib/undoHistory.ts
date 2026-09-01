/**
 * Undo/redo as two LIFO stacks around the current value — the same shape as
 * the per-tab navigation history in `src/lib/tabHistory.ts`, where the top of
 * each stack is its last element. Editing pushes the value that was on screen
 * onto `past` and drops `future`, exactly as navigating somewhere new drops
 * the forward stack.
 *
 * Pure and framework-free: the React wrapper is `src/hooks/useUndoHistory.ts`.
 */

/** Past this depth the oldest step is forgotten, so a long session is bounded. */
export const UNDO_LIMIT = 100;

export type UndoHistory<T> = {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  /**
   * The merge key of the edit that produced `present`. Consecutive edits that
   * share one — a resize dragged bit by bit, a name typed letter by letter —
   * collapse into a single undo step instead of one per keystroke.
   */
  readonly mergeKey: string | null;
};

export function createUndoHistory<T>(present: T): UndoHistory<T> {
  return { past: [], present, future: [], mergeKey: null };
}

/**
 * Records a new value. `mergeKey` is `null` for a discrete edit — every one of
 * those is its own step; a non-null key collapses into the step before it when
 * that step carried the same key.
 */
export function pushUndo<T>(
  history: UndoHistory<T>,
  next: T,
  mergeKey: string | null = null,
): UndoHistory<T> {
  if (Object.is(next, history.present)) return history;

  if (mergeKey !== null && mergeKey === history.mergeKey) {
    return { ...history, present: next, future: [] };
  }

  const past = [...history.past, history.present];
  return {
    past: past.length > UNDO_LIMIT ? past.slice(past.length - UNDO_LIMIT) : past,
    present: next,
    future: [],
    mergeKey,
  };
}

export function canUndo<T>(history: UndoHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: UndoHistory<T>): boolean {
  return history.future.length > 0;
}

/**
 * Steps back one edit. The key is cleared so the next edit starts a fresh
 * step: typing again after an undo must not merge into what was just restored.
 */
export function undo<T>(history: UndoHistory<T>): UndoHistory<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [...history.future, history.present],
    mergeKey: null,
  };
}

export function redo<T>(history: UndoHistory<T>): UndoHistory<T> {
  const next = history.future.at(-1);
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(0, -1),
    mergeKey: null,
  };
}
