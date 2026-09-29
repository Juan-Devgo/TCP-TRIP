import {
  MAX_ATTACHMENTS,
  type AnnouncementInput,
  type AssignmentInput,
  type AssignmentPatch,
  type Attachment,
  type PublishMode,
  youtubeId,
} from "@/lib/classroom";
import { isRichTextEmpty, richTextToPlain } from "@/lib/richText";

/**
 * Pure translation between TCP-TRIP's shapes and the Classroom REST bodies,
 * plus the validation of what the client sends. No I/O — unit-tested.
 */

export const MAX_TITLE_LENGTH = 3000;
export const MAX_TEXT_LENGTH = 30000;

type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

export type GoogleDate = { year: number; month: number; day: number };
export type GoogleTime = { hours: number; minutes: number };

/** Classroom stores due dates as a UTC date + UTC time pair. */
export function toGoogleDue(iso: string): { dueDate: GoogleDate; dueTime: GoogleTime } {
  const date = new Date(iso);
  return {
    dueDate: {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    },
    dueTime: { hours: date.getUTCHours(), minutes: date.getUTCMinutes() },
  };
}

export function fromGoogleDue(
  dueDate: Partial<GoogleDate> | undefined,
  dueTime: Partial<GoogleTime> | undefined,
): string | null {
  if (!dueDate?.year || !dueDate.month || !dueDate.day) return null;
  return new Date(
    Date.UTC(
      dueDate.year,
      dueDate.month - 1,
      dueDate.day,
      dueTime?.hours ?? 23,
      dueTime?.minutes ?? 59,
    ),
  ).toISOString();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseAttachment(value: unknown): Parsed<Attachment> {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "attachment must be an object" };
  const item = value as Record<string, unknown>;

  switch (item.kind) {
    case "link": {
      if (typeof item.url !== "string" || !isHttpUrl(item.url)) {
        return { ok: false, reason: "link attachment needs an http(s) url" };
      }
      return {
        ok: true,
        value: {
          kind: "link",
          url: item.url,
          ...(typeof item.title === "string" && item.title ? { title: item.title } : {}),
        },
      };
    }
    case "youtube": {
      if (typeof item.url !== "string" || youtubeId(item.url) === null) {
        return { ok: false, reason: "youtube attachment needs a YouTube video url" };
      }
      return { ok: true, value: { kind: "youtube", url: item.url } };
    }
    case "file": {
      if (typeof item.clientId !== "string" || typeof item.name !== "string") {
        return { ok: false, reason: "file attachment needs clientId and name" };
      }
      return { ok: true, value: { kind: "file", clientId: item.clientId, name: item.name } };
    }
    case "exercise": {
      if (
        typeof item.clientId !== "string" ||
        typeof item.exerciseSetId !== "string" ||
        typeof item.name !== "string"
      ) {
        return { ok: false, reason: "exercise attachment needs clientId, exerciseSetId and name" };
      }
      return {
        ok: true,
        value: {
          kind: "exercise",
          clientId: item.clientId,
          exerciseSetId: item.exerciseSetId,
          includeAnswers: item.includeAnswers === true,
          name: item.name,
        },
      };
    }
    case "presentation": {
      if (typeof item.slug !== "string" || !/^[a-z0-9-]{1,200}$/.test(item.slug)) {
        return { ok: false, reason: "presentation attachment needs a published slug" };
      }
      return {
        ok: true,
        value: {
          kind: "presentation",
          slug: item.slug,
          title: typeof item.title === "string" ? item.title : "",
        },
      };
    }
    default:
      return { ok: false, reason: "unknown attachment kind" };
  }
}

function parseAttachments(value: unknown): Parsed<Attachment[]> {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value)) return { ok: false, reason: "attachments must be an array" };
  if (value.length > MAX_ATTACHMENTS) {
    return { ok: false, reason: `at most ${MAX_ATTACHMENTS} attachments` };
  }
  const attachments: Attachment[] = [];
  for (const item of value as unknown[]) {
    const parsed = parseAttachment(item);
    if (!parsed.ok) return parsed;
    attachments.push(parsed.value);
  }
  return { ok: true, value: attachments };
}

const MODES: readonly PublishMode[] = ["publish", "schedule", "draft"];

