import {
  convertBase,
  formatInBase,
  NUMBER_BASES,
  type NumberBase,
} from "@/features/number-base-converter/lib/numberBase";
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

type Level = {
  /** Bit width of the operand: how big the number the student works with is. */
  minBits: number;
  maxBits: number;
  /** Base pairs the level draws from, as [from, to]. */
  pairs: ReadonlyArray<readonly [NumberBase, NumberBase]>;
};

const ALL_PAIRS: ReadonlyArray<readonly [NumberBase, NumberBase]> =
  NUMBER_BASES.flatMap((from) =>
    NUMBER_BASES.filter((to) => to !== from).map(
      (to) => [from, to] as const,
    ),
  );

/** Pairs where at least one side is octal or hexadecimal. */
const OCT_HEX_PAIRS = ALL_PAIRS.filter(
  ([from, to]) => from === 8 || from === 16 || to === 8 || to === 16,
);

/**
 * Difficulty here is magnitude plus which bases are involved: an easy sheet
 * stays on small binary/decimal values, a hard one crosses any pair of bases
 * with values as wide as a 32-bit protocol field.
 */
const LEVELS: Record<Difficulty, Level> = {
  easy: {
    minBits: 2,
    maxBits: 8,
    pairs: [
      [2, 10],
      [10, 2],
    ],
  },
  medium: { minBits: 5, maxBits: 16, pairs: OCT_HEX_PAIRS },
  hard: { minBits: 12, maxBits: 32, pairs: ALL_PAIRS },
};

/** Random unsigned integer of exactly `bits` bits (the top bit is always set). */
function randomValueOfBits(bits: number): bigint {
  const min = 2 ** (bits - 1);
  const max = 2 ** bits - 1;
  return BigInt(randomInt(min, max));
}

/**
 * Exercises for the Number Base Converter: convert one value between two of
 * the four bases the tool supports.
 */
export const generateNumberBaseExercises: ExerciseGenerator = ({
  difficulty,
  count,
  t,
}) => {
  const level = LEVELS[difficulty];

  return collectDistinct(count, (): Exercise => {
    const [from, to] = randomItem(level.pairs);
    const value = randomValueOfBits(randomInt(level.minBits, level.maxBits));
    const operand = formatInBase(value, from);

    return {
      prompt: t("tools.numberBaseConverter.exercises.prompt", {
        value: operand,
        from: BASE_LABELS[from],
        to: BASE_LABELS[to],
      }),
      answer: convertBase(operand, from, to),
    };
  });
};
