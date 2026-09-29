/**
 * Dates on the assign form. Inputs are `datetime-local` strings in the
 * teacher's own timezone; the API speaks ISO/UTC.
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** ISO → `YYYY-MM-DDTHH:mm` in local time, as `<input type="datetime-local">` wants. */
export function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `YYYY-MM-DDTHH:mm` (local) → ISO. */
export function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export type ScheduleProblems = {
  due: "duePast" | null;
  scheduled: "scheduledRequired" | "scheduledPast" | "dueBeforeScheduled" | null;
};

/** Mirrors the server rules so the form says what is wrong before sending. */
export function validateSchedule({
  due,
  scheduled,
  requireScheduled,
  now,
}: {
  due: string;
  scheduled: string;
  requireScheduled: boolean;
  now: Date;
}): ScheduleProblems {
  const dueTime = due ? new Date(due).getTime() : null;
  const scheduledTime = scheduled ? new Date(scheduled).getTime() : null;

  let scheduledProblem: ScheduleProblems["scheduled"] = null;
  if (requireScheduled && scheduledTime === null) scheduledProblem = "scheduledRequired";
  else if (scheduledTime !== null && scheduledTime <= now.getTime()) scheduledProblem = "scheduledPast";
  else if (scheduledTime !== null && dueTime !== null && dueTime <= scheduledTime) {
    scheduledProblem = "dueBeforeScheduled";
  }

  return {
    due: dueTime !== null && dueTime <= now.getTime() ? "duePast" : null,
    scheduled: scheduledProblem,
  };
}
