import { describe, expect, test } from "bun:test";

import { isRichTextEmpty, richTextToPlain } from "@/lib/richText";

describe("richTextToPlain", () => {
  test("drops inline formatting", () => {
    expect(richTextToPlain("Lee <b>todo</b> el <i>enunciado</i> y <u>subraya</u>")).toBe(
      "Lee todo el enunciado y subraya",
    );
  });

  test("turns bulleted lists into bullet lines", () => {
    expect(richTextToPlain("Pasos:<ul><li>Uno</li><li>Dos</li></ul>")).toBe(
      "Pasos:\n• Uno\n• Dos",
    );
  });

  test("numbers ordered lists", () => {
    expect(richTextToPlain("<ol><li>a</li><li>b</li><li>c</li></ol>")).toBe("1. a\n2. b\n3. c");
  });

  test("indents nested lists", () => {
    expect(richTextToPlain("<ul><li>a<ul><li>b</li></ul></li></ul>")).toBe("• a\n  • b");
  });

  test("keeps paragraphs and line breaks", () => {
    expect(richTextToPlain("<div>uno</div><div>dos<br>tres</div>")).toBe("uno\ndos\ntres");
  });

  test("decodes entities", () => {
    expect(richTextToPlain("a &amp; b &lt;c&gt; &#241; &#x41;&nbsp;z")).toBe("a & b <c> ñ A z");
  });

  test("detects an empty editor", () => {
    expect(isRichTextEmpty("<div><br></div>")).toBe(true);
    expect(isRichTextEmpty("<b> </b>")).toBe(true);
    expect(isRichTextEmpty("<b>x</b>")).toBe(false);
  });
});
