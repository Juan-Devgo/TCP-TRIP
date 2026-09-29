import { describe, expect, test } from "bun:test";

import { markdownSyntax } from "@/features/presentation-editor/lib/markdownSyntax";

/** The source with every markup character replaced by `^` — easy to read. */
function shape(source: string): string {
  return markdownSyntax(source)
    .map((segment) => (segment.syntax ? "^".repeat(segment.text.length) : segment.text))
    .join("");
}

describe("markdownSyntax", () => {
  test("gives the source back, whole and in order", () => {
    const source = "# Hola\n\n- a **b**\n> c `d`\n";
    expect(markdownSyntax(source).map((segment) => segment.text).join("")).toBe(source);
  });

  test("block markers at the start of a line", () => {
    expect(shape("## Capa de red")).toBe("^^^Capa de red");
    expect(shape("- IP")).toBe("^^IP");
    expect(shape("12. TCP")).toBe("^^^^TCP");
    expect(shape("- [x] Hecho")).toBe("^^^^^^Hecho");
    expect(shape("> > cita")).toBe("^^^^cita");
  });

  test("rules, fences and table delimiters are markup through and through", () => {
    expect(shape("---")).toBe("^^^");
    expect(shape("| --- | :-: |")).toBe("^^^^^^^^^^^^^");
    expect(shape("```ts\nconst a = *b*;\n```")).toBe("^^^^^\nconst a = *b*;\n^^^");
  });

  test("table rows dim their pipes and nothing else", () => {
    expect(shape("| a | b |")).toBe("^ a ^ b ^");
  });

  test("inline delimiters, but never the words between them", () => {
    expect(shape("un **dato** y *otro*")).toBe("un ^^dato^^ y ^otro^");
    expect(shape("~~viejo~~")).toBe("^^viejo^^");
    expect(shape("[RFC](https://a.b)")).toBe("^RFC^^https://a.b^");
    expect(shape("![x](https://a.b)")).toBe("^^x^^https://a.b^");
  });

  test("code spans keep their content literal", () => {
    expect(shape("`**x**` y")).toBe("^**x**^ y");
  });

  test("an escaping backslash is markup, the escaped character is not", () => {
    expect(shape("\\# no \\*es\\*")).toBe("^# no ^*es^*");
    // Not before punctuation: the backslash is content and stays.
    expect(shape("C:\\red")).toBe("C:\\red");
  });

  test("ordinary text is left at full strength", () => {
    expect(shape("mi_variable_x y 3 * 4")).toBe("mi_variable_x y 3 * 4");
  });
});
