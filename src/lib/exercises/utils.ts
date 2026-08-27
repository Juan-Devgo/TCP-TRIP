import type { TFunction } from "i18next";

/** Difficulty levels every tool's exercise generator must support. */
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export const MIN_EXERCISE_COUNT = 1;
export const MAX_EXERCISE_COUNT = 50;
export const DEFAULT_EXERCISE_COUNT = 10;

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

/**
 * One exercise, already translated: the generator owns its copy so the PDF
 * writer never needs to know which tool produced it.
 */
export type Exercise = {
  /** The statement the student reads, e.g. "Convierte 1010 (BIN) a DEC.". */
  prompt: string;
  /** The expected result, shown only on the answer sheet. */
  answer: string;
};

export type ExerciseGeneratorOptions = {
  difficulty: Difficulty;
  count: number;
  t: TFunction;
};

/**
 * Contract every tool implements to join the exercise generator. Each tool
 * decides what its difficulty levels mean; everything downstream (dialog,
 * template, PDF) is shared.
 */
export type ExerciseGenerator = (options: ExerciseGeneratorOptions) => Exercise[];

/** Inclusive on both ends. */
export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Pick one element; the array must not be empty. */
export function randomItem<T>(items: readonly T[]): T {
  const item = items[randomInt(0, items.length - 1)];
  if (item === undefined) {
    throw new RangeError("randomItem called with an empty array");
  }
  return item;
}

/**
 * Run `make` until it yields `count` distinct exercises, giving up on the
 * distinctness after a bounded number of tries so a narrow difficulty (few
 * possible statements) still returns the requested count.
 */
export function collectDistinct(
  count: number,
  make: () => Exercise,
): Exercise[] {
  const exercises: Exercise[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 20;

  for (let attempt = 0; attempt < maxAttempts && exercises.length < count; attempt++) {
    const exercise = make();
    if (seen.has(exercise.prompt)) continue;
    seen.add(exercise.prompt);
    exercises.push(exercise);
  }

  while (exercises.length < count) {
    exercises.push(make());
  }

  return exercises;
}
