import { describe, expect, test } from "bun:test";

import {
  exportFilename,
  pdfPageSize,
} from "@/features/presentation-editor/lib/exportFiles";

describe("exportFilename", () => {
  test("slugs the title and keeps the extension", () => {
    expect(exportFilename("Modelo TCP/IP: Capa de Red", "pdf")).toBe(
      "modelo-tcp-ip-capa-de-red.pdf",
    );
  });

  test("drops accents instead of the letters under them", () => {
    expect(exportFilename("Introducción a la conmutación", "md")).toBe(
      "introduccion-a-la-conmutacion.md",
    );
  });

  test("names one slide apart from the deck", () => {
    expect(exportFilename("Subredes", "png", "slide-3")).toBe("subredes-slide-3.png");
  });

  test("falls back when the title has nothing to keep", () => {
    expect(exportFilename("  ¿¡!?  ", "pdf")).toBe("presentation.pdf");
  });
});

describe("pdfPageSize", () => {
  test("keeps the canvas proportions at a fixed width", () => {
    expect(pdfPageSize({ width: 1920, height: 1080 })).toEqual([960, 540]);
    expect(pdfPageSize({ width: 1280, height: 960 })).toEqual([960, 720]);
  });
});
