import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/clerk-react";

import type { ReadingProgress } from "@/lib/presentations/contract";
import { listProgress } from "@/services/presentations";
import { getTheoryMenu, type TheoryMenuSection } from "@/services/theory";

/**
 * The Theory menu, shared by everything that renders it.
 *
 * It is one module-level cache and not a per-component `useEffect` because the
 * sidebar is mounted once for the whole app while the admin panel edits the
 * same data in a tab: after a change the panel calls `refreshTheoryMenu()` and
 * the sidebar re-renders, with no reload and no message passing between tabs.
 *
 * This is the pattern `src/services/` describes for server state, minus the
 * library — the app has no query cache wired up yet, and one subscribable cache
 * for one global read is not worth a dependency.
 */

const EMPTY: TheoryMenuSection[] = [];

let cache: TheoryMenuSection[] | null = null;
let inFlight: Promise<void> | null = null;

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The same array reference until a load replaces it, as `useSyncExternalStore` requires. */
function snapshot(): TheoryMenuSection[] | null {
  return cache;
}

function publish(sections: TheoryMenuSection[]): void {
  cache = sections;
  for (const listener of listeners) listener();
}

/**
 * Reloads the menu for every subscriber. Concurrent calls share one request —
 * the admin panel fires this after each edit, and a burst of them must not
 * become a burst of fetches.
 */
export function refreshTheoryMenu(): Promise<void> {
  inFlight ??= getTheoryMenu()
    .then(publish)
    .catch((error: unknown) => {
      // A failed menu is an empty Theory group, not a broken app: the pages
      // themselves are reachable by URL and the sidebar retries on next mount.
      console.error("Could not load the Theory menu", error);
      cache ??= EMPTY;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** The admin-built sections of the Theory group, and whether they have loaded. */
export function useTheoryMenu(): {
  sections: TheoryMenuSection[];
  loaded: boolean;
} {
  const sections = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    if (cache === null) void refreshTheoryMenu();
  }, []);

  return { sections: sections ?? EMPTY, loaded: sections !== null };
}

/**
 * How far this reader has got through each published presentation, by slug.
 *
 * One request for the whole sidebar — the badge next to a Theory entry is the
 * point of storing a single percentage per presentation, so it has to be
 * cheap. A signed-out visitor has no progress at all, so nothing is asked for.
 */
export function useReadingProgressIndex(): Record<string, ReadingProgress> {
  const { isSignedIn } = useAuth();
  const [progress, setProgress] = useState<Record<string, ReadingProgress>>({});

  useEffect(() => {
    if (!isSignedIn) {
      setProgress({});
      return;
    }

    let cancelled = false;
    listProgress()
      .then((entries) => {
        if (cancelled) return;
        setProgress(Object.fromEntries(entries.map((entry) => [entry.slug, entry])));
      })
      .catch((error: unknown) => {
        console.error("Could not read the reading progress", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  return progress;
}
