import { formatInBase, parseInBase, type NumberBase } from "@/features/number-base-converter/lib/numberBase";

/**
 * How a character is turned into bytes.
 *
 * - `ascii`   — one byte per character (0–255, i.e. up to 8 bits). A character
 *   outside that range has no representation and is reported as an error.
 * - `unicode` — the character's UTF-8 encoding: 1 to 4 bytes, i.e. up to 32
 *   bits, which is what lets the tool carry accents, ñ, emoji and CJK.
 */
export const CHARSET_MODES = ["ascii", "unicode"] as const;

export type CharsetMode = (typeof CHARSET_MODES)[number];

export function isCharsetMode(value: unknown): value is CharsetMode {
  return CHARSET_MODES.includes(value as CharsetMode);
}

/**
 * Digits one byte occupies in each base. Fixed widths are what make a code
 * stream splittable without guessing: any run of digits is just bytes back to
 * back, so `01000001 01000010` and `0100000101000010` parse the same.
 * Decimal is padded to 3 for the same reason (`065` not `65`).
 */
export const BYTE_WIDTHS: Record<NumberBase, number> = {
  2: 8,
  8: 3,
  10: 3,
  16: 2,
};

const MAX_BYTE = 255;

export type AsciiErrorCode =
  /** The character needs more than 8 bits, so ASCII mode cannot encode it. */
  | "unrepresentable"
  /** A digit that is not legal in the selected base. */
  | "invalidDigit"
  /** A well-formed group whose value is above 255 (e.g. `999` in DEC). */
  | "outOfRange";

/** Carries a code instead of a message: the component owns the translated copy. */
export class AsciiError extends Error {
  readonly code: AsciiErrorCode;
  /** The offending character or digit group, for the message placeholder. */
  readonly detail: string;

  constructor(code: AsciiErrorCode, detail = "") {
    super(`${code}: ${detail}`);
    this.name = "AsciiError";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Split `text` into per-character byte groups. Grouping is what keeps the code
 * column readable in UTF-8, where one character can span four bytes.
 *
 * @throws AsciiError `unrepresentable` in ASCII mode, on a character above 255.
 */
export function encodeText(text: string, mode: CharsetMode): number[][] {
  // Array.from splits by code point, so a surrogate pair stays one character.
  const chars = Array.from(text);

  if (mode === "unicode") {
    const encoder = new TextEncoder();
    return chars.map((char) => Array.from(encoder.encode(char)));
  }

  return chars.map((char) => {
    const code = char.codePointAt(0) ?? 0;
    if (code > MAX_BYTE) throw new AsciiError("unrepresentable", char);
    return [code];
  });
}

/** Render byte groups in `base`: bytes of one character joined, characters spaced. */
export function formatCodes(groups: number[][], base: NumberBase): string {
  const width = BYTE_WIDTHS[base];
  return groups
    .map((bytes) =>
      bytes
        .map((byte) => formatInBase(BigInt(byte), base).padStart(width, "0"))
        .join(""),
    )
    .join(" ");
}

/**
 * Read a code stream back into bytes. Separators are optional — everything is
 * stripped and re-split on the base's fixed byte width.
 *
 * A trailing group that is not yet a full byte is *not* an error: the user is
 * still typing it. It is reported through `incomplete` and left out of `bytes`,
 * which is what lets the text side update on every keystroke.
 *
 * @throws AsciiError `invalidDigit` or `outOfRange`.
 */
export function parseCodes(
  value: string,
  base: NumberBase,
): { bytes: number[]; incomplete: boolean } {
  const clean = value.replace(/[\s,;]+/g, "").toUpperCase();
  if (clean === "") return { bytes: [], incomplete: false };

  const width = BYTE_WIDTHS[base];
  const completeLength = clean.length - (clean.length % width);
  const bytes: number[] = [];

  for (let index = 0; index < completeLength; index += width) {
    const chunk = clean.slice(index, index + width);
    const parsed = Number(parseGroup(chunk, base));
    if (parsed > MAX_BYTE) throw new AsciiError("outOfRange", chunk);
    bytes.push(parsed);
  }

  // Validate the partial tail too, so a typo is flagged as it is typed rather
  // than only once the group happens to be complete.
  const tail = clean.slice(completeLength);
  if (tail !== "") parseGroup(tail, base);

  return { bytes, incomplete: tail !== "" };
}

function parseGroup(chunk: string, base: NumberBase): bigint {
  try {
    return parseInBase(chunk, base);
  } catch {
    throw new AsciiError("invalidDigit", chunk);
  }
}

/**
 * Turn bytes back into text. UTF-8 decoding is deliberately non-fatal: a half
 * typed multi-byte sequence shows U+FFFD instead of blanking the whole pane.
 */
export function decodeBytes(bytes: number[], mode: CharsetMode): string {
  const data = Uint8Array.from(bytes);
  if (mode === "unicode") return new TextDecoder().decode(data);
  return Array.from(data, (byte) => String.fromCharCode(byte)).join("");
}

/** `text` → code stream, the whole way. */
export function textToCodes(
  text: string,
  base: NumberBase,
  mode: CharsetMode,
): string {
  if (text === "") return "";
  return formatCodes(encodeText(text, mode), base);
}

/** Code stream → `text`, the whole way. */
export function codesToText(
  value: string,
  base: NumberBase,
  mode: CharsetMode,
): string {
  const { bytes } = parseCodes(value, base);
  return decodeBytes(bytes, mode);
}

/**
 * Re-group a flat byte run into characters. In ASCII mode every byte is its own
 * character; in Unicode mode the UTF-8 lead byte announces how many bytes
 * follow, which is what makes the encoding self-synchronising — so the column
 * can be regrouped after a re-parse without consulting the text side.
 */
export function groupBytes(bytes: number[], mode: CharsetMode): number[][] {
  if (mode === "ascii") return bytes.map((byte) => [byte]);

  const groups: number[][] = [];
  let index = 0;

  while (index < bytes.length) {
    const lead = bytes[index] ?? 0;
    const size =
      lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1;
    groups.push(bytes.slice(index, index + size));
    index += size;
  }

  return groups;
}

/** Re-render an existing code stream in another base, byte for byte. */
export function convertCodesBase(
  value: string,
  from: NumberBase,
  to: NumberBase,
  mode: CharsetMode,
): string {
  const { bytes } = parseCodes(value, from);
  if (bytes.length === 0) return "";
  return formatCodes(groupBytes(bytes, mode), to);
}
