import { beforeEach, describe, expect, test } from "bun:test";

import { openDatabase } from "@/db/client";
import { ExerciseSetsRepository, SET_IN_USE } from "@/db/domains/exercise-sets";
import type { ExerciseSetInput } from "@/lib/exercises/sets";

const INPUT: ExerciseSetInput = {
  title: "Taller 1",
  language: "es",
  blocks: [
    {
      toolId: "number-bases",
      difficulty: "easy",
      exercises: [{ prompt: "Convierte 10 (DEC) a BIN.", answer: "1010" }],
    },
  ],
};

const USAGE = {
  courseId: "c1",
  courseName: "Redes I",
  courseWorkId: "w1",
  courseWorkTitle: "Taller",
  link: "https://classroom.google.com/w1",
  assignedAt: "2026-09-01T00:00:00.000Z",
  dueAt: null,
};

let repo: ExerciseSetsRepository;

beforeEach(() => {
  let tick = 0;
  repo = new ExerciseSetsRepository(
    openDatabase(":memory:"),
    () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString(),
  );
});

describe("exercise sets", () => {
  test("create, read back and list newest first", () => {
    const first = repo.create("u1", INPUT);
    const second = repo.create("u1", { ...INPUT, title: "Taller 2" });

    expect(repo.findForUser("u1", first.id)?.blocks).toEqual(INPUT.blocks);
    expect(repo.listForUser("u1").map((set) => set.id)).toEqual([second.id, first.id]);
  });

  test("scopes every read to its owner", () => {
    const set = repo.create("u1", INPUT);
    expect(repo.findForUser("u2", set.id)).toBeNull();
    expect(repo.listForUser("u2")).toEqual([]);
    expect(repo.remove("u2", set.id)).toBe(false);
  });

  test("updates a set that was never used", () => {
    const set = repo.create("u1", INPUT);
    const updated = repo.update("u1", set.id, { ...INPUT, title: "Nuevo" });
    expect(updated !== SET_IN_USE ? updated?.title : null).toBe("Nuevo");
  });

  test("freezes a set once it has a usage", () => {
    const set = repo.create("u1", INPUT);
    repo.recordUsage("u1", set.id, USAGE);

    expect(repo.update("u1", set.id, INPUT)).toBe(SET_IN_USE);
    expect(repo.findForUser("u1", set.id)?.usages).toHaveLength(1);
    expect(repo.listForUser("u1")[0]?.usages).toHaveLength(1);
  });

  test("ignores a usage for somebody else's set", () => {
    const set = repo.create("u1", INPUT);
    repo.recordUsage("u2", set.id, USAGE);
    expect(repo.findForUser("u1", set.id)?.usages).toEqual([]);
  });

  test("keeps usages in step with the assignment", () => {
    const set = repo.create("u1", INPUT);
    repo.recordUsage("u1", set.id, USAGE);
    repo.syncUsages("u1", "w1", {
      courseWorkTitle: "Quiz",
      link: "x",
      dueAt: "2026-10-01T00:00:00.000Z",
    });

    expect(repo.findForUser("u1", set.id)?.usages[0]).toMatchObject({
      courseWorkTitle: "Quiz",
      dueAt: "2026-10-01T00:00:00.000Z",
    });
  });

  test("deleting a set removes its usages", () => {
    const set = repo.create("u1", INPUT);
    repo.recordUsage("u1", set.id, USAGE);
    expect(repo.remove("u1", set.id)).toBe(true);
    expect(repo.findForUser("u1", set.id)).toBeNull();
  });
});
