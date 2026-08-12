/** Numeric bases the converter supports, in the order they appear in the UI. */
export const NUMBER_BASES = [2, 8, 10, 16] as const;

export type NumberBase = (typeof NUMBER_BASES)[number];

/** Upper bound for the zero-padded result length (a 64-bit word). */
export const MAX_LENGTH = 64;

const DIGITS = "0123456789ABCDEF";

export function isNumberBase(value: unknown): value is NumberBase {
  return NUMBER_BASES.includes(value as NumberBase);
}

/** Digits that are legal in `base`, e.g. `["0", "1"]` for binary. */
export function digitsForBase(base: NumberBase): string[] {
  return DIGITS.slice(0, base).split("");
}

/**
 * Parse `value` as an unsigned integer written in `base`.
 * Uses BigInt so 64-bit protocol fields survive without precision loss.
 *
 * @throws RangeError when a character is not a digit of `base`.
 */
export function parseInBase(value: string, base: NumberBase): bigint {
  const normalized = value.trim().toUpperCase();
  if (normalized === "") return 0n;

  const allowed = DIGITS.slice(0, base);
  const bigBase = BigInt(base);
  let result = 0n;

  for (const char of normalized) {
    const digit = allowed.indexOf(char);
    if (digit === -1) {
      throw new RangeError(`"${char}" is not a valid digit in base ${base}`);
    }
    result = result * bigBase + BigInt(digit);
  }

  return result;
}

/** Render `value` in `base`, uppercase (hex letters are uppercase everywhere). */
export function formatInBase(value: bigint, base: NumberBase): string {
  return value.toString(base).toUpperCase();
}

/**
 * Convert `value` from one base to another, left-padded with zeros to `length`
 * digits. Results longer than `length` are never truncated.
 */
export function convertBase(
  value: string,
  from: NumberBase,
  to: NumberBase,
  length = 1,
): string {
  const parsed = parseInBase(value, from);
  return formatInBase(parsed, to).padStart(Math.max(1, length), "0");
}
