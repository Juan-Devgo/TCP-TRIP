import {
  BYTE_WIDTHS,
  encodeText,
  textToCodes,
  type CharsetMode,
} from "@/features/ascii-converter/lib/ascii";
import { NUMBER_BASES, type NumberBase } from "@/features/number-base-converter/lib/numberBase";
import {
  collectDistinct,
  randomInt,
  randomItem,
  type Difficulty,
  type Exercise,
  type ExerciseGenerator,
} from "@/lib/exercises/utils";

/** Same labels the converter shows, so a statement reads like the UI. */
const BASE_LABELS: Record<NumberBase, string> = {
  2: "BIN",
  8: "OCT",
  10: "DEC",
  16: "HEX",
};

const ALPHANUMERIC = Array.from(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
);

/** Printable ASCII symbols that survive being copied by hand unambiguously. */
const SYMBOLS = Array.from("!#$%&*+-=?@");

/**
 * Accented characters that are two bytes in UTF-8 *and* printable with the
 * PDF's standard fonts. Emoji and CJK encode fine but cannot be drawn on the
 * sheet (`FONT` in `src/lib/pdf/template.ts` is WinAnsi), so they are out.
 */
const ACCENTED = Array.from("áéíóúàèòùäëïöüñÑçÁÉÍÓÚ");

/**
 * Longest code stream a statement may carry, in digits. Courier 11 pt fits
 * ~75 characters between the margins, so a stream this long always lands on
 * one printed line instead of overflowing it.
 */
const MAX_CODE_CHARS = 64;

/** Which way round the student works. */
const DIRECTIONS = ["textToCodes", "codesToText"] as const;

type Direction = (typeof DIRECTIONS)[number];

type Level = {
  /** Characters in the string the exercise is built around. */
  minLength: number;
  maxLength: number;
  bases: readonly NumberBase[];
  /**
   * Chance a single exercise is built in UTF-8 instead of ASCII. Multi-byte is
   * the hardest thing on the sheet, so it stays a minority: a student meets it
   * often enough to practise it, not so often that the sheet is only that.
   */
  utf8Chance: number;
  /** Pool for ASCII exercises; a UTF-8 one also forces an accented character. */
  pool: readonly string[];
  /** Show the code stream run together instead of one group per character. */
  packed: boolean;
};

/**
 * Difficulty here is how much of the encoding the student has to hold at once:
 * an easy sheet is one letter in the two bases they already read, a medium one
 * is a short word across all four, and a hard one strips the separators — so
 * the fixed byte width is the only thing left to split the stream by — and
 * mixes in UTF-8 multi-byte characters part of the time.
 */
const LEVELS: Record<Difficulty, Level> = {
  easy: {
    minLength: 1,
    maxLength: 1,
    bases: [2, 10],
    utf8Chance: 0,
    pool: ALPHANUMERIC,
    packed: false,
  },
  medium: {
    minLength: 3,
    maxLength: 5,
    bases: NUMBER_BASES,
    utf8Chance: 0,
    pool: [...ALPHANUMERIC, ...SYMBOLS],
    packed: false,
  },
  hard: {
    minLength: 5,
    maxLength: 8,
    bases: NUMBER_BASES,
    utf8Chance: 0.3,
    pool: [...ALPHANUMERIC, ...SYMBOLS],
    packed: true,
  },
};

/**
 * A random string for `level`, never long enough for its codes in `base` to
 * outgrow one printed line — binary spends eight digits per byte, hexadecimal
 * two, so the same character count is not affordable in both.
 */
function randomText(level: Level, base: NumberBase, mode: CharsetMode): string {
  const target = randomInt(level.minLength, level.maxLength);
  const budget = Math.floor(MAX_CODE_CHARS / BYTE_WIDTHS[base]);
  // Kept near the front so running out of budget can never drop it.
  const accentAt =
    mode === "unicode" ? randomInt(0, Math.min(target, 3) - 1) : -1;

  let text = "";
  let bytes = 0;

  for (let index = 0; index < target; index++) {
    const char = randomItem(index === accentAt ? ACCENTED : level.pool);
    const size = encodeText(char, mode).flat().length;
    if (bytes + size > budget) break;
    text += char;
    bytes += size;
  }

  return text;
}

/**
 * Exercises for the ASCII converter: encode a string into its codes, or read a
 * code stream back into the string. Both directions are answered by the same
 * functions the tool runs, so a student can check their own work by typing the
 * statement into the converter.
 */
export const generateAsciiExercises: ExerciseGenerator = ({
  difficulty,
  count,
  t,
}) => {
  const level = LEVELS[difficulty];

  return collectDistinct(count, (): Exercise => {
    const mode: CharsetMode =
      Math.random() < level.utf8Chance ? "unicode" : "ascii";
    const suffix = mode === "unicode" ? "Utf8" : "";
    const base = randomItem(level.bases);
    const text = randomText(level, base, mode);
    const codes = textToCodes(text, base, mode);
    const direction: Direction = randomItem(DIRECTIONS);

    if (direction === "textToCodes") {
      return {
        prompt: t(`tools.asciiConverter.exercises.textToCodes${suffix}`, {
          text,
          base: BASE_LABELS[base],
        }),
        answer: codes,
      };
    }

    return {
      prompt: t(`tools.asciiConverter.exercises.codesToText${suffix}`, {
        codes: level.packed ? codes.replaceAll(" ", "") : codes,
        base: BASE_LABELS[base],
      }),
      answer: text,
    };
  });
};
