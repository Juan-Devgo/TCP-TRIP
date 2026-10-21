import { describe, expect, test } from "bun:test";
import type { TFunction } from "i18next";

import { generateChecksumExercises } from "@/features/ipv4-checksum/exercises/checksumExercises";
import {
  checksum,
  onesComplementSum,
  parseHeaderHex,
} from "@/features/ipv4-checksum/lib/checksum";
import { DIFFICULTIES, type Difficulty } from "@/lib/exercises/utils";

/** Serializes key and interpolation values so the test can read them back. */
const t = ((key: string, options?: Record<string, unknown>) =>
  JSON.stringify({ key, ...(options ?? {}) })) as unknown as TFunction;

type Statement = { key: string; sum?: string; header?: string };

function generate(difficulty: Difficulty, count: number) {
  return generateChecksumExercises({ difficulty, count, t });
}

function read(text: string): Statement & Record<string, string> {
  return JSON.parse(text) as Statement & Record<string, string>;
}

function question(statement: Statement): string {
  return statement.key.split(".").at(-1) ?? "";
}

describe("generateChecksumExercises", () => {
  test("returns exactly the requested number of exercises", () => {
    for (const count of [1, 7, 50]) {
      expect(generate("medium", count)).toHaveLength(count);
    }
  });

  test("never uses a header the calculator would reject", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const exercise of generate(difficulty, 50)) {
        const { header } = read(exercise.prompt);
        if (header !== undefined) {
          expect(() => parseHeaderHex(header)).not.toThrow();
        }
      }
    }
  });

  test("easy asks only to fold a sum that folds once", () => {
    for (const exercise of generate("easy", 40)) {
      const statement = read(exercise.prompt);
      expect(question(statement)).toBe("fold");
      const steps = onesComplementSum([Number(statement.sum)]);
      expect(steps.folds).toHaveLength(1);
      expect(read(exercise.answer).checksum).toBe(
        `0x${steps.complement.toString(16).padStart(4, "0")}`,
      );
    }
  });

  test("medium hands over whole headers to calculate or verify", () => {
    for (const exercise of generate("medium", 40)) {
      const statement = read(exercise.prompt);
      expect(["calculate", "verify"]).toContain(question(statement));
      const header = parseHeaderHex(statement.header ?? "");
      if (question(statement) === "calculate") {
        expect(header.checksum).toBe(0);
        const expected = checksum(header, "calculate").result;
        expect(read(exercise.answer).checksum).toBe(
          `0x${expected.toString(16).padStart(4, "0")}`,
        );
      }
    }
  });

  test("hard flips a single bit, always caught, or needs a second fold", () => {
    for (const exercise of generate("hard", 40)) {
      const statement = read(exercise.prompt);
      if (question(statement) === "fold") {
        expect(onesComplementSum([Number(statement.sum)]).folds).toHaveLength(2);
      } else {
        expect(question(statement)).toBe("verify");
        expect(read(exercise.answer).key).toBe(
          "tools.ipv4Checksum.exercises.verifyRejected",
        );
      }
    }
  });

  test("verify answers agree with the calculator", () => {
    for (const exercise of generate("medium", 50)) {
      const statement = read(exercise.prompt);
      if (question(statement) !== "verify") continue;
      const result = checksum(parseHeaderHex(statement.header ?? ""), "verify");
      const answer = read(exercise.answer);
      expect(answer.key).toBe(
        result.result === 0
          ? "tools.ipv4Checksum.exercises.verifyAccepted"
          : "tools.ipv4Checksum.exercises.verifyRejected",
      );
    }
  });
});
