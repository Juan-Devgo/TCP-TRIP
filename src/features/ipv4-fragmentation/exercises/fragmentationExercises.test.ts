import { describe, expect, test } from "bun:test";
import type { TFunction } from "i18next";

import { generateFragmentationExercises } from "@/features/ipv4-fragmentation/exercises/fragmentationExercises";
import {
  checkMtu,
  fragment,
} from "@/features/ipv4-fragmentation/lib/fragmentation";
import { DIFFICULTIES, type Difficulty } from "@/lib/exercises/utils";

/** Serializes key and interpolation values so the test can read them back. */
const t = ((key: string, options?: Record<string, unknown>) =>
  JSON.stringify({ key, ...(options ?? {}) })) as unknown as TFunction;

type Statement = {
  key: string;
  totalLength: number;
  mtu: number;
  index?: number;
};

function generate(difficulty: Difficulty, count: number) {
  return generateFragmentationExercises({ difficulty, count, t });
}

function readStatement(prompt: string): Statement {
  return JSON.parse(prompt) as Statement;
}

function question(statement: Statement): string {
  return statement.key.split(".").at(-1) ?? "";
}

describe("generateFragmentationExercises", () => {
  test("returns exactly the requested number of exercises", () => {
    for (const count of [1, 7, 50]) {
      expect(generate("medium", count)).toHaveLength(count);
    }
  });

  test("never uses an MTU the calculator would reject", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const exercise of generate(difficulty, 50)) {
        const { mtu, totalLength } = readStatement(exercise.prompt);
        expect(checkMtu(mtu)).toBeNull();
        expect(totalLength).toBeGreaterThan(mtu);
      }
    }
  });

  test("each level splits into the fragment count it promises", () => {
    const ranges: Record<Difficulty, [number, number]> = {
      easy: [2, 3],
      medium: [3, 6],
      hard: [7, 12],
    };
    for (const difficulty of DIFFICULTIES) {
      const [min, max] = ranges[difficulty];
      for (const exercise of generate(difficulty, 40)) {
        const { totalLength, mtu } = readStatement(exercise.prompt);
        const fragments = fragment(totalLength, mtu).fragments.length;
        expect(fragments).toBeGreaterThanOrEqual(min);
        expect(fragments).toBeLessThanOrEqual(max);
      }
    }
  });

  test("easy stays on 1500 bytes; hard always asks for the full table", () => {
    for (const exercise of generate("easy", 30)) {
      expect(readStatement(exercise.prompt).mtu).toBe(1500);
    }
    for (const exercise of generate("hard", 30)) {
      expect(question(readStatement(exercise.prompt))).toBe("table");
    }
  });

  test("medium never points at the first fragment", () => {
    for (const exercise of generate("medium", 50)) {
      const statement = readStatement(exercise.prompt);
      if (statement.index !== undefined) {
        expect(statement.index).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("every answer matches the calculator", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const exercise of generate(difficulty, 40)) {
        const statement = readStatement(exercise.prompt);
        const result = fragment(statement.totalLength, statement.mtu);
        const target = result.fragments[(statement.index ?? 1) - 1];

        switch (question(statement)) {
          case "count":
            expect(exercise.answer).toBe(String(result.fragments.length));
            break;
          case "offset":
            expect(JSON.parse(exercise.answer)).toMatchObject({
              blocks: target?.header.fragmentOffset,
              bytes: target?.dataStart,
            });
            break;
          case "totalLength":
            expect(JSON.parse(exercise.answer).bytes).toBe(
              target?.header.totalLength,
            );
            break;
          case "data":
            expect(JSON.parse(exercise.answer).bytes).toBe(target?.dataBytes);
            break;
          case "table": {
            const rows = exercise.answer.split("\n").map((row) => JSON.parse(row));
            expect(rows).toHaveLength(result.fragments.length);
            rows.forEach((row, index) => {
              const { header, dataBytes } = result.fragments[index]!;
              expect(row).toMatchObject({
                index: index + 1,
                data: dataBytes,
                totalLength: header.totalLength,
                mf: header.mf,
                offset: header.fragmentOffset,
              });
            });
            break;
          }
          default:
            throw new Error(`unknown question ${statement.key}`);
        }
      }
    }
  });
});
