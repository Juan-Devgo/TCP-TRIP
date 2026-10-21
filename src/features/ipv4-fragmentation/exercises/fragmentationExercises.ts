import type { TFunction } from "i18next";

import {
  fragment,
  IPV4_HEADER_BYTES,
  type FragmentationResult,
} from "@/features/ipv4-fragmentation/lib/fragmentation";
import {
  collectDistinct,
  randomInt,
  randomItem,
  type Difficulty,
  type Exercise,
  type ExerciseGenerator,
} from "@/lib/exercises/utils";

/** What the student is asked to work out. */
type Question = "count" | "offset" | "totalLength" | "data" | "table";

/** Which fragment a single-fragment question points at. */
type Target = "any" | "intermediateOrLast";

type Level = {
  /** Every MTU leaves a data size that is a multiple of 8 — see `checkMtu`. */
  mtus: number[];
  /** Inclusive range of fragments the datagram must split into. */
  fragments: [min: number, max: number];
  questions: Question[];
  target: Target;
};

/**
 * Difficulty is the size of the split and how much of it is asked for: an
 * easy sheet stays on Ethernet's 1500 bytes and asks one value of a short
 * split, a medium one changes the MTU and points past the first fragment, and
 * a hard one asks for the whole table of a long split.
 */
const LEVELS: Record<Difficulty, Level> = {
  easy: {
    mtus: [1500],
    fragments: [2, 3],
    questions: ["count", "offset", "totalLength", "data"],
    target: "any",
  },
  medium: {
    mtus: [596, 820, 1004, 1300, 1492, 2020],
    fragments: [3, 6],
    questions: ["count", "offset", "totalLength", "data"],
    target: "intermediateOrLast",
  },
  hard: {
    mtus: [68, 276, 508, 596, 820],
    fragments: [7, 12],
    questions: ["table"],
    target: "intermediateOrLast",
  },
};

/** A Total Length that splits into exactly `count` fragments on `mtu`. */
function totalLengthFor(mtu: number, count: number): number {
  const perFragment = mtu - IPV4_HEADER_BYTES;
  const data = randomInt((count - 1) * perFragment + 1, count * perFragment);
  return data + IPV4_HEADER_BYTES;
}

/** 1-based fragment number the question is about. */
function pickFragment(total: number, target: Target): number {
  return target === "any" ? randomInt(1, total) : randomInt(2, total);
}

function tableAnswer(result: FragmentationResult, t: TFunction): string {
  return result.fragments
    .map(({ header, dataBytes }, index) =>
      t("tools.ipv4Fragmentation.exercises.tableRow", {
        index: index + 1,
        data: dataBytes,
        totalLength: header.totalLength,
        mf: header.mf,
        offset: header.fragmentOffset,
      }),
    )
    .join("\n");
}

function makeExercise(difficulty: Difficulty, t: TFunction): Exercise {
  const level = LEVELS[difficulty];
  const mtu = randomItem(level.mtus);
  const count = randomInt(...level.fragments);
  const totalLength = totalLengthFor(mtu, count);
  const result = fragment(totalLength, mtu);
  const question = randomItem(level.questions);
  const key = `tools.ipv4Fragmentation.exercises.${question}`;

  if (question === "count") {
    return {
      prompt: t(key, { totalLength, mtu }),
      answer: String(result.fragments.length),
    };
  }
  if (question === "table") {
    return {
      prompt: t(key, { totalLength, mtu }),
      answer: tableAnswer(result, t),
    };
  }

  const index = pickFragment(result.fragments.length, level.target);
  const target = result.fragments[index - 1];
  if (!target) throw new RangeError(`no fragment ${index}`);
  const prompt = t(key, { totalLength, mtu, index });

  switch (question) {
    case "offset":
      return {
        prompt,
        answer: t("tools.ipv4Fragmentation.offsetValue", {
          blocks: target.header.fragmentOffset,
          bytes: target.dataStart,
        }),
      };
    case "totalLength":
      return {
        prompt,
        answer: t("tools.ipv4Fragmentation.bytesValue", {
          bytes: target.header.totalLength,
        }),
      };
    case "data":
      return {
        prompt,
        answer: t("tools.ipv4Fragmentation.bytesValue", {
          bytes: target.dataBytes,
        }),
      };
  }
}

export const generateFragmentationExercises: ExerciseGenerator = ({
  difficulty,
  count,
  t,
}) => collectDistinct(count, () => makeExercise(difficulty, t));
