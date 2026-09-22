import { describe, expect, test } from "bun:test";

import {
  MAX_MARKDOWN_LENGTH,
  MAX_PRESENTATION_NOTES_LENGTH,
  MAX_TABLE_COLUMNS,
  withoutPrivateNotes,
  MAX_SLIDES,
  PRESENTATION_SCHEMA_VERSION,
  emptyPresentationDocument,
  isWithinPresentationLimit,
  normalizeProgressPercent,
  parsePresentationDocument,
  scrollProgressPercent,
  slideProgressPercent,
  slugifyTitle,
  type PresentationDocument,
} from "@/lib/presentations/contract";

function document(overrides: Partial<PresentationDocument> = {}): PresentationDocument {
  return {
    version: PRESENTATION_SCHEMA_VERSION,
    title: "Capa de transporte",
    topic: "transport-layer",
    mode: "slides",
    markdown: "# Hola",
    notes: "",
    canvas: { width: 1920, height: 1080 },
    slides: [
      {
        id: "s1",
        elements: [
          {
            id: "e1",
            type: "text",
            x: 100,
            y: 100,
            width: 400,
            height: 120,
            rotation: 0,
            props: { text: "Hola", size: 48, weight: 700, align: "left", color: "foreground" },
          },
        ],
      },
    ],
    ...overrides,
  };
}

/** What the route does: JSON in, parsed document out. */
function parse(value: unknown) {
  return parsePresentationDocument(JSON.parse(JSON.stringify(value)) as unknown);
}

describe("parsePresentationDocument", () => {
  test("accepts a document the editor produces", () => {
    const result = parse(document());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.slides[0]?.elements).toHaveLength(1);
  });

  test("accepts the empty document the editor starts from", () => {
    expect(parse(emptyPresentationDocument("Nueva")).ok).toBe(true);
  });

  test("trims the title and refuses an empty one", () => {
    const trimmed = parse(document({ title: "  Capa de red  " }));
    expect(trimmed.ok && trimmed.document.title).toBe("Capa de red");

    expect(parse(document({ title: "   " }))).toMatchObject({ issue: "title" });
  });

  test("refuses a version from the future rather than half-reading it", () => {
    expect(parse(document({ version: PRESENTATION_SCHEMA_VERSION + 1 }))).toMatchObject({
      issue: "version",
    });
  });

  test("refuses an unknown topic, mode or canvas", () => {
    expect(parse({ ...document(), topic: "quantum-layer" })).toMatchObject({ issue: "topic" });
    expect(parse({ ...document(), mode: "video" })).toMatchObject({ issue: "mode" });
    expect(parse(document({ canvas: { width: 1000, height: 1000 } }))).toMatchObject({
      issue: "canvas",
    });
  });

  test("refuses markdown past the cap", () => {
    expect(parse(document({ markdown: "x".repeat(MAX_MARKDOWN_LENGTH + 1) }))).toMatchObject({
      issue: "markdown",
    });
  });

  test("refuses more slides than the cap", () => {
    const slides = Array.from({ length: MAX_SLIDES + 1 }, (_, index) => ({
      id: `s${index}`,
      elements: [],
    }));

    expect(parse(document({ slides }))).toMatchObject({ issue: "slideCount" });
  });

  test("refuses a coordinate that is not a finite number", () => {
    const broken = document();
    const element = { ...broken.slides[0]!.elements[0]!, x: Number.NaN };

    expect(
      parsePresentationDocument({
        ...broken,
        slides: [{ id: "s1", elements: [element] }],
      }),
    ).toMatchObject({ issue: "elementBox" });
  });

  test("refuses a raw colour, because a slide has to survive the dark theme", () => {
    const element = {
      ...document().slides[0]!.elements[0]!,
      props: { text: "Hola", size: 48, weight: 700, align: "left", color: "#ff0000" },
    };

    expect(
      parsePresentationDocument({
        ...document(),
        slides: [{ id: "s1", elements: [element] }],
      }),
    ).toMatchObject({ issue: "elementProps" });
  });

  test("refuses an unknown element type", () => {
    expect(
      parsePresentationDocument({
        ...document(),
        slides: [
          {
            id: "s1",
            elements: [
              {
                id: "e1",
                type: "video",
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                rotation: 0,
                props: {},
              },
            ],
          },
        ],
      }),
    ).toMatchObject({ issue: "element" });
  });

  test("an image element needs an asset id and alt text", () => {
    const image = {
      id: "e1",
      type: "image" as const,
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      rotation: 0,
      props: { assetId: "asset-1", alt: "Diagrama", fit: "contain" as const },
    };

    const good = parsePresentationDocument({
      ...document(),
      slides: [{ id: "s1", elements: [image] }],
    });
    expect(good.ok).toBe(true);

    const noAsset = parsePresentationDocument({
      ...document(),
      slides: [{ id: "s1", elements: [{ ...image, props: { alt: "x", fit: "contain" } }] }],
    });
    expect(noAsset).toMatchObject({ issue: "elementProps" });
  });

  test("drops nothing a slide legitimately carries", () => {
    const result = parse(
      document({
        slides: [
          { id: "s1", title: "Portada", notes: "Saludar", background: "card", elements: [] },
        ],
      }),
    );

    expect(result.ok && result.document.slides[0]).toEqual({
      id: "s1",
      title: "Portada",
      notes: "Saludar",
      background: "card",
      elements: [],
    });
  });
});

