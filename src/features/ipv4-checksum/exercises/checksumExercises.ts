import type { TFunction } from "i18next";

import {
  checksum,
  computeChecksum,
  headerToBytes,
  hex,
  IPV4_HEADER_BYTES,
  onesComplementSum,
  parseHeaderHex,
  type Fold,
  type Ipv4Header,
} from "@/features/ipv4-checksum/lib/checksum";
import {
  collectDistinct,
  randomInt,
  randomItem,
  type Difficulty,
  type Exercise,
  type ExerciseGenerator,
} from "@/lib/exercises/utils";

/**
 * What the student is asked to work out:
 * - `fold`: fold the carry of a given sum and complement it.
 * - `calculate`: the checksum of a header whose Checksum is 0000.
 * - `verify`: accept or reject a received header.
 */
type Question = "fold" | "calculate" | "verify";

/** How a header to verify was damaged on the way, if at all. */
type Damage = "none" | "byte" | "bit";

type Level = {
  questions: Question[];
  /** How many folds a `fold` sum needs. */
  folds: 1 | 2;
  /** Damage drawn for a `verify` header. */
  damage: Damage[];
};

/**
 * Difficulty is how much of the procedure is asked for and how subtle the
 * trap is: an easy sheet stops at folding and complementing a sum that folds
 * once, a medium one hands over whole headers (a few with a whole byte
 * changed), and a hard one flips a single bit or needs a second fold.
 */
const LEVELS: Record<Difficulty, Level> = {
  easy: { questions: ["fold"], folds: 1, damage: ["none"] },
  medium: {
    questions: ["calculate", "verify"],
    folds: 1,
    damage: ["none", "byte"],
  },
  hard: { questions: ["verify", "fold"], folds: 2, damage: ["bit"] },
};

const DIFFSERV_VALUES = [0x00, 0x00, 0x10, 0x08, 0xb8];
const TTL_VALUES = [32, 63, 64, 128, 255];
/** ICMP, TCP and UDP: what students meet in captures. */
const PROTOCOLS = [1, 6, 17];

function randomIp(): string {
  const first = randomItem([10, 172, 192, 200, 8]);
  return [first, randomInt(0, 255), randomInt(0, 255), randomInt(1, 254)].join(".");
}

/** A header the calculator accepts, carrying its correct checksum. */
function randomHeader(): Ipv4Header {
  const header: Ipv4Header = {
    version: 4,
    ihl: 5,
    diffServ: randomItem(DIFFSERV_VALUES),
    totalLength: randomInt(IPV4_HEADER_BYTES + 8, 1500),
    identification: randomInt(0, 0xffff),
    reserved: 0,
    df: randomItem([0, 1] as const),
    mf: 0,
    fragmentOffset: 0,
    ttl: randomItem(TTL_VALUES),
    protocol: randomItem(PROTOCOLS),
    checksum: 0,
    sourceIp: randomIp(),
    destinationIp: randomIp(),
  };
  return { ...header, checksum: computeChecksum(header) };
}

function toHex(bytes: readonly number[]): string {
  return bytes.map((byte) => hex(byte, 2)).join(" ");
}

/**
 * Damages one byte or one bit after the first byte (Version and IHL stay, so
 * the header is still one the calculator reads), and retries until the result
 * is still a header the calculator would accept as input.
 */
function damage(header: Ipv4Header, kind: Damage): string {
  const original = headerToBytes(header);
  if (kind === "none") return toHex(original);

  for (;;) {
    const bytes = [...original];
    const index = randomInt(1, IPV4_HEADER_BYTES - 1);
    const byte = bytes[index] ?? 0;
    bytes[index] =
      kind === "bit"
        ? byte ^ (1 << randomInt(0, 7))
        : (byte + randomInt(1, 0xff)) & 0xff;
    const text = toHex(bytes);
    try {
      parseHeaderHex(text);
      return text;
    } catch {
      // Landed on the reserved bit or pushed Total Length below 20: redraw.
    }
  }
}

/** A sum of ten words (carry up to 9) that needs exactly `folds` folds. */
function randomSum(folds: 1 | 2): number {
  const carry = randomInt(1, 9);
  const low =
    folds === 1
      ? randomInt(0, 0xffff - carry)
      : randomInt(0x10000 - carry, 0xffff);
  return carry * 0x10000 + low;
}

function foldLine(fold: Fold): string {
  return `0x${hex(fold.low, 4)} + 0x${hex(fold.carry, 4)} = 0x${hex(fold.result, 4)}`;
}

function makeExercise(difficulty: Difficulty, t: TFunction): Exercise {
  const level = LEVELS[difficulty];
  const question = randomItem(level.questions);
  const key = `tools.ipv4Checksum.exercises.${question}`;

  if (question === "fold") {
    const sum = randomSum(level.folds);
    const steps = onesComplementSum([sum]);
    return {
      prompt: t(key, { sum: `0x${sum.toString(16)}` }),
      answer: t("tools.ipv4Checksum.exercises.foldAnswer", {
        folds: steps.folds.map(foldLine).join("; "),
        folded: `0x${hex(steps.folded, 4)}`,
        checksum: `0x${hex(steps.complement, 4)}`,
      }),
    };
  }

  const header = randomHeader();

  if (question === "calculate") {
    const zeroed = { ...header, checksum: 0 };
    return {
      prompt: t(key, { header: toHex(headerToBytes(zeroed)) }),
      answer: t("tools.ipv4Checksum.exercises.calculateAnswer", {
        checksum: `0x${hex(header.checksum, 4)}`,
      }),
    };
  }

  const text = damage(header, randomItem(level.damage));
  const result = checksum(parseHeaderHex(text), "verify");
  return {
    prompt: t(key, { header: text }),
    answer: t(
      result.interpretation === "accepted"
        ? "tools.ipv4Checksum.exercises.verifyAccepted"
        : "tools.ipv4Checksum.exercises.verifyRejected",
      { result: `0x${hex(result.result, 4)}` },
    ),
  };
}

export const generateChecksumExercises: ExerciseGenerator = ({
  difficulty,
  count,
  t,
}) => collectDistinct(count, () => makeExercise(difficulty, t));
