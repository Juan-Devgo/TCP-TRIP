/**
 * Which characters of a markdown source are **markup** rather than content —
 * the `#` of a heading, the `-` of a bullet, the `|` of a table, the `**`
 * around bold — so the writing surface can draw them fainter than the words.
 *
 * It is a highlighter, not a parser: it never decides what the preview shows
 * (`markdown-to-jsx` does), it only has to be right about the common cases and
 * harmless about the rest. A character it is unsure of stays at full strength.
 *
 * Pure and line-based, with no React import, so it is tested on strings.
 */

/** A run of the source, in order. Joining every `text` gives the source back. */
export type SyntaxSegment = { text: string; syntax: boolean };

const FENCE = /^\s*(`{3,}|~{3,})/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/;

/** Block markers at the start of a line, in the order they can be stacked. */
const QUOTE = /^>\s?/;
const HEADING = /^#{1,6}(\s+|$)/;
const BULLET = /^[-*+]\s+/;
const ORDERED = /^\d+[.)]\s+/;
const TASK = /^\[[ xX]\]\s+/;

/** What a backslash can escape: ASCII punctuation, as in CommonMark. */
const ESCAPABLE = /[!-/:-@[-`{-~]/;

/**
 * Inline delimiters. Run over a copy of the line where code spans and escaped
 * characters are blanked out, so `` `**x**` `` and `\*` are never mistaken
 * for markup.
 */
const LINK = /(!?\[)[^\]\n]*(\]\()[^)\s]*(\))/g;
const STRONG = /(\*\*|__|~~)(?=\S)(?:[^\n]*?\S)\1/g;
const EMPHASIS_STAR = /(?<![*\\])\*(?=[^\s*])(?:[^*\n]*?[^\s*])?\*(?!\*)/g;
const EMPHASIS_UNDERSCORE = /(?<![\w_])_(?=[^\s_])(?:[^_\n]*?[^\s_])?_(?![\w_])/g;

export function markdownSyntax(source: string): SyntaxSegment[] {
  const lines = source.split("\n");
  const marks: boolean[] = [];
  let fenced = false;

  lines.forEach((line, index) => {
    const lineMarks = markLine(line, fenced);
    if (FENCE.test(line)) fenced = !fenced;

    marks.push(...lineMarks);
    // The newline itself is neither: it only has to be there.
    if (index < lines.length - 1) marks.push(false);
  });

  return segments(source, marks);
}

function markLine(line: string, fenced: boolean): boolean[] {
  const marks = Array.from({ length: line.length }, () => false);
  const fill = (from: number, to: number) => {
    for (let at = from; at < to; at += 1) marks[at] = true;
  };

  // A fence line is all markup; what sits between two of them is all content.
  if (FENCE.test(line)) {
    fill(0, line.length);
    return marks;
  }
  if (fenced) return marks;

  if (RULE.test(line) || TABLE_DELIMITER.test(line)) {
    fill(0, line.length);
    return marks;
  }

  const at = prefix(line, fill);
  inline(line, at, marks, fill);

  return marks;
}

/** Marks the block markers a line opens with; returns where the text starts. */
function prefix(line: string, fill: (from: number, to: number) => void): number {
  let at = line.length - line.trimStart().length;

  const take = (pattern: RegExp): boolean => {
    const match = pattern.exec(line.slice(at));
    if (!match) return false;
    fill(at, at + match[0].length);
    at += match[0].length;
    return true;
  };

  while (take(QUOTE)) {
    at += line.slice(at).length - line.slice(at).trimStart().length;
  }

  if (!take(HEADING) && (take(BULLET) || take(ORDERED))) take(TASK);

  return at;
}

function inline(
  line: string,
  from: number,
  marks: boolean[],
  fill: (from: number, to: number) => void,
) {
  // What the delimiter patterns are allowed to see: code and escapes blanked.
  const visible = line.split("");
  const blank = (start: number, end: number) => {
    for (let at = start; at < end; at += 1) visible[at] = "\u0000";
  };

  let at = from;
  while (at < line.length) {
    const character = line[at];

    if (character === "\\" && ESCAPABLE.test(line[at + 1] ?? "")) {
      // The backslash is markup; the character it escapes is content.
      fill(at, at + 1);
      blank(at, at + 2);
      at += 2;
      continue;
    }

    if (character === "`") {
      const run = /^`+/.exec(line.slice(at))?.[0] ?? "`";
      const close = line.indexOf(run, at + run.length);
      if (close !== -1) {
        fill(at, at + run.length);
        fill(close, close + run.length);
        blank(at, close + run.length);
        at = close + run.length;
        continue;
      }
    }

    at += 1;
  }

  const text = visible.join("");
  // Only what follows the block markers is inline content.
  const scan = (pattern: RegExp, each: (match: RegExpExecArray) => void) => {
    pattern.lastIndex = from;
    for (let match = pattern.exec(text); match; match = pattern.exec(text)) each(match);
  };

  scan(LINK, (match) => {
    const [whole, open = "", middle = "", close = ""] = match;
    const start = match.index;
    fill(start, start + open.length);
    const middleAt = start + whole.lastIndexOf(middle, whole.length - close.length);
    fill(middleAt, middleAt + middle.length);
    fill(start + whole.length - close.length, start + whole.length);
  });

  scan(STRONG, (match) => {
    const size = match[1]?.length ?? 2;
    fill(match.index, match.index + size);
    fill(match.index + match[0].length - size, match.index + match[0].length);
  });

  for (const pattern of [EMPHASIS_STAR, EMPHASIS_UNDERSCORE]) {
    scan(pattern, (match) => {
      // A marker already taken by `**` is not a second, italic one.
      if (marks[match.index] || marks[match.index + match[0].length - 1]) return;
      fill(match.index, match.index + 1);
      fill(match.index + match[0].length - 1, match.index + match[0].length);
    });
  }

  // A table row: every pipe outside code is a column rule.
  if (line.trimStart().startsWith("|")) {
    for (let index = from; index < text.length; index += 1) {
      if (text[index] === "|") marks[index] = true;
    }
  }
}

function segments(source: string, marks: boolean[]): SyntaxSegment[] {
  const result: SyntaxSegment[] = [];

  for (let at = 0; at < source.length; at += 1) {
    const syntax = marks[at] === true;
    const last = result[result.length - 1];
    const character = source[at] ?? "";

    if (last && last.syntax === syntax) last.text += character;
    else result.push({ text: character, syntax });
  }

  return result;
}
