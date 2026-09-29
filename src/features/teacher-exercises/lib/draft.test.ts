import { describe, expect, test } from "bun:test";
import type { TFunction } from "i18next";

import type { ExerciseTool } from "@/config/exerciseTools";
import {
  fromSet,
  generateBlock,
  isDraftValid,
  isGenerated,
  moveBlock,
  newBlock,
  requestedTotal,
  toSetInput,
  validateDraft,
  type Draft,
} from "@/features/teacher-exercises/lib/draft";

const t = ((key: string) => key) as unknown as TFunction;

const TOOL: ExerciseTool = {
  id: "fake",
  titleKey: "fake",
  generator: ({ count, difficulty }) =>
    Array.from({ length: count }, (_, i) => ({ prompt: `${difficulty} ${i}`, answer: String(i) })),
};

function draft(counts: string[], title = "Taller"): Draft {
  return { title, blocks: counts.map((count) => ({ ...newBlock("fake"), count })) };
}

describe("validateDraft", () => {
  test("a titled draft with valid blocks passes", () => {
    expect(isDraftValid(validateDraft(draft(["5", "5"])))).toBe(true);
  });

  test("flags a missing title and an empty block list", () => {
    const problems = validateDraft({ title: " ", blocks: [] });
    expect(problems.title).toBe(true);
    expect(problems.noBlocks).toBe(true);
  });

  test("flags each out-of-range count", () => {
    const d = draft(["0", "10", "51", ""]);
    const problems = validateDraft(d);
    expect(problems.counts.size).toBe(3);
    expect(problems.counts.has(d.blocks[1]!.key)).toBe(false);
  });

  test("caps the whole set at 100 exercises", () => {
    expect(requestedTotal(draft(["50", "50"]).blocks)).toBe(100);
    expect(validateDraft(draft(["50", "50"])).tooMany).toBe(false);
    expect(validateDraft(draft(["50", "50", "1"])).tooMany).toBe(true);
  });
});

describe("generation", () => {
  test("generates the requested count at the block's difficulty", () => {
    const block = { ...newBlock("fake"), difficulty: "hard" as const, count: "3" };
    const generated = generateBlock(block, TOOL, t);
    expect(generated.exercises).toHaveLength(3);
    expect(generated.exercises?.[0]?.prompt).toBe("hard 0");
  });

  test("only a fully generated draft becomes a set", () => {
    const d = draft(["2", "2"]);
    expect(toSetInput(d, "es")).toBeNull();

    const generated = { ...d, blocks: d.blocks.map((block) => generateBlock(block, TOOL, t)) };
    expect(isGenerated(generated)).toBe(true);
    const input = toSetInput(generated, "es");
    expect(input?.blocks.map((block) => block.exercises.length)).toEqual([2, 2]);
    expect(input?.language).toBe("es");
  });

  test("a saved set round-trips into a draft", () => {
    const set = {
      title: "Quiz",
      blocks: [{ toolId: "fake", difficulty: "medium" as const, exercises: [{ prompt: "p", answer: "a" }] }],
    };
    const back = fromSet(set);
    expect(back.blocks[0]).toMatchObject({ count: "1", difficulty: "medium", exercises: set.blocks[0]!.exercises });
  });
});

test("moveBlock ignores moves past either end", () => {
  const blocks = draft(["1", "2", "3"]).blocks;
  expect(moveBlock(blocks, 0, -1)).toBe(blocks);
  expect(moveBlock(blocks, 0, 2).map((b) => b.count)).toEqual(["2", "3", "1"]);
});
