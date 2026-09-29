import {
  isDifficulty,
  MAX_EXERCISE_COUNT,
  MIN_EXERCISE_COUNT,
  type Difficulty,
  type Exercise,
} from "@/lib/exercises/utils";

/**
 * A teacher-authored exercise set: several tool blocks frozen into one sheet.
 * Shared by the client (which generates it) and the server (which stores it),
 * so the validation below is the single definition of a legal set.
 */

/** A set may mix tools, but never grow past what a class can sit through. */
export const MAX_SET_EXERCISES = 100;
export const MAX_SET_TITLE_LENGTH = 200;

export type ExerciseBlock = {
  /** Key of the tool in the exercise-tool registry, e.g. `"ipv4"`. */
  toolId: string;
  difficulty: Difficulty;
  /** The statements and answers exactly as generated — never regenerated. */
  exercises: Exercise[];
};

export type ExerciseSetInput = {
  title: string;
  /** i18n language the statements were generated in. */
  language: string;
  blocks: ExerciseBlock[];
};

/** Where and when a set was handed out — written when an assignment is created. */
export type ExerciseUsage = {
  id: string;
  courseId: string;
  courseName: string;
  courseWorkId: string;
  courseWorkTitle: string;
  /** Classroom URL of the assignment; empty while it is still a draft. */
  link: string;
  assignedAt: string;
  /** ISO timestamp, or `null` for an assignment without a due date. */
  dueAt: string | null;
};

export type ExerciseSet = ExerciseSetInput & {
  id: string;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  usages: ExerciseUsage[];
};

export function countExercises(blocks: readonly { exercises: readonly unknown[] }[]): number {
  return blocks.reduce((total, block) => total + block.exercises.length, 0);
}

function isExercise(value: unknown): value is Exercise {
  if (typeof value !== "object" || value === null) return false;
  const { prompt, answer } = value as Record<string, unknown>;
  return typeof prompt === "string" && typeof answer === "string";
}

/**
 * Narrow untrusted JSON (a request body) into a set. Returns the reason it is
 * not one instead of throwing, so the API can answer 400 with it.
 */
export function parseExerciseSetInput(
  value: unknown,
): { ok: true; input: ExerciseSetInput } | { ok: false; reason: string } {
  if (typeof value !== "object" || value === null) {
    return { ok: false, reason: "body must be an object" };
  }
  const { title, language, blocks } = value as Record<string, unknown>;

  if (typeof title !== "string" || title.trim() === "") {
    return { ok: false, reason: "title is required" };
  }
  if (title.length > MAX_SET_TITLE_LENGTH) {
    return { ok: false, reason: "title is too long" };
  }
  if (typeof language !== "string" || language === "") {
    return { ok: false, reason: "language is required" };
  }
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { ok: false, reason: "at least one block is required" };
  }

  const parsed: ExerciseBlock[] = [];
  for (const block of blocks as unknown[]) {
    if (typeof block !== "object" || block === null) {
      return { ok: false, reason: "block must be an object" };
    }
    const { toolId, difficulty, exercises } = block as Record<string, unknown>;
    if (typeof toolId !== "string" || toolId === "") {
      return { ok: false, reason: "block.toolId is required" };
    }
    if (!isDifficulty(difficulty)) {
      return { ok: false, reason: "block.difficulty is invalid" };
    }
    if (
      !Array.isArray(exercises) ||
      exercises.length < MIN_EXERCISE_COUNT ||
      exercises.length > MAX_EXERCISE_COUNT ||
      !exercises.every(isExercise)
    ) {
      return { ok: false, reason: "block.exercises is invalid" };
    }
    parsed.push({
      toolId,
      difficulty,
      exercises: exercises.map(({ prompt, answer }) => ({ prompt, answer })),
    });
  }

  if (countExercises(parsed) > MAX_SET_EXERCISES) {
    return { ok: false, reason: `a set holds at most ${MAX_SET_EXERCISES} exercises` };
  }

  return { ok: true, input: { title: title.trim(), language, blocks: parsed } };
}
