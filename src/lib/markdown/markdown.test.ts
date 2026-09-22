import { describe, expect, test } from "bun:test";

import {
  isSafeHref,
  markdownToText,
  parseInline,
  parseMarkdown,
} from "@/lib/markdown/markdown";

describe("parseInline", () => {
  test("reads bold, italic and code", () => {
    expect(parseInline("un **campo** en *cursiva* con `0x45`")).toEqual([
      { kind: "text", text: "un " },
      { kind: "strong", text: "campo" },
      { kind: "text", text: " en " },
      { kind: "em", text: "cursiva" },
      { kind: "text", text: " con " },
      { kind: "code", text: "0x45" },
    ]);
  });

  test("code wins over emphasis inside it", () => {
    expect(parseInline("`**no** es negrita`")).toEqual([
      { kind: "code", text: "**no** es negrita" },
    ]);
  });

  test("keeps a link's words but refuses an unsafe destination", () => {
    expect(parseInline("[RFC 768](https://www.rfc-editor.org/rfc/rfc768)")).toEqual([
      { kind: "link", text: "RFC 768", href: "https://www.rfc-editor.org/rfc/rfc768" },
    ]);

    // The destination is what is dropped; the text a teacher wrote stays.
    // (A URL is read up to the first `)`, as in every other Markdown reader,
    // so the sample avoids nested parentheses.)
    expect(parseInline("[pulsa aquí](javascript:alert)")).toEqual([
      { kind: "text", text: "pulsa aquí" },
    ]);
  });

  test("markup that is not supported stays as literal text", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([
      { kind: "text", text: "<script>alert(1)</script>" },
    ]);
  });
});

describe("isSafeHref", () => {
  test("only http, https and mailto", () => {
    expect(isSafeHref("https://example.org")).toBe(true);
    expect(isSafeHref("http://example.org")).toBe(true);
    expect(isSafeHref("mailto:alguien@uq.edu.co")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>")).toBe(false);
    expect(isSafeHref("/interno")).toBe(false);
  });
});

describe("parseMarkdown", () => {
  test("headings, paragraphs and rules", () => {
    const blocks = parseMarkdown("# Capa de transporte\n\nTCP y UDP.\n\n---\n");

    expect(blocks.map((block) => block.kind)).toEqual(["heading", "paragraph", "rule"]);
    expect(blocks[0]).toMatchObject({ level: 1 });
  });

  test("a paragraph joins its wrapped lines", () => {
    const blocks = parseMarkdown("una línea\ny su continuación");

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: "paragraph",
      content: [{ kind: "text", text: "una línea y su continuación" }],
    });
  });

  test("bulleted and numbered lists", () => {
    const blocks = parseMarkdown("- uno\n- dos\n\n1. primero\n2. segundo");

    expect(blocks[0]).toMatchObject({ kind: "list", ordered: false });
    expect(blocks[1]).toMatchObject({ kind: "list", ordered: true });
    expect((blocks[0] as { items: unknown[] }).items).toHaveLength(2);
  });

  test("a fenced block keeps its lines and language", () => {
    const blocks = parseMarkdown("```sh\nbun test\nbun run dev\n```");

    expect(blocks[0]).toEqual({
      kind: "code",
      language: "sh",
      text: "bun test\nbun run dev",
    });
  });

  test("an unclosed fence still shows what is in it", () => {
    const blocks = parseMarkdown("```\nsin cerrar");

    expect(blocks[0]).toMatchObject({ kind: "code", text: "sin cerrar" });
  });

  test("a blockquote joins its lines", () => {
    const blocks = parseMarkdown("> primera\n> segunda");

    expect(blocks[0]).toMatchObject({ kind: "quote" });
  });

  test("an empty document is no blocks, not one empty paragraph", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("\n\n  \n")).toEqual([]);
  });
});

describe("markdownToText", () => {
  test("flattens a document to its words", () => {
    expect(markdownToText("# Título\n\nUn **campo** de 8 bits.\n\n- uno\n- dos")).toBe(
      "Título\nUn campo de 8 bits.\nuno dos",
    );
  });
});
