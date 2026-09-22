/**
 * A small Markdown parser for the presentation editor's markdown mode.
 *
 * It parses to a **token tree, not to HTML**, and that is the whole security
 * story: the renderer turns tokens into React elements, so a teacher writing
 * `<script>` gets the characters `<script>` on the page and nothing else. A
 * library that produced an HTML string would need sanitising before
 * `dangerouslySetInnerHTML`, and the content here is written by one user and
 * read by a whole class.
 *
 * The subset is what lecture notes actually need: headings, paragraphs, lists,
 * blockquotes, fenced and inline code, bold, italic, links and rules. Anything
 * unsupported is left as text rather than dropped, so nothing a teacher typed
 * silently disappears.
 *
 * Pure and dependency-free — `src/components/common/Markdown.tsx` renders it.
 */

export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type BlockToken =
  | { kind: "heading"; level: 1 | 2 | 3; content: InlineToken[] }
  | { kind: "paragraph"; content: InlineToken[] }
  | { kind: "list"; ordered: boolean; items: InlineToken[][] }
  | { kind: "quote"; content: InlineToken[] }
  | { kind: "code"; language: string | null; text: string }
  | { kind: "rule" };

/**
 * Only `http`, `https` and `mailto` survive. `javascript:` in a link is the one
 * way a markdown document could still run something, and the renderer would
 * happily put it in an `href` — so it is rejected here, at the parse.
 */
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

export function isSafeHref(href: string): boolean {
  return SAFE_LINK.test(href.trim());
}

/**
 * Inline markup, left to right. Bold before italic, so `**bold**` is not read
 * as two italics, and code before both, so `` `**x**` `` stays literal.
 */
const INLINE_PATTERN =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]\n]*\]\([^)\s]+\))/;

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let rest = text;

  while (rest.length > 0) {
    const match = INLINE_PATTERN.exec(rest);
    if (!match || match.index === undefined) {
      tokens.push({ kind: "text", text: rest });
      break;
    }

    if (match.index > 0) {
      tokens.push({ kind: "text", text: rest.slice(0, match.index) });
    }

    const piece = match[0];

    if (piece.startsWith("`")) {
      tokens.push({ kind: "code", text: piece.slice(1, -1) });
    } else if (piece.startsWith("**") || piece.startsWith("__")) {
      tokens.push({ kind: "strong", text: piece.slice(2, -2) });
    } else if (piece.startsWith("[")) {
      const split = piece.indexOf("](");
      const label = piece.slice(1, split);
      const href = piece.slice(split + 2, -1);
      // An unsafe link keeps its text: the words a teacher wrote are content,
      // the destination is what is refused.
      tokens.push(
        isSafeHref(href)
          ? { kind: "link", text: label === "" ? href : label, href: href.trim() }
          : { kind: "text", text: label === "" ? href : label },
      );
    } else {
      tokens.push({ kind: "em", text: piece.slice(1, -1) });
    }

    rest = rest.slice(match.index + piece.length);
  }

  return tokens.filter((token) => token.kind !== "text" || token.text !== "");
}

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^[-*+]\s+(.*)$/;
const ORDERED = /^\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const FENCE = /^```\s*([A-Za-z0-9+#-]*)\s*$/;

/** Blocks, in document order. Blank lines separate them; nothing is dropped. */
export function parseMarkdown(source: string): BlockToken[] {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const blocks: BlockToken[] = [];

  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (trimmed === "") {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(trimmed);
    if (fence) {
      const language = fence[1] === "" ? null : (fence[1] ?? null);
      const body: string[] = [];
      index += 1;
      // An unclosed fence runs to the end of the document rather than being
      // abandoned — a half-typed code block still shows what is in it.
      while (index < lines.length && !FENCE.test((lines[index] ?? "").trim())) {
        body.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push({ kind: "code", language, text: body.join("\n") });
      continue;
    }

    if (RULE.test(trimmed)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: (heading[1]?.length ?? 1) as 1 | 2 | 3,
        content: parseInline(heading[2] ?? ""),
      });
      index += 1;
      continue;
    }

    const bullet = BULLET.exec(trimmed);
    const ordered = ORDERED.exec(trimmed);
    if (bullet || ordered) {
      const isOrdered = ordered !== null && bullet === null;
      const items: InlineToken[][] = [];

      while (index < lines.length) {
        const current = (lines[index] ?? "").trim();
        const match = isOrdered ? ORDERED.exec(current) : BULLET.exec(current);
        if (!match) break;
        items.push(parseInline(match[1] ?? ""));
        index += 1;
      }

      blocks.push({ kind: "list", ordered: isOrdered, items });
      continue;
    }

    const quote = QUOTE.exec(trimmed);
    if (quote) {
      const body: string[] = [quote[1] ?? ""];
      index += 1;
      while (index < lines.length) {
        const next = QUOTE.exec((lines[index] ?? "").trim());
        if (!next) break;
        body.push(next[1] ?? "");
        index += 1;
      }
      blocks.push({ kind: "quote", content: parseInline(body.join(" ")) });
      continue;
    }

    // A paragraph runs until a blank line or the start of another block.
    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = (lines[index] ?? "").trim();
      if (
        current === "" ||
        HEADING.test(current) ||
        BULLET.test(current) ||
        ORDERED.test(current) ||
        QUOTE.test(current) ||
        RULE.test(current) ||
        FENCE.test(current)
      ) {
        break;
      }
      paragraph.push(current);
      index += 1;
    }

    blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) });
  }

  return blocks;
}

/**
 * Plain text of a document — what the Theory listing shows as an excerpt, and
 * what makes a markdown-mode presentation searchable later.
 */
export function markdownToText(source: string): string {
  return parseMarkdown(source)
    .map((block) => {
      switch (block.kind) {
        case "heading":
        case "paragraph":
        case "quote":
          return inlineText(block.content);
        case "list":
          return block.items.map((item) => inlineText(item)).join(" ");
        case "code":
          return block.text;
        case "rule":
          return "";
      }
    })
    .filter((text) => text !== "")
    .join("\n");
}

function inlineText(tokens: InlineToken[]): string {
  return tokens.map((token) => token.text).join("");
}
