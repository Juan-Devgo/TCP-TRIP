import { describe, expect, test } from "bun:test";

import { highlightCode, isHighlightable, parseHighlight } from "@/lib/highlight";

/** The source back out of a tree: highlighting must never change the code. */
function text(nodes: ReturnType<typeof parseHighlight>): string {
  return nodes
    .map((node) => (typeof node === "string" ? node : text(node.children)))
    .join("");
}

describe("parseHighlight", () => {
  test("reads nested spans and unescapes the text", () => {
    expect(
      parseHighlight('<span class="hljs-title class_">A&lt;B&gt;</span> &amp; <span class="a"><span class="b">x</span></span>'),
    ).toEqual([
      { className: "hljs-title class_", children: ["A<B>"] },
      " & ",
      { className: "a", children: [{ className: "b", children: ["x"] }] },
    ]);
  });

  test("never turns markup-looking text into an element", () => {
    expect(parseHighlight("&lt;script&gt;alert(1)&lt;/script&gt;")).toEqual([
      "<script>alert(1)</script>",
    ]);
  });
});

describe("highlightCode", () => {
  test("marks the keywords of a known language", () => {
    const nodes = highlightCode("def f():\n    return 1", "python");
    expect(nodes).not.toBeNull();
    expect(JSON.stringify(nodes)).toContain("hljs-keyword");
  });

  test("gives back exactly the source it was handed", () => {
    const source = 'curl -H "Host: a&b" <in >out\n# done';
    expect(text(highlightCode(source, "bash") ?? [])).toBe(source);
  });

  test("resolves aliases and refuses unknown languages", () => {
    expect(isHighlightable("sh")).toBe(true);
    expect(isHighlightable("html")).toBe(true);
    expect(highlightCode("x", "brainfuck")).toBeNull();
  });
});