/** Shared rules for the fields an assignment has both at creation and on edit. */
function parseEditable(
  body: Record<string, unknown>,
  now: Date,
): Parsed<AssignmentPatch> {
  const { title, instructionsHtml, maxPoints, dueAt, mode, scheduledAt } = body;

  if (typeof title !== "string" || title.trim() === "") return { ok: false, reason: "title is required" };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, reason: "title is too long" };

  const html = typeof instructionsHtml === "string" ? instructionsHtml : "";
  if (richTextToPlain(html).length > MAX_TEXT_LENGTH) {
    return { ok: false, reason: "instructions are too long" };
  }

  if (maxPoints !== null && maxPoints !== undefined) {
    if (typeof maxPoints !== "number" || !Number.isFinite(maxPoints) || maxPoints < 0) {
      return { ok: false, reason: "maxPoints must be a non-negative number" };
    }
  }

  if (dueAt !== null && dueAt !== undefined) {
    if (!isIsoDate(dueAt)) return { ok: false, reason: "dueAt must be an ISO date" };
    if (Date.parse(dueAt) <= now.getTime()) return { ok: false, reason: "dueAt is in the past" };
  }

  if (!MODES.includes(mode as PublishMode)) return { ok: false, reason: "mode is invalid" };

  let scheduled: string | null = null;
  if (mode === "schedule") {
    if (!isIsoDate(scheduledAt)) return { ok: false, reason: "scheduledAt is required to schedule" };
    if (Date.parse(scheduledAt) <= now.getTime()) {
      return { ok: false, reason: "scheduledAt is in the past" };
    }
    if (isIsoDate(dueAt) && Date.parse(dueAt) <= Date.parse(scheduledAt)) {
      return { ok: false, reason: "dueAt must come after scheduledAt" };
    }
    scheduled = scheduledAt;
  }

  return {
    ok: true,
    value: {
      title: title.trim(),
      instructionsHtml: isRichTextEmpty(html) ? "" : html,
      maxPoints: typeof maxPoints === "number" && maxPoints > 0 ? maxPoints : null,
      dueAt: typeof dueAt === "string" ? new Date(dueAt).toISOString() : null,
      mode: mode as PublishMode,
      scheduledAt: scheduled ? new Date(scheduled).toISOString() : null,
    },
  };
}

export function parseAssignmentInput(value: unknown, now = new Date()): Parsed<AssignmentInput> {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "body must be an object" };
  const body = value as Record<string, unknown>;

  if (typeof body.requestId !== "string" || body.requestId === "") {
    return { ok: false, reason: "requestId is required" };
  }
  if (typeof body.courseId !== "string" || body.courseId === "") {
    return { ok: false, reason: "courseId is required" };
  }
  const studentIds = body.studentIds ?? [];
  if (!isStringArray(studentIds)) return { ok: false, reason: "studentIds must be strings" };

  const editable = parseEditable(body, now);
  if (!editable.ok) return editable;
  const attachments = parseAttachments(body.attachments);
  if (!attachments.ok) return attachments;

  return {
    ok: true,
    value: {
      requestId: body.requestId,
      courseId: body.courseId,
      studentIds: [...new Set(studentIds)],
      attachments: attachments.value,
      ...editable.value,
    },
  };
}

export function parseAssignmentPatch(value: unknown, now = new Date()): Parsed<AssignmentPatch> {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "body must be an object" };
  return parseEditable(value as Record<string, unknown>, now);
}

export function parseAnnouncementInput(value: unknown, now = new Date()): Parsed<AnnouncementInput> {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "body must be an object" };
  const body = value as Record<string, unknown>;

  if (typeof body.requestId !== "string" || body.requestId === "") {
    return { ok: false, reason: "requestId is required" };
  }
  if (typeof body.text !== "string" || body.text.trim() === "") {
    return { ok: false, reason: "text is required" };
  }
  if (body.text.length > MAX_TEXT_LENGTH) return { ok: false, reason: "text is too long" };

  const studentIds = body.studentIds ?? [];
  if (!isStringArray(studentIds)) return { ok: false, reason: "studentIds must be strings" };

  let scheduledAt: string | null = null;
  if (body.scheduledAt !== null && body.scheduledAt !== undefined) {
    if (!isIsoDate(body.scheduledAt)) return { ok: false, reason: "scheduledAt must be an ISO date" };
    if (Date.parse(body.scheduledAt) <= now.getTime()) {
      return { ok: false, reason: "scheduledAt is in the past" };
    }
    scheduledAt = new Date(body.scheduledAt).toISOString();
  }

  const attachments = parseAttachments(body.attachments);
  if (!attachments.ok) return attachments;

  return {
    ok: true,
    value: {
      requestId: body.requestId,
      text: body.text.trim(),
      studentIds: [...new Set(studentIds)],
      scheduledAt,
      attachments: attachments.value,
    },
  };
}

