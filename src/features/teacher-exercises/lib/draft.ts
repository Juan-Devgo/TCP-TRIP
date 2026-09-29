import type { TFunction } from "i18next";

import type { ExerciseTool } from "@/config/exerciseTools";
import {
  MAX_SET_EXERCISES,
  MAX_SET_TITLE_LENGTH,
  type ExerciseBlock,
  type ExerciseSetInput,
} from "@/lib/exercises/sets";
import {
  DEFAULT_EXERCISE_COUNT,
  MAX_EXERCISE_COUNT,
  MIN_EXERCISE_COUNT,
  type Difficulty,
  type Exercise,
} from "@/lib/exercises/utils";

/**
 * The set under construction in `Crear ejercicios`. Draft is local: nothing
 * reaches the server until the teacher saves.
 */

export type DraftBlock = {
  /** React key; stable across reorders. */
  key: string;
  toolId: string;
  difficulty: Difficulty;
  /** Raw input text, so an invalid value can be shown and corrected. */
  count: string;
  /** `null` until generated, and again whenever the block's settings change. */
  exercises: Exercise[] | null;
};

export type Draft = {
  title: string;
  blocks: DraftBlock[];
};

export function newBlock(toolId: string): DraftBlock {
  return {
    key: crypto.randomUUID(),
    toolId,
    difficulty: "easy",
    count: String(DEFAULT_EXERCISE_COUNT),
    exercises: null,
  };
}

export function parseCount(count: string): number | null {
  const value = Number(count);
  return count.trim() !== "" &&
    Number.isInteger(value) &&
    value >= MIN_EXERCISE_COUNT &&
    value <= MAX_EXERCISE_COUNT
    ? value
    : null;
}

/** Live total of what the settings ask for — invalid counts contribute nothing. */
export function requestedTotal(blocks: readonly DraftBlock[]): number {
  return blocks.reduce((sum, block) => sum + (parseCount(block.count) ?? 0), 0);
}

export type DraftProblems = {
  title: boolean;
  noBlocks: boolean;
  /** Keys of blocks whose count is out of range. */
  counts: Set<string>;
  tooMany: boolean;
};

export function validateDraft(draft: Draft): DraftProblems {
  const counts = new Set(
    draft.blocks.filter((block) => parseCount(block.count) === null).map((block) => block.key),
  );
  return {
    title: draft.title.trim() === "" || draft.title.length > MAX_SET_TITLE_LENGTH,
    noBlocks: draft.blocks.length === 0,
    counts,
    tooMany: requestedTotal(draft.blocks) > MAX_SET_EXERCISES,
  };
}

export function isDraftValid(problems: DraftProblems): boolean {
  return !problems.title && !problems.noBlocks && problems.counts.size === 0 && !problems.tooMany;
}

/** Runs the block's tool generator with the block's own settings. */
export function generateBlock(block: DraftBlock, tool: ExerciseTool, t: TFunction): DraftBlock {
  const count = parseCount(block.count);
  if (count === null) return block;
  return {
    ...block,
    exercises: tool.generator({ difficulty: block.difficulty, count, t }),
  };
}

export function isGenerated(draft: Draft): boolean {
  return draft.blocks.length > 0 && draft.blocks.every((block) => block.exercises !== null);
}

/** Only a fully generated draft can be saved — the exercises are what is stored. */
export function toSetInput(draft: Draft, language: string): ExerciseSetInput | null {
  if (!isGenerated(draft)) return null;
  return {
    title: draft.title.trim(),
    language,
    blocks: draft.blocks.map(
      (block): ExerciseBlock => ({
        toolId: block.toolId,
        difficulty: block.difficulty,
        exercises: block.exercises ?? [],
      }),
    ),
  };
}

/** A saved set, back into editable draft form (for editing an unused set). */
export function fromSet(set: { title: string; blocks: readonly ExerciseBlock[] }): Draft {
  return {
    title: set.title,
    blocks: set.blocks.map((block) => ({
      key: crypto.randomUUID(),
      toolId: block.toolId,
      difficulty: block.difficulty,
      count: String(block.exercises.length),
      exercises: block.exercises,
    })),
  };
}

export function moveBlock(blocks: DraftBlock[], from: number, to: number): DraftBlock[] {
  if (to < 0 || to >= blocks.length) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  if (!moved) return blocks;
  next.splice(to, 0, moved);
  return next;
}
