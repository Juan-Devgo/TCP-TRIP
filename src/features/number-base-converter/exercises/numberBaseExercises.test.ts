import { describe, expect, test } from "bun:test";
import type { TFunction } from "i18next";

import { generateNumberBaseExercises } from "@/features/number-base-converter/exercises/numberBaseExercises";
import { convertBase, parseInBase, type NumberBase } from "@/features/number-base-converter/lib/numberBase";
import type { Difficulty } from "@/lib/exercises/utils";

const BASE_BY_LABEL: Record<string, NumberBase> = {
  BIN: 2,
  OCT: 8,
  DEC: 10,
  HEX: 16,
};

/** Serializes the interpolation values so the test can read them back. */
const t = ((_key: string, options?: Record<string, unknown>) =>
  JSON.stringify(options ?? {})) as unknown as TFunction;

type Statement = { value: string; from: NumberBase; to: NumberBase };

function readStatement(prompt: string): Statement {
  const parsed = JSON.parse(prompt) as {
    value: string;
    from: string;
    to: string;
  };
  const from = BASE_BY_LABEL[parsed.from];
  const to = BASE_BY_LABEL[parsed.to];
  if (from === undefined || to === undefined) {
    throw new Error(`Unknown base label in prompt: ${prompt}`);
  }
  return { value: parsed.value, from, to };
}

function generate(difficulty: Difficulty, count: number) {
  return generateNumberBaseExercises({ difficulty, count, t });
}

describe("generateNumberBaseExercises", () => {
  test("returns exactly the requested number of exercises", () => {
    for (const count of [1, 7, 50]) {
      expect(generate("medium", count)).toHaveLength(count);
    }
  });

  test("every answer is the correct conversion of its statement", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      for (const exercise of generate(difficulty, 40)) {
        const { value, from, to } = readStatement(exercise.prompt);
        expect(exercise.answer).toBe(convertBase(value, from, to));
      }
    }
  });

  test("easy stays on small binary/decimal values", () => {
    for (const exercise of generate("easy", 40)) {
      const { value, from, to } = readStatement(exercise.prompt);
      expect([from, to].sort((a, b) => a - b)).toEqual([2, 10]);
      expect(parseInBase(value, from)).toBeLessThanOrEqual(255n);
    }
  });

  test("medium always involves octal or hexadecimal", () => {
    for (const exercise of generate("medium", 40)) {
      const { from, to } = readStatement(exercise.prompt);
      expect(from === 8 || from === 16 || to === 8 || to === 16).toBe(true);
    }
  });

  test("hard reaches values wider than the easy ceiling", () => {
    const values = generate("hard", 40).map((exercise) => {
      const { value, from } = readStatement(exercise.prompt);
      return parseInBase(value, from);
    });
    expect(values.some((value) => value > 255n)).toBe(true);
    expect(values.every((value) => value < 2n ** 32n)).toBe(true);
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
