/**
 * The IPv4 header checksum, as RFC 791 §3.1 defines it and RFC 1071 explains
 * how to compute it: the 16-bit one's complement of the one's complement sum
 * of every 16-bit word of the header.
 *
 * Every step is kept, not only the answer — the calculator shows the words,
 * the sum, each fold of the carry and the final complement.
 *
 * Out of scope on purpose: options (the header is always 20 bytes, IHL 5),
 * the TCP/UDP pseudo-header and incremental updates (RFC 1624).
 */

/** IHL 5: a header without options. */
export const IPV4_HEADER_BYTES = 20;
/** Ten 16-bit words in a 20-byte header. */
export const HEADER_WORDS = IPV4_HEADER_BYTES / 2;

export const IPV4_VERSION = 4;
/** In 32-bit words: 5 × 4 = 20 bytes. */
export const IPV4_IHL = 5;

/** ToS, TTL and Protocol are 8-bit fields (RFC 791 §3.1). */
export const MAX_BYTE = 255;
/** Total Length and Identification are 16-bit fields (RFC 791 §3.1). */
export const MAX_WORD = 0xffff;
/** Total Length counts the header itself, so it is at least 20. */
export const MIN_TOTAL_LENGTH = IPV4_HEADER_BYTES;
/** Fragment Offset is a 13-bit field (RFC 791 §3.1). */
export const MAX_FRAGMENT_OFFSET = 0x1fff;

export type ChecksumMode = "calculate" | "verify";

/**
 * `pasteLength` carries the number of hex digits read, so an odd count (half
 * a byte) can be reported as it is.
 */
export type ChecksumErrorCode =
  | "pasteNotHex"
  | "pasteLength"
  | "pasteVersion"
  | "pasteIhl"
  | "pasteReserved"
  | "tosOutOfRange"
  | "totalLengthOutOfRange"
  | "identificationOutOfRange"
  | "fragmentOffsetOutOfRange"
  | "ttlOutOfRange"
  | "protocolOutOfRange"
  | "checksumNotHex"
  | "invalidIp";

export class ChecksumError extends Error {
  readonly code: ChecksumErrorCode;
  readonly detail: string;

  constructor(code: ChecksumErrorCode, detail = "") {
    super(`${code}: ${detail}`);
    this.name = "ChecksumError";
    this.code = code;
    this.detail = detail;
  }
}

/** The 20-byte header, field by field, in RFC 791 order. */
export type Ipv4Header = {
  version: number;
  ihl: number;
  tos: number;
  totalLength: number;
  identification: number;
  /** The reserved flag bit; must be 0. */
  reserved: 0;
  /** Don't Fragment. */
  df: 0 | 1;
  /** More Fragments. */
  mf: 0 | 1;
  /** In blocks of 8 bytes. */
  fragmentOffset: number;
  ttl: number;
  protocol: number;
  checksum: number;
  sourceIp: string;
  destinationIp: string;
};

export type HeaderField = keyof Ipv4Header;

/** One 16-bit word of the header and the fields whose bits make it up. */
export type HeaderWord = {
  value: number;
  /** The two bytes behind the word, high first. */
  bytes: [high: number, low: number];
  fields: HeaderField[];
};

/** Which fields each of the ten words carries, in order. */
export const WORD_FIELDS: readonly HeaderField[][] = [
  ["version", "ihl", "tos"],
  ["totalLength"],
  ["identification"],
  ["reserved", "df", "mf", "fragmentOffset"],
  ["ttl", "protocol"],
  ["checksum"],
  ["sourceIp"],
  ["sourceIp"],
  ["destinationIp"],
  ["destinationIp"],
];

/** Index of the word that holds the Checksum field. */
export const CHECKSUM_WORD = 5;

/** One fold: the carry above bit 15 added back into the low 16 bits. */
export type Fold = {
  /** What was folded. */
  value: number;
  /** Its low 16 bits. */
  low: number;
  /** Everything above bit 15, shifted down. */
  carry: number;
  /** `low + carry`, which may itself carry again. */
  result: number;
};

export type OnesComplementSum = {
  /** Plain sum of the words, carries included. */
  sum: number;
  /** Empty when the sum already fits in 16 bits. */
  folds: Fold[];
  /** The sum after every fold: 16 bits. */
  folded: number;
  /** `~folded` on 16 bits. */
  complement: number;
};

/**
 * What the result means for the mode the student chose:
 * - `calculated`: Checksum was 0000, the result is the checksum to send.
 * - `checksumNotZero`: calculating, but Checksum was not 0000.
 * - `alreadyCalculated`: calculating with a filled Checksum that verifies.
 * - `accepted` / `rejected`: verifying a received header.
 */
