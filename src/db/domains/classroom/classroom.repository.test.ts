import { beforeEach, describe, expect, test } from "bun:test";

import { openDatabase } from "@/db/client";
import { ClassroomRepository, type NewAssignment } from "@/db/domains/classroom";

let repo: ClassroomRepository;

beforeEach(() => {
  let tick = 0;
  repo = new ClassroomRepository(
    openDatabase(":memory:"),
    () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString(),
  );
});

describe("assignments", () => {
  const assignment: NewAssignment = {
    requestId: "r1",
    courseId: "c1",
    courseWorkId: "w1",
    title: "Taller",
    instructionsHtml: "<b>hola</b>",
    maxPoints: 5,
    dueAt: null,
    state: "PUBLISHED",
    scheduledAt: null,
    link: "",
    studentIds: ["s1"],
    exerciseSetIds: ["e1"],
    presentationSlugs: ["modelo-tcp-ip-abc123"],
  };

  test("finds an assignment by its request id, so a retry does not duplicate it", () => {
    const created = repo.createAssignment("u1", assignment);
    expect(repo.findAssignmentByRequest("u1", "r1")?.id).toBe(created.id);
    expect(repo.findAssignmentByRequest("u2", "r1")).toBeNull();
    expect(() => repo.createAssignment("u1", assignment)).toThrow();
  });

  test("round-trips the attached presentations", () => {
    const created = repo.createAssignment("u1", assignment);
    expect(created.presentationSlugs).toEqual(["modelo-tcp-ip-abc123"]);
  });

  test("lists a course's assignments for their owner only", () => {
    repo.createAssignment("u1", assignment);
    expect(repo.listAssignments("u1", "c1")).toHaveLength(1);
    expect(repo.listAssignments("u2", "c1")).toEqual([]);
  });

  test("updates the editable fields", () => {
    const created = repo.createAssignment("u1", assignment);
    const updated = repo.updateAssignment("u1", created.id, {
      ...created,
      title: "Quiz",
      maxPoints: null,
    });
    expect(updated).toMatchObject({ title: "Quiz", maxPoints: null, studentIds: ["s1"] });
    expect(repo.updateAssignment("u2", created.id, created)).toBeNull();
  });
});

test("records announcement requests once", () => {
  repo.recordAnnouncement("u1", "r1", "a1");
  repo.recordAnnouncement("u1", "r1", "a2");
  expect(repo.findAnnouncementByRequest("u1", "r1")).toBe("a1");
  expect(repo.findAnnouncementByRequest("u2", "r1")).toBeNull();
});

test("remembers a deliberate disconnect until cleared", () => {
  expect(repo.isDisconnected("u1")).toBe(false);
  repo.markDisconnected("u1");
  repo.markDisconnected("u1");
  expect(repo.isDisconnected("u1")).toBe(true);
  expect(repo.isDisconnected("u2")).toBe(false);
  repo.clearDisconnected("u1");
  expect(repo.isDisconnected("u1")).toBe(false);
});
