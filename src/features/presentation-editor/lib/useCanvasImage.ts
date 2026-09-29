import { useEffect, useState } from "react";

/**
 * An uploaded image as the object Konva draws: a loaded `HTMLImageElement`.
 *
 * Konva has no `<img>` to hand it a URL — it needs decoded pixels — so every
 * image element on the canvas loads its own and re-renders when it arrives. The
 * cache is module-level and keyed by URL because a deck reuses the same picture
 * across slides, and the editor re-mounts a node every time the selection
 * changes: reloading there would flicker.
 */
const cache = new Map<string, HTMLImageElement>();

export function useCanvasImage(url: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(() => cache.get(url) ?? null);

  useEffect(() => {
    const cached = cache.get(url);
    if (cached) {
      setImage(cached);
      return;
    }

    let cancelled = false;
    const loading = new window.Image();

    loading.onload = () => {
      cache.set(url, loading);
      if (!cancelled) setImage(loading);
    };
    // A broken asset leaves the node empty rather than throwing inside a draw.
    loading.onerror = () => {
      if (!cancelled) setImage(null);
    };
    loading.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return image;
}

/**
 * Loads an image into the same cache ahead of a render that cannot wait for
 * it — an export draws once, so every picture has to be decoded before the
 * stage is built. A broken asset resolves too: it is simply left out, as on
 * the canvas.
 */
export function preloadCanvasImage(url: string): Promise<void> {
  if (cache.has(url)) return Promise.resolve();

  return new Promise((resolve) => {
    const loading = new window.Image();
    loading.onload = () => {
      cache.set(url, loading);
      resolve();
    };
    loading.onerror = () => resolve();
    loading.src = url;
  });
}
