import type { TFunction } from "i18next";

import {
  calculateIpv4,
  formatIpv4,
  IP_CLASS_RANGES,
  maskFromPrefix,
  type Ipv4Result,
} from "@/features/ipv4-calculator/lib/ipv4";
import {
  collectDistinct,
  randomInt,
  randomItem,
  type Difficulty,
  type Exercise,
  type ExerciseGenerator,
} from "@/lib/exercises/utils";

/** What the student is asked to work out. */
type Question =
  | "network"
  | "broadcast"
  | "netMask"
  | "wildcard"
  | "firstHost"
  | "lastHost"
  | "hosts"
  | "ipClass"
  | "subnetCount"
  | "subnetHosts"
  | "subnetNetwork"
  | "fullMask";

type Level = {
  /** Prefix lengths the level draws from. */
  prefixes: number[];
  /** Bits added to the mask for subnetting; empty means no subnetting here. */
  added: number[];
  questions: Question[];
};

/**
 * Difficulty here is how far past the mask the student has to go: an easy
 * sheet stays on classful boundaries where the octets line up, a medium one
 * lands mid-octet, and a hard one adds bits to the mask and asks about the
 * subnets that come out.
 *
 * No level goes past `/28`, because a smaller block has no address left that
 * is not itself part of the answer — see `randomHost`.
 */
const LEVELS: Record<Difficulty, Level> = {
  easy: {
    prefixes: [8, 16, 24],
    added: [],
    questions: ["network", "broadcast", "netMask", "ipClass"],
  },
  medium: {
    prefixes: [9, 12, 18, 20, 22, 25, 26, 27, 28],
    added: [],
    questions: [
      "network",
      "broadcast",
      "wildcard",
      "firstHost",
      "lastHost",
      "hosts",
    ],
  },
  hard: {
    prefixes: [8, 16, 20, 24],
    added: [2, 3, 4, 5, 6],
    questions: ["subnetCount", "subnetHosts", "subnetNetwork", "fullMask"],
  },
};

/** A routable-looking unicast address: no 0.x, no loopback, no multicast. */
function randomAddressValue(): number {
  const first = randomItem([
    randomInt(1, 126),
    randomInt(128, 191),
    randomInt(192, 223),
  ]);
  return (
    ((first * 256 + randomInt(0, 255)) * 256 + randomInt(0, 255)) * 256 +
    randomInt(1, 254)
  );
}

/** Random address, cut down to the network address of its `/prefix` block. */
function randomNetwork(prefix: number): string {
  return formatIpv4((randomAddressValue() & maskFromPrefix(prefix)) >>> 0);
}

/**
 * A host address inside its own block, kept two addresses away from either
 * end. Offset 0 and the last offset are the network and the broadcast, and
 * the two next to them are the first and the last host: hand the student any
 * of those and the statement gives its own answer away ("the last host is the
 * address you were given, minus one"). Needs a block of at least 8 addresses,
 * so every level's prefixes stop at `/28`.
 */
function randomHost(prefix: number): string {
  const blockSize = 2 ** (32 - prefix);
  const network = (randomAddressValue() & maskFromPrefix(prefix)) >>> 0;
  return formatIpv4(network + randomInt(3, blockSize - 4));
}

/**
 * Exercises for the IPv4 calculator. Every statement is answered by the same
 * arithmetic the tool performs, so a student can check their own work by
 * typing the address into the calculator.
 */
export const generateIpv4Exercises: ExerciseGenerator = ({
  difficulty,
  count,
  t,
}) => {
  const level = LEVELS[difficulty];

  return collectDistinct(count, (): Exercise => {
    const mask = randomItem(level.prefixes);
    // Never add so many bits that the subnets have no host part left.
    const candidates = level.added.filter((bits) => bits <= 32 - mask - 2);
    const added = candidates.length > 0 ? randomItem(candidates) : 0;

    // A subnetting statement talks about a network, so it names one; the rest
    // hand the student a host address that sits inside the block.
    const ip = added > 0 ? randomNetwork(mask) : randomHost(mask);
    const result = calculateIpv4(ip, mask, added || undefined);
    const question = randomItem(level.questions);
    /** Only read by `subnetNetwork`, but fixed here so prompt and answer agree. */
    const index = randomInt(0, (result.totalSubnets ?? 1) - 1);

    return {
      prompt: t(`tools.ipv4Calculator.exercises.${question}`, {
        ip,
        mask,
        prefix: result.prefix,
        submask: added,
        index,
      }),
      answer: answerFor(question, result, index, t),
    };
  });
};

function answerFor(
  question: Question,
  result: Ipv4Result,
  /** Which subnet `subnetNetwork` asked about, counting from zero. */
  index: number,
  t: TFunction,
): string {
  switch (question) {
    case "network":
      return `${result.networkAddress}/${result.prefix}`;
    case "broadcast":
      return result.broadcastAddress;
    case "netMask":
      return result.netMask;
    case "wildcard":
      return result.wildcardMask;
    case "firstHost":
      return result.hasHosts
        ? result.firstHost
        : t("tools.ipv4Calculator.exercises.noHosts");
    case "lastHost":
      return result.hasHosts
        ? result.lastHost
        : t("tools.ipv4Calculator.exercises.noHosts");
    case "hosts":
      return String(result.totalHosts);
    case "ipClass":
      return `${result.ipClass} (${IP_CLASS_RANGES[result.ipClass]})`;
    case "subnetCount":
      return String(result.totalSubnets ?? 0);
    case "subnetHosts":
      // Hosts inside one subnet, not the whole network's usable total.
      return String(Math.max(0, 2 ** (32 - result.prefix) - 2));
    case "subnetNetwork": {
      const subnet = result.subnets?.[index];
      return subnet
        ? `${subnet.networkAddress}/${subnet.prefix}`
        : result.networkAddress;
    }
    case "fullMask":
      return result.fullMask ?? result.netMask;
  }
}
