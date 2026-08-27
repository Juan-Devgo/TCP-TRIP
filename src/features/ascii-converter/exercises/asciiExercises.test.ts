import { describe, expect, test } from "bun:test";
import type { TFunction } from "i18next";

import { generateAsciiExercises } from "@/features/ascii-converter/exercises/asciiExercises";
import { codesToText, textToCodes, type CharsetMode } from "@/features/ascii-converter/lib/ascii";
import type { Difficulty } from "@/lib/exercises/utils";
import type { NumberBase } from "@/features/number-base-converter/lib/numberBase";

const BASE_BY_LABEL: Record<string, NumberBase> = {
  BIN: 2,
  OCT: 8,
  DEC: 10,
  HEX: 16,
};

/** Serializes the key and the interpolation values so the test reads them back. */
const t = ((key: string, options?: Record<string, unknown>) =>
  JSON.stringify({ key, ...options })) as unknown as TFunction;

type Statement = {
  key: string;
  base: NumberBase;
  mode: CharsetMode;
  /** Present on a "write the codes" statement. */
  text?: string;
  /** Present on a "read the codes" statement. */
  codes?: string;
};

function readStatement(prompt: string): Statement {
  const parsed = JSON.parse(prompt) as {
    key: string;
    base: string;
    text?: string;
    codes?: string;
  };
  const base = BASE_BY_LABEL[parsed.base];
  if (base === undefined) {
    throw new Error(`Unknown base label in prompt: ${prompt}`);
  }
  const key = parsed.key.replace("tools.asciiConverter.exercises.", "");
  return {
    key,
    base,
    mode: key.endsWith("Utf8") ? "unicode" : "ascii",
    ...(parsed.text === undefined ? {} : { text: parsed.text }),
    ...(parsed.codes === undefined ? {} : { codes: parsed.codes }),
  };
}

function generate(difficulty: Difficulty, count: number) {
  return generateAsciiExercises({ difficulty, count, t });
}

describe("generateAsciiExercises", () => {
  test("returns exactly the requested number of exercises", () => {
    for (const count of [1, 7, 50]) {
      expect(generate("medium", count)).toHaveLength(count);
    }
  });

  test("every answer round trips through the converter's own functions", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      for (const exercise of generate(difficulty, 40)) {
        const { key, base, mode, text, codes } = readStatement(exercise.prompt);

        if (key.startsWith("textToCodes")) {
          expect(text).toBeString();
          expect(exercise.answer).toBe(textToCodes(text ?? "", base, mode));
        } else {
          expect(codes).toBeString();
          expect(codesToText(codes ?? "", base, mode)).toBe(exercise.answer);
        }
      }
    }
  });

  test("both directions show up in a sheet", () => {
    const keys = new Set(
      generate("medium", 40).map((exercise) => readStatement(exercise.prompt).key),
    );
    expect(keys).toEqual(new Set(["textToCodes", "codesToText"]));
  });

  test("statements never convert between number bases", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      for (const exercise of generate(difficulty, 30)) {
        const { key } = readStatement(exercise.prompt);
        expect(["textToCodes", "codesToText", "textToCodesUtf8", "codesToTextUtf8"])
          .toContain(key);
      }
    }
  });

  test("easy is one alphanumeric character in BIN or DEC", () => {
    for (const exercise of generate("easy", 40)) {
      const { base, mode, text, codes } = readStatement(exercise.prompt);
      expect([2, 10]).toContain(base);
      expect(mode).toBe("ascii");

      const subject = text ?? codesToText(codes ?? "", base, mode);
      expect(Array.from(subject)).toHaveLength(1);
      expect(subject).toMatch(/^[A-Za-z0-9]$/);
    }
  });

  test("medium is a short ASCII string, any of the four bases", () => {
    const bases = new Set<NumberBase>();

    for (const exercise of generate("medium", 60)) {
      const { base, mode, text, codes } = readStatement(exercise.prompt);
      bases.add(base);
      expect(mode).toBe("ascii");

      const subject = text ?? codesToText(codes ?? "", base, mode);
      expect(Array.from(subject).length).toBeGreaterThanOrEqual(3);
      expect(Array.from(subject).length).toBeLessThanOrEqual(5);
      // Everything ASCII mode can encode: no accented character reaches here.
      expect(subject).toMatch(/^[\x21-\x7e]+$/);
    }

    expect(bases.size).toBe(4);
  });

  test("hard packs the code stream, and only its UTF-8 half is accented", () => {
    for (const exercise of generate("hard", 60)) {
      const { mode, text, codes } = readStatement(exercise.prompt);

      if (codes !== undefined) expect(codes).not.toInclude(" ");

      const subject = text ?? exercise.answer;
      expect(Array.from(subject).length).toBeGreaterThanOrEqual(4);

      if (mode === "unicode") {
        // The generator forces one accent, which is what makes it multi-byte.
        expect(subject).toMatch(/[^\x00-\x7f]/);
        // Latin-1 only: emoji and CJK cannot be printed on the sheet.
        expect(subject).toMatch(/^[\x21-\x7e¡-ÿ]+$/);
      } else {
        expect(subject).toMatch(/^[\x21-\x7e]+$/);
      }
    }
  });

  test("hard keeps UTF-8 a minority of the sheet", () => {
    const total = 200;
    const utf8 = generate("hard", total).filter(
      (exercise) => readStatement(exercise.prompt).mode === "unicode",
    ).length;

    // Aimed at 30%; the bounds are wide enough that the run is not flaky
    // (~5 standard deviations either side) while still failing an "always
    // UTF-8" or "never UTF-8" regression.
    expect(utf8 / total).toBeGreaterThan(0.15);
    expect(utf8 / total).toBeLessThan(0.5);
  });

  test("no statement carries a code stream too wide for a printed line", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      for (const exercise of generate(difficulty, 60)) {
        const { text, codes } = readStatement(exercise.prompt);
        const stream = codes ?? exercise.answer;
        expect(stream.replaceAll(" ", "").length).toBeLessThanOrEqual(64);
        if (text !== undefined) expect(exercise.answer.length).toBeLessThanOrEqual(75);
      }
    }
  });

  test("statements within a sheet do not repeat", () => {
    const prompts = generate("hard", 30).map((exercise) => exercise.prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  test("two runs with the same settings differ", () => {
    const first = generate("hard", 10).map((exercise) => exercise.prompt).join("|");
    const second = generate("hard", 10).map((exercise) => exercise.prompt).join("|");
    expect(first).not.toBe(second);
  });
});
