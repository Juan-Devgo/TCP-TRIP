import { expect, test } from "bun:test";

import { summarizeSubmissions } from "@/features/classroom/lib/progress";
import type { Submission } from "@/lib/classroom";

const base = { userId: "u", studentName: "n", late: false, grade: null };

test("counts turned-in and returned work, and late submissions", () => {
  const submissions: Submission[] = [
    { ...base, state: "TURNED_IN" },
    { ...base, state: "RETURNED", late: true },
    { ...base, state: "CREATED", late: true },
    { ...base, state: "RECLAIMED_BY_STUDENT" },
    { ...base, state: "NEW" },
  ];
  expect(summarizeSubmissions(submissions)).toEqual({ total: 5, turnedIn: 2, late: 2 });
});
