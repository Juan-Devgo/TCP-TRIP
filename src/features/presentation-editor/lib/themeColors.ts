import { useEffect, useMemo, useState } from "react";

import {
  SHAPE_COLOR_TOKENS,
  SLIDE_BACKGROUND_TOKENS,
  TEXT_COLOR_TOKENS,
} from "@/lib/presentations/contract";

/**
 * The theme's tokens as values a `<canvas>` can paint with.
 *
 * Every other renderer in the app writes `var(--color-primary)` and lets CSS
 * resolve it. Konva cannot: it paints into a bitmap, where a colour has to be a
 * literal. So this reads the computed values off `:root` once, and again
 * whenever the theme class flips — which is the whole reason slides store a
 * **token name** and not a hex value in the first place.
 *
 * The values come out as authored (`oklch(...)` for the neutral scale, hex for
 * the brand colours); both are colours the canvas accepts.
 */
const COLOR_TOKENS = [
  ...new Set<string>([
    ...TEXT_COLOR_TOKENS,
    ...SLIDE_BACKGROUND_TOKENS,
    ...SHAPE_COLOR_TOKENS,
    // Not element colours: the grid, the rulers and the selection draw with
    // these, and they have to follow the theme too.
    "border",
    "muted-foreground",
  ]),
];

export type ThemePaint = {
  /** A token name — anything else falls back to the main text colour. */
  color: (token: string) => string;
  /** The family a `Konva.Text` needs, matching what the DOM stage would use. */
  font: (mono: boolean) => string;
};

type Resolved = { colors: Record<string, string>; sans: string; mono: string };

/** Fallbacks for a first render (or a test) with no document to measure. */
const BLIND: Resolved = { colors: {}, sans: "sans-serif", mono: "monospace" };

function resolve(): Resolved {
  if (typeof window === "undefined") return BLIND;

  const style = window.getComputedStyle(window.document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim();

  return {
    colors: Object.fromEntries(
      COLOR_TOKENS.map((token) => [token, read(`--color-${token}`)]),
    ),
    sans: read("--font-sans") || BLIND.sans,
    mono: read("--font-mono") || BLIND.mono,
  };
}

/** A theme an export can be drawn in, whatever the page is showing. */
export type PaintTheme = "light" | "dark";

/**
 * The palette of a theme the page may not be in — an export is drawn light on
 * a dark screen, or the other way round.
 *
 * A probe element carrying the theme class re-declares the neutral variables
 * (`.light` and `.dark` both set `--background`, `--muted` …), so reading them
 * off the probe gives that theme's values. The `--color-*` names cannot be
 * read there: they are declared once on `:root` as `var(--background)` and
 * inherited already substituted. So a token is taken from the probe only when
 * `:root` maps it onto its own neutral variable; the brand colours are
 * hardcoded and identical in both themes.
 */
function resolveFor(theme: PaintTheme): Resolved {
  if (typeof window === "undefined") return BLIND;

  const root = window.getComputedStyle(window.document.documentElement);
  const probe = window.document.createElement("div");
  probe.className = theme;
  probe.hidden = true;
  window.document.body.append(probe);

  try {
    const style = window.getComputedStyle(probe);
    const read = (from: CSSStyleDeclaration, name: string) =>
      from.getPropertyValue(name).trim();

    return {
      colors: Object.fromEntries(
        COLOR_TOKENS.map((token) => {
          const mapped = read(root, `--color-${token}`);
          const neutral = read(root, `--${token}`);
          return [
            token,
            neutral !== "" && neutral === mapped ? read(style, `--${token}`) : mapped,
          ];
        }),
      ),
      sans: read(root, "--font-sans") || BLIND.sans,
      mono: read(root, "--font-mono") || BLIND.mono,
    };
  } finally {
    probe.remove();
  }
}

function paintFrom(resolved: Resolved): ThemePaint {
  return {
    color: (token) => resolved.colors[token] || resolved.colors["foreground"] || "#000000",
    font: (mono) => (mono ? resolved.mono : resolved.sans),
  };
}

/** A fixed theme's palette, read once — what an export draws with. */
export function themePaint(theme: PaintTheme): ThemePaint {
  return paintFrom(resolveFor(theme));
}

export function useThemeColors(): ThemePaint {
  const [paint, setPaint] = useState<Resolved>(BLIND);

  useEffect(() => {
    setPaint(resolve());

    // Dark mode is a class on the root element in this app, so that is the one
    // thing to watch — no polling, no listener on the OS setting.
    const observer = new MutationObserver(() => setPaint(resolve()));
    observer.observe(window.document.documentElement, { attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return useMemo(() => paintFrom(paint), [paint]);
}
