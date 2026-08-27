import { describe, expect, test } from "bun:test";
import type { TFunction } from "i18next";

import { generateIpv4Exercises } from "@/features/ipv4-calculator/exercises/ipv4Exercises";
import {
  calculateIpv4,
  isValidIpv4,
  parseIpv4,
} from "@/features/ipv4-calculator/lib/ipv4";
import { DIFFICULTIES, type Difficulty } from "@/lib/exercises/utils";

/** Serializes key and interpolation values so the test can read them back. */
const t = ((key: string, options?: Record<string, unknown>) =>
  JSON.stringify({ key, ...(options ?? {}) })) as unknown as TFunction;

type Statement = {
  key: string;
  ip: string;
  mask: number;
  prefix: number;
  submask: number;
  index: number;
};

function generate(difficulty: Difficulty, count: number) {
  return generateIpv4Exercises({ difficulty, count, t });
}

function readStatement(prompt: string): Statement {
  return JSON.parse(prompt) as Statement;
}

describe("generateIpv4Exercises", () => {
  test("returns exactly the requested number of exercises", () => {
    for (const count of [1, 7, 50]) {
      expect(generate("hard", count)).toHaveLength(count);
    }
  });

  test("every statement names a valid address and prefix", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const exercise of generate(difficulty, 40)) {
        const statement = readStatement(exercise.prompt);
        expect(isValidIpv4(statement.ip)).toBe(true);
        expect(statement.prefix).toBeGreaterThanOrEqual(statement.mask);
        expect(statement.prefix).toBeLessThanOrEqual(32);
      }
    }
  });

  test("only the hard sheet adds bits, and always leaves a host part", () => {
    for (const exercise of generate("easy", 30)) {
      expect(readStatement(exercise.prompt).submask).toBe(0);
    }
    for (const exercise of generate("medium", 30)) {
      expect(readStatement(exercise.prompt).submask).toBe(0);
    }
    for (const exercise of generate("hard", 40)) {
      const { mask, submask, prefix } = readStatement(exercise.prompt);
      expect(submask).toBeGreaterThanOrEqual(2);
      expect(prefix).toBe(mask + submask);
      // Two bits of host left is what keeps a subnet assignable.
      expect(prefix).toBeLessThanOrEqual(30);
    }
  });

  test("a host statement never hands the student its own answer", () => {
    for (const difficulty of ["easy", "medium"] as const) {
      for (const exercise of generate(difficulty, 60)) {
        const { ip, mask } = readStatement(exercise.prompt);
        const result = calculateIpv4(ip, mask);
        // Two addresses of clearance at each end: the network, the broadcast
        // and both ends of the usable range must all be worked out, not read
        // off the statement.
        expect(ip).not.toBe(result.networkAddress);
        expect(ip).not.toBe(result.broadcastAddress);
        expect(ip).not.toBe(result.firstHost);
        expect(ip).not.toBe(result.lastHost);
        expect(parseIpv4(ip) - parseIpv4(result.firstHost)).toBeGreaterThanOrEqual(2);
        expect(parseIpv4(result.lastHost) - parseIpv4(ip)).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("a subnetting statement names a real network address", () => {
    for (const exercise of generate("hard", 40)) {
      const { ip, mask } = readStatement(exercise.prompt);
      expect(calculateIpv4(ip, mask).networkAddress).toBe(ip);
    }
  });

  test("answers match what the calculator itself reports", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const exercise of generate(difficulty, 40)) {
        const { key, ip, mask, submask, index } = readStatement(exercise.prompt);
        const result = calculateIpv4(ip, mask, submask || undefined);

        switch (key) {
          case "tools.ipv4Calculator.exercises.network":
            expect(exercise.answer).toBe(
              `${result.networkAddress}/${result.prefix}`,
            );
            break;
          case "tools.ipv4Calculator.exercises.broadcast":
            expect(exercise.answer).toBe(result.broadcastAddress);
            break;
          case "tools.ipv4Calculator.exercises.netMask":
            expect(exercise.answer).toBe(result.netMask);
            break;
          case "tools.ipv4Calculator.exercises.wildcard":
            expect(exercise.answer).toBe(result.wildcardMask);
            break;
          case "tools.ipv4Calculator.exercises.hosts":
            expect(exercise.answer).toBe(String(result.totalHosts));
            break;
          case "tools.ipv4Calculator.exercises.subnetCount":
            expect(exercise.answer).toBe(String(result.totalSubnets));
            break;
          case "tools.ipv4Calculator.exercises.fullMask":
            expect(result.fullMask).not.toBeNull();
            expect(exercise.answer).toBe(result.fullMask ?? "");
            break;
          case "tools.ipv4Calculator.exercises.subnetNetwork":
            // The prompt's subnet index is what the answer must describe.
            expect(exercise.answer).toBe(
              `${result.subnets?.[index]?.networkAddress}/${result.prefix}`,
            );
            break;
          default:
            expect(exercise.answer.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