export type Interpretation =
  | "calculated"
  | "checksumNotZero"
  | "alreadyCalculated"
  | "accepted"
  | "rejected";

export type ChecksumResult = {
  mode: ChecksumMode;
  header: Ipv4Header;
  words: HeaderWord[];
  steps: OnesComplementSum;
  /** The 16-bit value the procedure ends in. */
  result: number;
  interpretation: Interpretation;
};

/** Lowercase hex, zero-padded to `digits`: `hex(0x40, 2)` → `"40"`. */
export function hex(value: number, digits: number): string {
  return value.toString(16).padStart(digits, "0");
}

/** Binary in nibbles: `binary(0x4e19, 16)` → `"0100 1110 0001 1001"`. */
export function binary(value: number, bits: number): string {
  const digits = value.toString(2).padStart(bits, "0");
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 4) {
    groups.unshift(digits.slice(Math.max(0, end - 4), end));
  }
  return groups.join(" ");
}

export function isValidIpv4(ip: string): boolean {
  const octets = ip.split(".");
  if (octets.length !== 4) return false;
  return octets.every((octet) => {
    const value = Number(octet);
    return (
      octet !== "" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 255 &&
      // Rejects "01" and " 1": the canonical spelling round-trips.
      octet === String(value)
    );
  });
}

