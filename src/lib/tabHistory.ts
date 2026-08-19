/**
 * Per-tab navigation history: two LIFO stacks around the current path, the way
 * a browser tab behaves. The top of each stack is its last element. The whole
 * structure lives only as long as its tab — closing the tab discards it.
 */
export type TabHistory = {
  readonly back: readonly string[];
  readonly current: string;
  readonly forward: readonly string[];
};

export function createTabHistory(path: string): TabHistory {
  return { back: [], current: path, forward: [] };
}

/** Navigating somewhere new drops the forward stack, as in a browser. */
export function pushPath(history: TabHistory, path: string): TabHistory {
  if (path === history.current) return history;
  return { back: [...history.back, history.current], current: path, forward: [] };
}

export function canGoBack(history: TabHistory): boolean {
  return history.back.length > 0;
}

export function canGoForward(history: TabHistory): boolean {
  return history.forward.length > 0;
}

export function goBack(history: TabHistory): TabHistory {
  const previous = history.back.at(-1);
  if (previous === undefined) return history;
  return {
    back: history.back.slice(0, -1),
    current: previous,
    forward: [...history.forward, history.current],
  };
}

export function goForward(history: TabHistory): TabHistory {
  const next = history.forward.at(-1);
  if (next === undefined) return history;
  return {
    back: [...history.back, history.current],
    current: next,
    forward: history.forward.slice(0, -1),
  };
}