describe("isWithinPresentationLimit", () => {
  test("measures bytes, not characters", () => {
    expect(isWithinPresentationLimit(JSON.stringify(document()))).toBe(true);
    expect(isWithinPresentationLimit("á".repeat(1024 * 1024))).toBe(false);
  });
});

describe("slugifyTitle", () => {
  test("keeps accented Spanish readable", () => {
    expect(slugifyTitle("Introducción a TCP/IP")).toBe("introduccion-a-tcp-ip");
  });

  test("falls back when a title has nothing sluggable", () => {
    expect(slugifyTitle("¿?¡!")).toBe("presentacion");
  });
});

describe("reading progress", () => {
  test("a percentage is clamped and rounded, whatever a client sends", () => {
    expect(normalizeProgressPercent(42.4)).toBe(42);
    expect(normalizeProgressPercent(-5)).toBe(0);
    expect(normalizeProgressPercent(180)).toBe(100);
    expect(normalizeProgressPercent("40")).toBeNull();
    expect(normalizeProgressPercent(Number.NaN)).toBeNull();
  });

  test("presentation mode counts the slide reached, not the ones behind it", () => {
    expect(slideProgressPercent(0, 4)).toBe(25);
    expect(slideProgressPercent(3, 4)).toBe(100);
    // An empty deck has nothing to read.
    expect(slideProgressPercent(0, 0)).toBe(0);
  });

  test("the reading view counts scrolled height, and a short page is read", () => {
    expect(scrollProgressPercent(0, 2000, 1000)).toBe(0);
    expect(scrollProgressPercent(500, 2000, 1000)).toBe(50);
    expect(scrollProgressPercent(1000, 2000, 1000)).toBe(100);
    // Nothing to scroll: the whole thing is already on screen.
    expect(scrollProgressPercent(0, 800, 1000)).toBe(100);
  });
});

describe("tables and figures", () => {
  const table = {
    id: "t1",
    type: "table" as const,
    x: 80,
    y: 80,
    width: 900,
    height: 300,
    rotation: 0,
    props: {
      rows: [
        ["Campo", "Bits"],
        ["Puerto origen", "16"],
      ],
      header: true,
      size: 32,
      color: "foreground",
    },
  };

  test("accepts a rectangular table and keeps its cells", () => {
    const result = parse(document({ slides: [{ id: "s1", elements: [table] }] }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      const element = result.document.slides[0]?.elements[0];
      expect(element?.type).toBe("table");
      expect(element?.type === "table" && element.props.rows).toEqual([
        ["Campo", "Bits"],
        ["Puerto origen", "16"],
      ]);
    }
  });

  test("refuses a ragged table: the renderer divides the box by one column count", () => {
    const ragged = {
      ...table,
      props: { ...table.props, rows: [["Campo", "Bits"], ["Puerto origen"]] },
    };

    expect(parse(document({ slides: [{ id: "s1", elements: [ragged] }] }))).toMatchObject({
      issue: "elementProps",
    });
  });

  test("refuses a table wider than the column cap, or with no rows", () => {
    const wide = {
      ...table,
      props: {
        ...table.props,
        rows: [Array.from({ length: MAX_TABLE_COLUMNS + 1 }, () => "x")],
      },
    };
    const empty = { ...table, props: { ...table.props, rows: [] } };

    expect(parse(document({ slides: [{ id: "s1", elements: [wide] }] }))).toMatchObject({
      issue: "elementProps",
    });
    expect(parse(document({ slides: [{ id: "s1", elements: [empty] }] }))).toMatchObject({
      issue: "elementProps",
    });
  });

  test("a figure is a known kind painted with theme tokens", () => {
    const arrow = {
      id: "f1",
      type: "shape" as const,
      x: 0,
      y: 0,
      width: 400,
      height: 8,
      rotation: 0,
      props: { kind: "arrow" as const, fill: "none", stroke: "primary", strokeWidth: 6 },
    };

    expect(parse(document({ slides: [{ id: "s1", elements: [arrow] }] })).ok).toBe(true);

    // Spread rather than the typed fixture: these are the values a client
    // could send and the types could not have produced.
    const hex = { ...arrow, props: { ...arrow.props, stroke: "#ff0000" } };
    expect(parse({ ...document(), slides: [{ id: "s1", elements: [hex] }] })).toMatchObject({
      issue: "elementProps",
    });

    const unknown = { ...arrow, props: { ...arrow.props, kind: "spiral" } };
    expect(
      parse({ ...document(), slides: [{ id: "s1", elements: [unknown] }] }),
    ).toMatchObject({ issue: "elementProps" });
  });
});

describe("the author's notes", () => {
  test("a document written before notes existed reads back with none", () => {
    const { notes: _dropped, ...older } = document();
    const result = parse(older);

    expect(result.ok && result.document.notes).toBe("");
  });

  test("refuses notes longer than the column takes", () => {
    expect(
      parse(document({ notes: "n".repeat(MAX_PRESENTATION_NOTES_LENGTH + 1) })),
    ).toMatchObject({ issue: "notes" });
  });

  test("the published copy carries neither kind of note", () => {
    const stripped = withoutPrivateNotes(
      document({
        notes: "Plan de la clase",
        slides: [{ id: "s1", notes: "Saludar", title: "Portada", elements: [] }],
      }),
    );

    expect(stripped.notes).toBe("");
    expect(stripped.slides[0]).toEqual({ id: "s1", title: "Portada", elements: [] });
    // Still a valid document once the notes are gone.
    expect(parse(stripped).ok).toBe(true);
  });
});
