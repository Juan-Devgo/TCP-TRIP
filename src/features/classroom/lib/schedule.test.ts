import { describe, expect, test } from "bun:test";

import {
  fromDateTimeLocal,
  toDateTimeLocal,
  validateSchedule,
} from "@/features/classroom/lib/schedule";

const now = new Date("2026-09-01T12:00:00");

describe("validateSchedule", () => {
  test("no dates is fine when nothing is scheduled", () => {
    expect(validateSchedule({ due: "", scheduled: "", requireScheduled: false, now })).toEqual({
      due: null,
      scheduled: null,
    });
  });

  test("rejects a due date in the past", () => {
    expect(validateSchedule({ due: "2026-08-31T10:00", scheduled: "", requireScheduled: false, now }).due).toBe(
      "duePast",
    );
  });

  test("scheduling needs a future publication date before the due date", () => {
    const check = (scheduled: string, due = "") =>
      validateSchedule({ due, scheduled, requireScheduled: true, now }).scheduled;
    expect(check("")).toBe("scheduledRequired");
    expect(check("2026-09-01T11:00")).toBe("scheduledPast");
    expect(check("2026-09-05T10:00", "2026-09-04T10:00")).toBe("dueBeforeScheduled");
    expect(check("2026-09-03T10:00", "2026-09-04T10:00")).toBeNull();
  });
});

test("datetime-local round-trips", () => {
  expect(toDateTimeLocal(fromDateTimeLocal("2026-09-10T08:05"))).toBe("2026-09-10T08:05");
});