function ipToBytes(ip: string): number[] {
  if (!isValidIpv4(ip)) throw new ChecksumError("invalidIp", ip);
  return ip.split(".").map(Number);
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function checkTos(value: number): ChecksumErrorCode | null {
  return inRange(value, 0, MAX_BYTE) ? null : "tosOutOfRange";
}

export function checkTotalLength(value: number): ChecksumErrorCode | null {
  return inRange(value, MIN_TOTAL_LENGTH, MAX_WORD)
    ? null
    : "totalLengthOutOfRange";
}

export function checkIdentification(value: number): ChecksumErrorCode | null {
  return inRange(value, 0, MAX_WORD) ? null : "identificationOutOfRange";
}

export function checkFragmentOffset(value: number): ChecksumErrorCode | null {
  return inRange(value, 0, MAX_FRAGMENT_OFFSET)
    ? null
    : "fragmentOffsetOutOfRange";
}

export function checkTtl(value: number): ChecksumErrorCode | null {
  return inRange(value, 0, MAX_BYTE) ? null : "ttlOutOfRange";
}

export function checkProtocol(value: number): ChecksumErrorCode | null {
  return inRange(value, 0, MAX_BYTE) ? null : "protocolOutOfRange";
}

/** Checksum is typed as it travels: exactly four hex digits. */
export function checkChecksumHex(text: string): ChecksumErrorCode | null {
  return /^[0-9a-f]{4}$/i.test(text) ? null : "checksumNotHex";
}

export function checkIp(ip: string): ChecksumErrorCode | null {
  return isValidIpv4(ip) ? null : "invalidIp";
}

/** Throws the first rule a field breaks, so no result is built from it. */
export function validateHeader(header: Ipv4Header): void {
  const code =
    checkTos(header.tos) ??
    checkTotalLength(header.totalLength) ??
    checkIdentification(header.identification) ??
    checkFragmentOffset(header.fragmentOffset) ??
    checkTtl(header.ttl) ??
    checkProtocol(header.protocol) ??
    (inRange(header.checksum, 0, MAX_WORD) ? null : "checksumNotHex") ??
    checkIp(header.sourceIp) ??
    checkIp(header.destinationIp);
  if (code) throw new ChecksumError(code);
}

/** The header as it travels: 20 bytes in network order. */
export function headerToBytes(header: Ipv4Header): number[] {
  const flags = (header.reserved << 2) | (header.df << 1) | header.mf;
  const flagsAndOffset = (flags << 13) | header.fragmentOffset;
  return [
    (header.version << 4) | header.ihl,
    header.tos,
    header.totalLength >> 8,
    header.totalLength & 0xff,
    header.identification >> 8,
    header.identification & 0xff,
    flagsAndOffset >> 8,
    flagsAndOffset & 0xff,
    header.ttl,
    header.protocol,
    header.checksum >> 8,
    header.checksum & 0xff,
    ...ipToBytes(header.sourceIp),
    ...ipToBytes(header.destinationIp),
  ];
}

/** Step 1: the header grouped into its ten 16-bit words. */
export function headerToWords(header: Ipv4Header): HeaderWord[] {
  const bytes = headerToBytes(header);
  return WORD_FIELDS.map((fields, index) => {
    const high = bytes[index * 2] ?? 0;
    const low = bytes[index * 2 + 1] ?? 0;
    return { value: (high << 8) | low, bytes: [high, low], fields };
  });
}

/** `45 00 00 3c …`: the header as a student would copy it from a capture. */
export function headerToHex(header: Ipv4Header): string {
  return headerToBytes(header)
    .map((byte) => hex(byte, 2))
    .join(" ");
}

/**
 * Decodes 20 bytes into a header. Only what this tool can represent is
 * accepted: version 4, IHL 5 (no options) and the reserved bit clear.
 */
export function bytesToHeader(bytes: readonly number[]): Ipv4Header {
  if (bytes.length !== IPV4_HEADER_BYTES) {
    throw new ChecksumError("pasteLength", String(bytes.length * 2));
  }
  const at = (index: number) => bytes[index] ?? 0;
  const version = at(0) >> 4;
  const ihl = at(0) & 0x0f;
  if (version !== IPV4_VERSION) {
    throw new ChecksumError("pasteVersion", String(version));
  }
  if (ihl !== IPV4_IHL) throw new ChecksumError("pasteIhl", String(ihl));

  const flagsAndOffset = (at(6) << 8) | at(7);
  if (flagsAndOffset & 0x8000) throw new ChecksumError("pasteReserved");

  return {
    version,
    ihl,
    tos: at(1),
    totalLength: (at(2) << 8) | at(3),
    identification: (at(4) << 8) | at(5),
    reserved: 0,
    df: (flagsAndOffset & 0x4000 ? 1 : 0),
    mf: (flagsAndOffset & 0x2000 ? 1 : 0),
    fragmentOffset: flagsAndOffset & MAX_FRAGMENT_OFFSET,
    ttl: at(8),
    protocol: at(9),
    checksum: (at(10) << 8) | at(11),
    sourceIp: [12, 13, 14, 15].map(at).join("."),
    destinationIp: [16, 17, 18, 19].map(at).join("."),
  };
}

/**
 * Reads a pasted header. Tolerates what captures and textbooks put between
 * bytes — spaces, line breaks, `:` and `0x` prefixes — and nothing else.
 */
export function parseHeaderHex(text: string): Ipv4Header {
  const digits = text
    .replace(/(^|[\s:])0x/gi, "$1")
    .replace(/[\s:]/g, "");
  if (!/^[0-9a-f]*$/i.test(digits)) {
    throw new ChecksumError("pasteNotHex", digits);
  }
  if (digits.length !== IPV4_HEADER_BYTES * 2) {
    throw new ChecksumError("pasteLength", String(digits.length));
  }

  const header = bytesToHeader(
    Array.from({ length: IPV4_HEADER_BYTES }, (_, index) =>
      Number.parseInt(digits.slice(index * 2, index * 2 + 2), 16),
    ),
  );
  // A pasted Total Length below 20 cannot describe this header.
  const code = checkTotalLength(header.totalLength);
  if (code) throw new ChecksumError(code, String(header.totalLength));
  return header;
}

/**
 * Steps 2–4: sum the words, fold every carry back into the low 16 bits (one's
 * complement addition never drops a carry) and complement the result.
 */
export function onesComplementSum(words: readonly number[]): OnesComplementSum {
  const sum = words.reduce((total, word) => total + word, 0);
  const folds: Fold[] = [];
  let value = sum;
  while (value > MAX_WORD) {
    const low = value & MAX_WORD;
    const carry = Math.floor(value / 0x10000);
    const result = low + carry;
    folds.push({ value, low, carry, result });
    value = result;
  }
  return { sum, folds, folded: value, complement: ~value & MAX_WORD };
}

export function interpret(
  mode: ChecksumMode,
  checksumField: number,
  result: number,
): Interpretation {
  if (mode === "verify") return result === 0 ? "accepted" : "rejected";
  if (checksumField === 0) return "calculated";
  return result === 0 ? "alreadyCalculated" : "checksumNotZero";
}

/** The whole procedure for one header in one mode. */
export function checksum(
  header: Ipv4Header,
  mode: ChecksumMode,
): ChecksumResult {
  validateHeader(header);
  const words = headerToWords(header);
  const steps = onesComplementSum(words.map((word) => word.value));
  return {
    mode,
    header,
    words,
    steps,
    result: steps.complement,
    interpretation: interpret(mode, header.checksum, steps.complement),
  };
}

/** The checksum a sender would put in the header. */
export function computeChecksum(header: Ipv4Header): number {
  return checksum({ ...header, checksum: 0 }, "calculate").result;
}
