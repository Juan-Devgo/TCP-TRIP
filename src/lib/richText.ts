/**
 * Instructions are written with light formatting (bold, italic, underline,
 * lists) but Google Classroom only accepts plain text. This is the one
 * conversion both sides agree on: the editor previews it and the server sends
 * it. String-based on purpose — the server has no DOM.
 */

/** Tags the editor may produce. Anything else is dropped on sanitize. */
export const RICH_TEXT_TAGS = ["b", "strong", "i", "em", "u", "ul", "ol", "li", "p", "div", "br"] as const;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * Lists become one line per item (`•` or `1.`), blocks become line breaks and
 * inline formatting is dropped. Runs of blank lines collapse to one.
 */
export function richTextToPlain(html: string): string {
  // One counter per open list; `null` marks a bulleted one.
  const lists: (number | null)[] = [];
  let out = "";
  // Blocks only need to *start* on a fresh line; stacking breaks would turn
  // every `</li><li>` into a blank line.
  const breakLine = () => {
    if (out !== "" && !out.endsWith("\n")) out += "\n";
  };

  const tokens = html.split(/(<[^>]*>)/);
  for (const token of tokens) {
    const tag = /^<\s*(\/)?\s*([a-z0-9]+)[^>]*>$/i.exec(token);
    if (!tag) {
      out += decodeEntities(token.replace(/\s+/g, " "));
      continue;
    }

    const closing = tag[1] === "/";
    const name = (tag[2] ?? "").toLowerCase();

    if (name === "br") {
      out += "\n";
    } else if (name === "ul" || name === "ol") {
      if (closing) lists.pop();
      else lists.push(name === "ol" ? 0 : null);
      breakLine();
    } else if (name === "li" && !closing) {
      const depth = Math.max(lists.length - 1, 0);
      const current = lists[lists.length - 1];
      let marker = "•";
      if (typeof current === "number") {
        lists[lists.length - 1] = current + 1;
        marker = `${current + 1}.`;
      }
      breakLine();
      out += `${"  ".repeat(depth)}${marker} `;
    } else if (name === "p" || name === "div" || (name === "li" && closing)) {
      breakLine();
    }
  }

  return out
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** `true` when the HTML has no visible text — an "empty" editor still holds `<br>`. */
export function isRichTextEmpty(html: string): boolean {
  return richTextToPlain(html).trim() === "";
}
