export function convertBase(
  numberStr: string,
  fromBase: number,
  toBase: number,
  length: number,
): string {
  if (fromBase !== 2 && fromBase !== 8 && fromBase !== 10 && fromBase !== 16) {
    throw new Error(
      'Unsupported fromBase. Supported bases are 2, 8, 10, and 16.',
    );
  }

  if (toBase !== 2 && toBase !== 8 && toBase !== 10 && toBase !== 16) {
    throw new Error(
      'Unsupported toBase. Supported bases are 2, 8, 10, and 16.',
    );
  }

  return parseInt(numberStr, fromBase).toString(toBase).padStart(length, '0');
}
