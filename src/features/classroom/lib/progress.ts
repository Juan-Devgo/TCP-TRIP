import type { Submission } from "@/lib/classroom";

/** Turned in counts what the teacher has to review: handed in, or already returned. */
export function summarizeSubmissions(submissions: readonly Submission[]) {
  return {
    total: submissions.length,
    turnedIn: submissions.filter((s) => s.state === "TURNED_IN" || s.state === "RETURNED").length,
    late: submissions.filter((s) => s.late).length,
  };
}
