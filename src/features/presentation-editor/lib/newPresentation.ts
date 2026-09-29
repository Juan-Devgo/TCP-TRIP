import { useSyncExternalStore } from "react";

/**
 * "File ▸ New presentation", as a signal the New tab listens to.
 *
 * The blank editor lives in its own tab (`/teacher/presentations/new`), and
 * inactive tabs stay mounted — so asking for a new presentation from a draft
 * opened in "Mis Presentaciones" has to reach an editor that is already there,
 * with whatever it holds. A counter is all it takes: every request bumps it,
 * and the New tab starts over (asking first if its work is unsaved).
 */
let requests = 0;
const listeners = new Set<() => void>();

export function requestNewPresentation(): void {
  requests += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNewPresentationRequests(): number {
  return useSyncExternalStore(subscribe, () => requests);
}
