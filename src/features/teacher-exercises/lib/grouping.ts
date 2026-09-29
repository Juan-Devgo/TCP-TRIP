import type { ExerciseSet } from "@/lib/exercises/sets";

/**
 * How `Mis ejercicios` classifies sets. Pure, so the rules (a set used in two
 * courses shows in both; an unused one goes to its own group) are tested.
 */

export type SetGroup = {
  /** Stable key: `YYYY-MM`, a course id, or `unassigned`. */
  key: string;
  /** Raw label material; the component formats/translates it. */
  label: string;
  sets: ExerciseSet[];
};

export const UNASSIGNED = "unassigned";

/** By creation month, newest first. `label` is the `YYYY-MM` key. */
export function groupByMonth(sets: readonly ExerciseSet[]): SetGroup[] {
  const groups = new Map<string, ExerciseSet[]>();
  for (const set of [...sets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = set.createdAt.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), set]);
  }
  return [...groups].map(([key, items]) => ({ key, label: key, sets: items }));
}

/**
 * By the courses a set was assigned to, alphabetically, with never-assigned
 * sets last under `unassigned`. A set used in several courses appears in each.
 */
export function groupByCourse(sets: readonly ExerciseSet[]): SetGroup[] {
  const groups = new Map<string, SetGroup>();
  const unassigned: ExerciseSet[] = [];

  for (const set of sets) {
    if (set.usages.length === 0) {
      unassigned.push(set);
      continue;
    }
    const seen = new Set<string>();
    for (const usage of set.usages) {
      if (seen.has(usage.courseId)) continue;
      seen.add(usage.courseId);
      const group = groups.get(usage.courseId) ?? {
        key: usage.courseId,
        label: usage.courseName,
        sets: [],
      };
      group.sets.push(set);
      groups.set(usage.courseId, group);
    }
  }

  const courses = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  return unassigned.length > 0
    ? [...courses, { key: UNASSIGNED, label: UNASSIGNED, sets: unassigned }]
    : courses;
}
