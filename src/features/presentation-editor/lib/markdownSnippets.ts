/**
 * What the markdown toolbar's buttons actually do: put a piece of markdown
 * structure where the caret is.
 *
 * It is pure text in, text out — no React, no textarea, no i18n — because the
 * fiddly part is the caret arithmetic and that is what deserves tests. The
 * component's job is only to read the selection off the `<textarea>`, call this
 * and write the caret back.
 *
 * Nothing here toggles: a button inserts its structure, as a teacher expects
 * from a toolbar, and undo is how you take it back. Guessing whether the
 * selection "is already bold" gets it wrong on exactly the cases that matter
 * (`**a** and **b**`).
 */

export const MARKDOWN_SNIPPETS = [
  "bold",
  "italic",
  "heading",
  "strikethrough",
  "unorderedList",
  "orderedList",
  "checklist",
  "link",
  "image",
  "table",
  "code",
  "quote",
] as const;

export type MarkdownSnippet = (typeof MARKDOWN_SNIPPETS)[number];

/** A `<textarea>`'s selection, in characters. `start === end` is a caret. */
export type TextSelection = { start: number; end: number };

/** The new value, and where the caret (or selection) should end up in it. */
export type MarkdownEdit = { value: string; selection: TextSelection };

/** Wraps the selection — `**bold**`. */
type Wrap = { kind: "wrap"; before: string; after: string; selectAfter?: string };

/** Prefixes every line the selection touches — a list, a quote, a heading. */
type Prefix = { kind: "prefix"; marker: string | ((index: number) => string) };

/** Inserted as its own block between blank lines — a table, a fenced block. */
type Block = { kind: "block"; text: string };

const RULES: Record<MarkdownSnippet, Wrap | Prefix | Block> = {
  bold: { kind: "wrap", before: "**", after: "**" },
  italic: { kind: "wrap", before: "*", after: "*" },
  strikethrough: { kind: "wrap", before: "~~", after: "~~" },
  heading: { kind: "prefix", marker: "## " },
  unorderedList: { kind: "prefix", marker: "- " },
  // Numbered from one, so pasting three lines and pressing the button gives a
  // list and not three items numbered 1.
  orderedList: { kind: "prefix", marker: (index) => `${index + 1}. ` },
  checklist: { kind: "prefix", marker: "- [ ] " },
  // The URL is what the author has to replace, so it is what ends up selected.
  link: { kind: "wrap", before: "[", after: "](https://)", selectAfter: "https://" },
  image: { kind: "wrap", before: "![", after: "](https://)", selectAfter: "https://" },
  table: { kind: "block", text: "|  |  |\n| --- | --- |\n|  |  |" },
  code: { kind: "wrap", before: "`", after: "`" },
  quote: { kind: "prefix", marker: "> " },
};

/** A fenced block is what `code` inserts when the selection is not one word. */
const FENCE = "```";

export function insertSnippet(
  value: string,
  selection: TextSelection,
  snippet: MarkdownSnippet,
): MarkdownEdit {
  const { start, end } = clampSelection(value, selection);
  const selected = value.slice(start, end);

  // Multi-line code is a fenced block, not five inline spans. The inline form
  // only makes sense for a field name or a port number.
  if (snippet === "code" && (selected.includes("\n") || selected === "")) {
    return block(value, { start, end }, `${FENCE}\n${selected}\n${FENCE}`);
  }

  const rule = RULES[snippet];

  if (rule.kind === "wrap") return wrap(value, { start, end }, rule);
  if (rule.kind === "prefix") return prefix(value, { start, end }, rule.marker);

  return block(value, { start, end }, rule.text);
}

function clampSelection(value: string, selection: TextSelection): TextSelection {
  const start = Math.min(Math.max(0, selection.start), value.length);
  const end = Math.min(Math.max(start, selection.end), value.length);

  return { start, end };
}

function wrap(value: string, selection: TextSelection, rule: Wrap): MarkdownEdit {
  const { start, end } = selection;
  const selected = value.slice(start, end);
  const inserted = `${rule.before}${selected}${rule.after}`;

  // Where to leave the caret: over the placeholder the author must replace, or
  // over their own text, or between the markers when there was nothing.
  const offset =
    rule.selectAfter !== undefined
      ? inserted.indexOf(rule.selectAfter)
      : rule.before.length;

  const length =
    rule.selectAfter !== undefined ? rule.selectAfter.length : selected.length;

  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    selection: { start: start + offset, end: start + offset + length },
  };
}

function prefix(
  value: string,
  selection: TextSelection,
  marker: string | ((index: number) => string),
): MarkdownEdit {
  const from = value.lastIndexOf("\n", Math.max(0, selection.start - 1)) + 1;
  const lineEnd = value.indexOf("\n", selection.end);
  const to = lineEnd === -1 ? value.length : lineEnd;

  const marked = value
    .slice(from, to)
    .split("\n")
    .map((line, index) => (typeof marker === "string" ? marker : marker(index)) + line)
    .join("\n");

  return {
    value: value.slice(0, from) + marked + value.slice(to),
    selection: { start: from, end: from + marked.length },
  };
}

/** The blank line a block needs, given what is already there. */
function padding(hasBoth: boolean, hasOne: boolean, empty: boolean): string {
  if (empty || hasBoth) return "";
  return hasOne ? "\n" : "\n\n";
}

function block(value: string, selection: TextSelection, text: string): MarkdownEdit {
  const before = value.slice(0, selection.start);
  const after = value.slice(selection.end);

  // A block needs a blank line around it or markdown reads it as part of the
  // paragraph it landed in.
  const lead = padding(before.endsWith("\n\n"), before.endsWith("\n"), before === "");
  const trail = padding(after.startsWith("\n\n"), after.startsWith("\n"), after === "");

  const start = before.length + lead.length;

  return {
    value: `${before}${lead}${text}${trail}${after}`,
    selection: { start, end: start + text.length },
  };
}
