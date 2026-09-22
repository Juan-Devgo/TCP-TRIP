import { useCallback, useEffect, useRef, useState } from "react";

import {
  getProgress,
  PresentationApiError,
  saveProgress,
} from "@/services/presentations";
import type { ReadingProgress } from "@/lib/presentations/contract";

/**
 * How often progress may reach the server while someone is scrolling. A scroll
 * event fires dozens of times a second; a PUT per event would be a DoS on our
 * own API for information that is only interesting once.
 */
const FLUSH_MS = 4000;

/**
 * Tracks how far the reader has got, in whichever view is open.
 *
 * The hook takes a **percentage** and nothing else, which is what makes the
 * reading view and presentation mode interchangeable: one measures scrolled
 * height, the other the slide reached, and the row behind them is the same.
 *
 * Three things it deliberately does:
 *
 * - **Throttles.** `report` is called freely; the network sees at most one
 *   write every `FLUSH_MS`, plus a final one when the view closes.
 * - **Never goes backwards.** The server keeps the furthest point reached, and
 *   so does the local mirror, so the badge cannot flicker down when a reader
 *   scrolls back up to re-read something.
 * - **Fails quietly.** A signed-out reader gets a 401 on the first call and the
 *   hook stops trying. Losing progress is a shame; an error toast over a
 *   lecture a student is reading is worse.
 */
export function useReadingProgress(slug: string | null, enabled: boolean) {
  const [progress, setProgress] = useState<ReadingProgress | null>(null);

  /** The furthest point seen locally, and whether it still needs sending. */
  const pending = useRef<{ percent: number; position: string } | null>(null);
  const highest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  // Where this reader left off, so the view can offer to resume.
  useEffect(() => {
    if (!slug || !enabled) return;

    let cancelled = false;
    stopped.current = false;
    highest.current = 0;

    getProgress(slug)
      .then((saved) => {
        if (cancelled) return;
        setProgress(saved);
        highest.current = saved.percent;
      })
      .catch((error: unknown) => {
        // 401 is the ordinary answer for a signed-out reader: nothing to track.
        if (error instanceof PresentationApiError && error.isUnauthenticated) {
          stopped.current = true;
          return;
        }
        console.error("Could not read the reading progress", error);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, enabled]);

  const flush = useCallback(async () => {
    const next = pending.current;
    if (!slug || !next || stopped.current) return;

    pending.current = null;
    try {
      const saved = await saveProgress(slug, next.percent, next.position);
      setProgress(saved);
      highest.current = Math.max(highest.current, saved.percent);
    } catch (error) {
      if (error instanceof PresentationApiError && error.isUnauthenticated) {
        // Stop asking: the reader is not signed in.
        stopped.current = true;
        return;
      }
      console.error("Could not save the reading progress", error);
    }
  }, [slug]);

  const report = useCallback(
    (percent: number, position: string) => {
      if (!slug || !enabled || stopped.current) return;
      if (percent <= highest.current && pending.current === null) return;

      highest.current = Math.max(highest.current, percent);
      pending.current = { percent: highest.current, position };

      timer.current ??= setTimeout(() => {
        timer.current = null;
        void flush();
      }, FLUSH_MS);
    },
    [slug, enabled, flush],
  );

  // Whatever is still pending when the reader leaves is sent immediately —
  // closing the tab is exactly when the last position matters most.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      void flush();
    },
    [flush],
  );

  return { progress, report };
}
