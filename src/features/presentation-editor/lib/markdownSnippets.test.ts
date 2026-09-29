import { describe, expect, test } from "bun:test";

import {
  continueList,
  insertSnippet,
  type MarkdownSnippet,
} from "@/features/presentation-editor/lib/markdownSnippets";

/** What the component does: replace the value, then set the caret. */
function apply(value: string, selection: [number, number], snippet: MarkdownSnippet) {
  const edit = insertSnippet(value, { start: selection[0], end: selection[1] }, snippet);

  return {
    ...edit,
    /** The text the author would see selected afterwards. */
    selected: edit.value.slice(edit.selection.start, edit.selection.end),
  };
}

describe("wrapping markers", () => {
  test("bold wraps the selection and keeps it selected", () => {
    const result = apply("capa de red", [0, 4], "bold");

    expect(result.value).toBe("**capa** de red");
    expect(result.selected).toBe("capa");
  });

  test("with nothing selected the caret lands between the markers", () => {
    const result = apply("", [0, 0], "italic");

    expect(result.value).toBe("**");
    expect(result.selection).toEqual({ start: 1, end: 1 });
  });

  test("strikethrough and inline code use their own markers", () => {
    expect(apply("MTU", [0, 3], "strikethrough").value).toBe("~~MTU~~");
    expect(apply("MTU", [0, 3], "code").value).toBe("`MTU`");
  });

  test("a link keeps the text and selects the URL to replace", () => {
    const result = apply("RFC 793", [0, 7], "link");

    expect(result.value).toBe("[RFC 793](https://)");
    expect(result.selected).toBe("https://");
  });

  test("an image is a link with a bang, and asks for the same URL", () => {
    const result = apply("", [0, 0], "image");

    expect(result.value).toBe("![](https://)");
    expect(result.selected).toBe("https://");
  });
});

describe("line prefixes", () => {
  test("a heading marks the line the caret is on, wherever in it", () => {
    const result = apply("Capa de transporte", [7, 7], "heading");

    expect(result.value).toBe("## Capa de transporte");
  });

  test("a list marks every line the selection touches", () => {
    const result = apply("TCP\nUDP\nSCTP", [0, 8], "unorderedList");

    expect(result.value).toBe("- TCP\n- UDP\n- SCTP");
  });

  test("an ordered list numbers from one instead of repeating it", () => {
    const result = apply("TCP\nUDP", [0, 7], "orderedList");

    expect(result.value).toBe("1. TCP\n2. UDP");
  });

  test("a checklist and a quote have their own markers", () => {
    expect(apply("Leer la RFC", [0, 0], "checklist").value).toBe("- [ ] Leer la RFC");
    expect(apply("Leer la RFC", [0, 0], "quote").value).toBe("> Leer la RFC");
  });

  test("prefixing the last line does not need a trailing newline", () => {
    const result = apply("Uno\nDos", [5, 5], "unorderedList");

    expect(result.value).toBe("Uno\n- Dos");
  });
});

describe("blocks", () => {
  test("a table lands on its own, separated from the paragraph above", () => {
    const result = apply("Cabecera TCP:", [13, 13], "table");

    expect(result.value).toBe("Cabecera TCP:\n\n|  |  |\n| --- | --- |\n|  |  |");
    expect(result.selected).toBe("|  |  |\n| --- | --- |\n|  |  |");
  });

  test("a multi-line selection becomes a fenced block, not inline code", () => {
    const result = apply("GET /\nHost: x", [0, 13], "code");

    expect(result.value).toBe("```\nGET /\nHost: x\n```");
  });

  test("an empty selection still gets a fence to type inside", () => {
    expect(apply("", [0, 0], "code").value).toBe("```\n\n```");
  });

  test("a block inserted mid-document keeps the text after it separated", () => {
    const result = apply("Antes\n\nDespués", [5, 5], "table");

    expect(result.value).toBe("Antes\n\n|  |  |\n| --- | --- |\n|  |  |\n\nDespués");
  });
});

describe("a selection the browser could not produce", () => {
  test("is clamped instead of slicing outside the string", () => {
    const result = apply("TCP", [-5, 99], "bold");

    expect(result.value).toBe("**TCP**");
  });
});

describe("Enter inside a list", () => {
  function enter(value: string, caret = value.length) {
    return continueList(value, { start: caret, end: caret });
  }

  test("an unordered item continues with the same bullet", () => {
    expect(enter("- IP")).toEqual({ value: "- IP\n- ", selection: { start: 7, end: 7 } });
    expect(enter("  * TCP")?.value).toBe("  * TCP\n  * ");
  });

  test("an ordered item continues with the next number", () => {
    expect(enter("9. UDP")?.value).toBe("9. UDP\n10. ");
    expect(enter("1) ARP")?.value).toBe("1) ARP\n2) ");
  });

  test("a task continues unticked, and a quote continues as a quote", () => {
    expect(enter("- [x] Leer RFC 791")?.value).toBe("- [x] Leer RFC 791\n- [ ] ");
    expect(enter("> Nota")?.value).toBe("> Nota\n> ");
  });

  test("Enter on an empty item removes the marker and ends the list", () => {
    expect(enter("- IP\n- ")).toEqual({ value: "- IP\n", selection: { start: 5, end: 5 } });
    expect(enter("1. a\n2. ")?.value).toBe("1. a\n");
    expect(enter("- [ ] ")?.value).toBe("");
  });

  test("Enter in the middle of an item splits it into two items", () => {
    expect(enter("- capa de red", 7)?.value).toBe("- capa \n- de red");
  });

  test("anything that is not a list line is left to the textarea", () => {
    expect(enter("párrafo")).toBeNull();
    expect(enter("---")).toBeNull();
    expect(enter("- item", 1)).toBeNull();
    expect(continueList("- a", { start: 0, end: 3 })).toBeNull();
  });
});