/** A Classroom `Material`, once every file has been uploaded to Drive. */
export type GoogleMaterial =
  | { link: { url: string; title?: string } }
  | { youtubeVideo: { id: string } }
  | { driveFile: { driveFile: { id: string }; shareMode: "VIEW" } };

/** A published presentation as the server resolved it: its public reader URL. */
export type PresentationLink = { url: string; title: string };

/**
 * Link and YouTube attachments map directly; file and exercise ones need the
 * Drive id their upload produced, looked up by `clientId`; presentation ones
 * need the reader link the server resolved, looked up by slug.
 */
export function toMaterials(
  attachments: readonly Attachment[],
  driveIds: ReadonlyMap<string, string>,
  presentations: ReadonlyMap<string, PresentationLink> = new Map(),
): GoogleMaterial[] {
  return attachments.map((attachment): GoogleMaterial => {
    switch (attachment.kind) {
      case "link":
        return {
          link: {
            url: attachment.url,
            ...(attachment.title ? { title: attachment.title } : {}),
          },
        };
      case "youtube":
        return { youtubeVideo: { id: youtubeId(attachment.url) as string } };
      case "file":
      case "exercise": {
        const id = driveIds.get(attachment.clientId);
        if (!id) throw new Error(`Missing upload for attachment ${attachment.clientId}`);
        return { driveFile: { driveFile: { id }, shareMode: "VIEW" } };
      }
      case "presentation": {
        const link = presentations.get(attachment.slug);
        if (!link) throw new Error(`Unresolved presentation ${attachment.slug}`);
        return { link: { url: link.url, title: link.title } };
      }
    }
  });
}

/** Classroom schedules only drafts: a scheduled item is a DRAFT with a `scheduledTime`. */
function stateFor(mode: PublishMode): "PUBLISHED" | "DRAFT" {
  return mode === "publish" ? "PUBLISHED" : "DRAFT";
}

function assignees(studentIds: readonly string[]) {
  return studentIds.length > 0
    ? {
        assigneeMode: "INDIVIDUAL_STUDENTS",
        individualStudentsOptions: { studentIds: [...studentIds] },
      }
    : { assigneeMode: "ALL_STUDENTS" };
}

export function courseWorkBody(input: AssignmentInput, materials: GoogleMaterial[]) {
  const description = richTextToPlain(input.instructionsHtml);
  return {
    title: input.title,
    ...(description ? { description } : {}),
    workType: "ASSIGNMENT",
    state: stateFor(input.mode),
    ...(input.mode === "schedule" && input.scheduledAt ? { scheduledTime: input.scheduledAt } : {}),
    ...(input.maxPoints ? { maxPoints: input.maxPoints } : {}),
    ...(input.dueAt ? toGoogleDue(input.dueAt) : {}),
    ...assignees(input.studentIds),
    ...(materials.length > 0 ? { materials } : {}),
  };
}

/**
 * A `courses.courseWork.patch` body and its `updateMask`. Fields listed in the
 * mask but absent from the body are cleared — that is how a due date or the
 * points are removed.
 */
export function courseWorkPatch(patch: AssignmentPatch, currentState: string) {
  const description = richTextToPlain(patch.instructionsHtml);
  const body: Record<string, unknown> = { title: patch.title, description };
  const mask = ["title", "description", "maxPoints", "dueDate", "dueTime"];

  if (patch.maxPoints) body.maxPoints = patch.maxPoints;
  if (patch.dueAt) Object.assign(body, toGoogleDue(patch.dueAt));

  // A published item cannot go back to draft; only drafts change state or schedule.
  if (currentState === "DRAFT") {
    body.state = stateFor(patch.mode);
    mask.push("state", "scheduledTime");
    if (patch.mode === "schedule" && patch.scheduledAt) body.scheduledTime = patch.scheduledAt;
  }

  return { body, updateMask: mask.join(",") };
}

export function announcementBody(input: AnnouncementInput, materials: GoogleMaterial[]) {
  return {
    text: input.text,
    state: input.scheduledAt ? "DRAFT" : "PUBLISHED",
    ...(input.scheduledAt ? { scheduledTime: input.scheduledAt } : {}),
    ...assignees(input.studentIds),
    ...(materials.length > 0 ? { materials } : {}),
  };
}
