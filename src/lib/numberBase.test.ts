import { describe, expect, test } from "bun:test";
import {
  convertBase,
  digitsForBase,
  isNumberBase,
  parseInBase,
} from "@/lib/numberBase";

describe("parseInBase", () => {
  test("parses each supported base", () => {
    expect(parseInBase("1010", 2)).toBe(10n);
    expect(parseInBase("777", 8)).toBe(511n);
    expect(parseInBase("255", 10)).toBe(255n);
    expect(parseInBase("ff", 16)).toBe(255n);
  });

  test("treats an empty string as zero", () => {
    expect(parseInBase("   ", 16)).toBe(0n);
  });

  test("rejects digits outside the base", () => {
    expect(() => parseInBase("2", 2)).toThrow(RangeError);
    expect(() => parseInBase("8", 8)).toThrow(RangeError);
    expect(() => parseInBase("G", 16)).toThrow(RangeError);
  });

  test("keeps precision past Number.MAX_SAFE_INTEGER", () => {
    expect(parseInBase("FFFFFFFFFFFFFFFF", 16)).toBe(18446744073709551615n);
  });
});

describe("convertBase", () => {
  test("converts between bases", () => {
    expect(convertBase("255", 10, 16)).toBe("FF");
    expect(convertBase("FF", 16, 2)).toBe("11111111");
    expect(convertBase("11111111", 2, 8)).toBe("377");
  });

  test("zero-pads to the requested length", () => {
    expect(convertBase("5", 10, 2, 8)).toBe("00000101");
  });

  test("never truncates a result longer than the requested length", () => {
    expect(convertBase("255", 10, 2, 4)).toBe("11111111");
  });
});

describe("digitsForBase / isNumberBase", () => {
  test("lists the legal digits", () => {
    expect(digitsForBase(2)).toEqual(["0", "1"]);
    expect(digitsForBase(16).at(-1)).toBe("F");
  });

  test("guards unsupported bases", () => {
    expect(isNumberBase(16)).toBe(true);
    expect(isNumberBase(3)).toBe(false);
  });
});
