import { describe, expect, test } from "bun:test";

import { groupByCourse, groupByMonth, UNASSIGNED } from "@/features/teacher-exercises/lib/grouping";
import type { ExerciseSet, ExerciseUsage } from "@/lib/exercises/sets";

function usage(courseId: string, courseName: string): ExerciseUsage {
  return {
    id: crypto.randomUUID(),
    courseId,
    courseName,
    courseWorkId: "w",
    courseWorkTitle: "t",
    link: "",
    assignedAt: "2026-09-01T00:00:00.000Z",
    dueAt: null,
  };
}

function set(id: string, createdAt: string, usages: ExerciseUsage[] = []): ExerciseSet {
  return { id, title: id, language: "es", blocks: [], createdAt, updatedAt: createdAt, usages };
}

describe("groupByMonth", () => {
  test("groups by creation month, newest first", () => {
    const groups = groupByMonth([
      set("a", "2026-08-10T00:00:00.000Z"),
      set("b", "2026-09-02T00:00:00.000Z"),
      set("c", "2026-09-20T00:00:00.000Z"),
    ]);
    expect(groups.map((g) => [g.key, g.sets.map((s) => s.id)])).toEqual([
      ["2026-09", ["c", "b"]],
      ["2026-08", ["a"]],
    ]);
  });
});

describe("groupByCourse", () => {
  test("lists a set under every course it was used in, once each", () => {
    const groups = groupByCourse([
      set("a", "2026-09-01T00:00:00.000Z", [usage("c2", "Redes II"), usage("c1", "Redes I"), usage("c1", "Redes I")]),
      set("b", "2026-09-01T00:00:00.000Z"),
    ]);
    expect(groups.map((g) => [g.label, g.sets.map((s) => s.id)])).toEqual([
      ["Redes I", ["a"]],
      ["Redes II", ["a"]],
      [UNASSIGNED, ["b"]],
    ]);
  });

  test("omits the unassigned group when everything was used", () => {
    expect(groupByCourse([set("a", "2026-09-01T00:00:00.000Z", [usage("c1", "X")])])).toHaveLength(1);
  });
});
