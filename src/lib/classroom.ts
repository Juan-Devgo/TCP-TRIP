/**
 * The contract between the Classroom API module (`src/api/classroom.ts`) and
 * the teacher panel. Pure types and constants — imported on both sides.
 */

const GOOGLE = "https://www.googleapis.com/auth";

/** Every Google scope TCP-TRIP asks for, each one narrowed to what a feature needs. */
export const CLASSROOM_SCOPES = {
  courses: `${GOOGLE}/classroom.courses.readonly`,
  rosters: `${GOOGLE}/classroom.rosters.readonly`,
  emails: `${GOOGLE}/classroom.profile.emails`,
  photos: `${GOOGLE}/classroom.profile.photos`,
  coursework: `${GOOGLE}/classroom.coursework.students`,
  announcements: `${GOOGLE}/classroom.announcements`,
  drive: `${GOOGLE}/drive.file`,
} as const;

export const ALL_CLASSROOM_SCOPES: string[] = Object.values(CLASSROOM_SCOPES);

/**
 * What each teacher-facing capability needs. When consent comes back partial,
 * this is how the UI names the features that stay disabled.
 */
export const CLASSROOM_FEATURES = {
  courses: [CLASSROOM_SCOPES.courses, CLASSROOM_SCOPES.rosters],
  students: [CLASSROOM_SCOPES.rosters, CLASSROOM_SCOPES.emails, CLASSROOM_SCOPES.photos],
  assign: [
    CLASSROOM_SCOPES.courses,
    CLASSROOM_SCOPES.rosters,
    CLASSROOM_SCOPES.coursework,
    CLASSROOM_SCOPES.drive,
  ],
  announcements: [CLASSROOM_SCOPES.announcements, CLASSROOM_SCOPES.drive],
  progress: [CLASSROOM_SCOPES.coursework, CLASSROOM_SCOPES.rosters],
} as const;

export type ClassroomFeature = keyof typeof CLASSROOM_FEATURES;

export function disabledFeatures(granted: readonly string[]): ClassroomFeature[] {
  const have = new Set(granted);
  return (Object.keys(CLASSROOM_FEATURES) as ClassroomFeature[]).filter((feature) =>
    CLASSROOM_FEATURES[feature].some((scope) => !have.has(scope)),
  );
}

/** Error codes the API attaches to `error.details.code` for Google failures. */
export type ClassroomErrorCode =
  /** No Google account linked to the Clerk user. */
  | "google_not_connected"
  /** Linked, but the token is expired/revoked — the user must reconnect. */
  | "google_reauth"
  /** Linked, but consent was partial. */
  | "google_scopes"
  /** Google answered but refused the operation. */
  | "google_error";

export type ClassroomStatus = {
  connected: boolean;
  /** `true` when an account is linked but its token no longer works. */
  needsReconnect: boolean;
  email: string | null;
  grantedScopes: string[];
  missingScopes: string[];
};

export type Course = {
  id: string;
  name: string;
  section: string | null;
  state: string;
  link: string;
  studentCount: number | null;
};

export type Student = {
  userId: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
};

export type Attachment =
  | { kind: "link"; url: string; title?: string }
  | { kind: "youtube"; url: string }
  /** A local file; the request carries its bytes under `file:<clientId>`. */
  | { kind: "file"; clientId: string; name: string }
  /** A saved exercise set; the client renders the PDF and sends it as a file. */
  | { kind: "exercise"; clientId: string; exerciseSetId: string; includeAnswers: boolean; name: string }
  /**
   * A published theory presentation, attached as a link to its TCP-TRIP reader
   * (`/theory/presentations/<slug>`). Only the approved snapshot can be linked:
   * students read exactly what an administrator reviewed, with their reading
   * progress. The server resolves the slug and builds the URL and title itself.
   */
  | { kind: "presentation"; slug: string; title: string };

export const MAX_ATTACHMENTS = 20;

/** The video id of any common YouTube URL shape, or `null`. */
export function youtubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = parsed.pathname.slice(1).split("/")[0] ?? null;
  } else if (host === "youtube.com" || host === "music.youtube.com") {
    id =
      parsed.searchParams.get("v") ??
      /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(parsed.pathname)?.[1] ??
      null;
  }
  return id && /^[\w-]{6,}$/.test(id) ? id : null;
}


export type PublishMode = "publish" | "schedule" | "draft";

export type AssignmentInput = {
  /** Minted by the client per draft, so a retry never duplicates the task. */
  requestId: string;
  courseId: string;
  title: string;
  /** Sanitized HTML kept in TCP-TRIP; Classroom receives its plain-text form. */
  instructionsHtml: string;
  /** Empty = every student in the course. */
  studentIds: string[];
  /** `null` or 0 = ungraded. */
  maxPoints: number | null;
  /** ISO timestamp, or `null` for no due date. */
  dueAt: string | null;
  mode: PublishMode;
  /** ISO timestamp, required when `mode` is `schedule`. */
  scheduledAt: string | null;
  attachments: Attachment[];
};

/** The editable part of an assignment already in Classroom (materials are fixed by the API). */
export type AssignmentPatch = Pick<
  AssignmentInput,
  "title" | "instructionsHtml" | "maxPoints" | "dueAt" | "mode" | "scheduledAt"
>;

export type StoredAssignment = {
  id: string;
  courseId: string;
  courseWorkId: string;
  title: string;
  instructionsHtml: string;
  maxPoints: number | null;
  dueAt: string | null;
  state: string;
  scheduledAt: string | null;
  link: string;
  studentIds: string[];
  exerciseSetIds: string[];
  /** Slugs of the published presentations linked from it. */
  presentationSlugs: string[];
  createdAt: string;
  updatedAt: string;
};

export type CourseWorkSummary = {
  id: string;
  title: string;
  state: string;
  link: string;
  dueAt: string | null;
  maxPoints: number | null;
  /** `true` when TCP-TRIP created it — only those can be edited from here. */
  ownedByApp: boolean;
  /** The TCP-TRIP assignment behind it, when there is one. */
  assignmentId: string | null;
};

export type SubmissionState =
  | "NEW"
  | "CREATED"
  | "TURNED_IN"
  | "RETURNED"
  | "RECLAIMED_BY_STUDENT";

export type Submission = {
  userId: string;
  studentName: string;
  state: SubmissionState;
  late: boolean;
  grade: number | null;
};

export type AnnouncementInput = {
  requestId: string;
  text: string;
  studentIds: string[];
  scheduledAt: string | null;
  attachments: Attachment[];
};

export type Announcement = {
  id: string;
  text: string;
  state: string;
  link: string;
  createdAt: string;
  scheduledAt: string | null;
  materials: { title: string; url: string }[];
};
