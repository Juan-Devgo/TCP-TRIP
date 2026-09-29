import type { BunRequest } from "bun";

import type { Caller } from "@/api/auth";
import {
  announcementBody,
  courseWorkBody,
  courseWorkPatch,
  fromGoogleDue,
  parseAnnouncementInput,
  parseAssignmentInput,
  parseAssignmentPatch,
  toMaterials,
  type PresentationLink,
  type GoogleDate,
  type GoogleTime,
} from "@/api/classroomMapping";
import {
  GoogleError,
  googleErrorResponse,
  googleFetch,
  googleListAll,
  googleToken,
  revokeToken,
  tokenInfo,
  uploadToDrive,
} from "@/api/google";
import { authorOnly, isRefusal } from "@/api/guards";
import { fail, ok } from "@/api/http";
import { ClassroomRepository } from "@/db/domains/classroom";
import { ExerciseSetsRepository } from "@/db/domains/exercise-sets";
import { PresentationsRepository } from "@/db/domains/presentations";
import {
  ALL_CLASSROOM_SCOPES,
  type Announcement,
  type Attachment,
  type ClassroomStatus,
  type Course,
  type CourseWorkSummary,
  type Student,
  type Submission,
  type SubmissionState,
} from "@/lib/classroom";
import { publishedPresentationPath } from "@/lib/presentations/contract";

/**
 * Google Classroom, proxied for the teacher panel. Every handler resolves the
 * caller server-side, reads their Google token from Clerk and talks to Google
 * itself — the browser never sees a Google token.
 *
 * TCP-TRIP can only modify Classroom items it created (API project lock), so
 * edits go through `classroom_assignments`, which only holds our own.
 */

// Cheap: the connection is the process-wide singleton.
const classroom = () => new ClassroomRepository();
const exerciseSets = () => new ExerciseSetsRepository();
const presentations = () => new PresentationsRepository();

const CLASSROOM = "https://classroom.googleapis.com/v1";

/** Per-file cap for uploads to Drive; Classroom attachments are meant to be handouts. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type GoogleCourse = {
  id: string;
  name: string;
  section?: string;
  courseState: string;
  alternateLink?: string;
};

type GoogleStudent = {
  userId: string;
  profile?: {
    name?: { fullName?: string };
    emailAddress?: string;
    photoUrl?: string;
  };
};

type GoogleMaterialOut = {
  link?: { url?: string; title?: string };
  driveFile?: { driveFile?: { alternateLink?: string; title?: string } };
  youtubeVideo?: { alternateLink?: string; title?: string };
  form?: { formUrl?: string; title?: string };
};

type GoogleCourseWork = {
  id: string;
  title: string;
  state: string;
  alternateLink?: string;
  dueDate?: Partial<GoogleDate>;
  dueTime?: Partial<GoogleTime>;
  maxPoints?: number;
  associatedWithDeveloper?: boolean;
};

type GoogleSubmission = {
  userId: string;
  state: SubmissionState;
  late?: boolean;
  assignedGrade?: number;
  draftGrade?: number;
};

type GoogleAnnouncement = {
  id: string;
  text?: string;
  state: string;
  alternateLink?: string;
  creationTime: string;
  scheduledTime?: string;
  materials?: GoogleMaterialOut[];
};

/**
 * Wraps a teacher route: resolves the caller and their Google token, and turns
 * a `GoogleError` into the `{ error: { details: { code } } }` the UI reads.
 */
function classroomHandler<T extends Request>(
  fn: (req: T, caller: Caller, token: string) => Promise<Response>,
) {
  return async (req: T): Promise<Response> => {
    const caller = await authorOnly(req);
    if (isRefusal(caller)) return caller;
    try {
      return await fn(req, caller, await googleToken(caller.userId));
    } catch (error) {
      const response = googleErrorResponse(error);
      if (response) return response;
      throw error;
    }
  };
}

/**
 * Where students open TCP-TRIP. `APP_ORIGIN` names the public origin when the
 * server sits behind a proxy (the request would carry the internal one);
 * otherwise the request's own origin is the public one.
 */
function appOrigin(req: Request): string {
  return (process.env.APP_ORIGIN ?? new URL(req.url).origin).replace(/\/+$/, "");
}

/**
 * The reader link of every presentation attachment, resolved against the
 * published snapshots — never the client's word for URL or title. A slug with
 * no publication (withdrawn, or never approved) refuses the whole request.
 */
function resolvePresentations(
  req: Request,
  attachments: readonly Attachment[],
): Map<string, PresentationLink> | Response {
  const links = new Map<string, PresentationLink>();
  const repository = presentations();
  for (const attachment of attachments) {
    if (attachment.kind !== "presentation" || links.has(attachment.slug)) continue;
    const published = repository.findPublishedBySlug(attachment.slug);
    if (!published) {
      return fail(404, "Presentation not published", {
        code: "presentation_unpublished",
        name: attachment.title,
      });
    }
    links.set(attachment.slug, {
      url: `${appOrigin(req)}${publishedPresentationPath(published.slug)}`,
      title: published.title,
    });
  }
  return links;
}

function toStudent(student: GoogleStudent): Student {
  return {
    userId: student.userId,
    name: student.profile?.name?.fullName ?? student.userId,
    email: student.profile?.emailAddress ?? null,
    photoUrl: student.profile?.photoUrl
      ? // Classroom hands out protocol-relative photo URLs.
        student.profile.photoUrl.replace(/^\/\//, "https://")
      : null,
  };
}

function materialLink(material: GoogleMaterialOut): { title: string; url: string } | null {
  const item =
    (material.link && { title: material.link.title, url: material.link.url }) ??
    (material.driveFile?.driveFile && {
      title: material.driveFile.driveFile.title,
      url: material.driveFile.driveFile.alternateLink,
    }) ??
    (material.youtubeVideo && {
      title: material.youtubeVideo.title,
      url: material.youtubeVideo.alternateLink,
    }) ??
    (material.form && { title: material.form.title, url: material.form.formUrl });
  if (!item?.url) return null;
  return { title: item.title ?? item.url, url: item.url };
}

async function listStudents(token: string, courseId: string): Promise<Student[]> {
  const students = await googleListAll<GoogleStudent>(
    token,
    `${CLASSROOM}/courses/${encodeURIComponent(courseId)}/students?pageSize=100`,
    "students",
  );
  return students
    .map(toStudent)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

async function getCourse(token: string, courseId: string): Promise<GoogleCourse> {
  return googleFetch<GoogleCourse>(token, `${CLASSROOM}/courses/${encodeURIComponent(courseId)}`);
}

/**
 * Reads the multipart body of a create request: a `payload` JSON field plus
 * one `file:<clientId>` part per uploaded file or rendered exercise PDF.
 */
async function readMultipart(req: Request): Promise<{ payload: unknown; form: FormData } | Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "Expected multipart/form-data");
  }
  const raw = form.get("payload");
  if (typeof raw !== "string") return fail(400, "Missing payload");
  try {
    return { payload: JSON.parse(raw), form };
  } catch {
    return fail(400, "Payload is not JSON");
  }
}

/** Uploads every file-backed attachment to Drive; returns `clientId → Drive id`. */
async function uploadAttachments(
  token: string,
  attachments: readonly Attachment[],
  form: FormData,
): Promise<Map<string, string> | Response> {
  const files: { clientId: string; file: File }[] = [];
  for (const attachment of attachments) {
    if (attachment.kind !== "file" && attachment.kind !== "exercise") continue;
    const file = form.get(`file:${attachment.clientId}`);
    if (!(file instanceof File)) {
      return fail(400, "Missing file for attachment", { name: attachment.name });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return fail(413, "Attachment too large", { name: attachment.name, code: "file_too_large" });
    }
    files.push({ clientId: attachment.clientId, file: new File([file], attachment.name, { type: file.type }) });
  }

  const driveIds = new Map<string, string>();
  for (const { clientId, file } of files) {
    try {
      const uploaded = await uploadToDrive(token, file);
      driveIds.set(clientId, uploaded.id);
    } catch (error) {
      // Name the failing file so the teacher knows which one to retry or drop.
      if (error instanceof GoogleError && error.code === "google_error") {
        return fail(502, error.message, { code: "upload_failed", name: file.name });
      }
      throw error;
    }
  }
  return driveIds;
}

export const classroomRoutes = {
  "/api/classroom/status": {
    GET: async (req: BunRequest<"/api/classroom/status">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;

      const status: ClassroomStatus = {
        connected: false,
        needsReconnect: false,
        email: null,
        grantedScopes: [],
        missingScopes: ALL_CLASSROOM_SCOPES,
      };

      const store = classroom();
      const disconnected = store.isDisconnected(caller.userId);

      let token: string;
      try {
        token = await googleToken(caller.userId);
      } catch (error) {
        if (!(error instanceof GoogleError)) throw error;
        return ok({ ...status, needsReconnect: error.code === "google_reauth" && !disconnected });
      }

      const info = await tokenInfo(token);
      if (!info.valid) return ok({ ...status, needsReconnect: !disconnected });
      // A valid token again means the teacher went through consent since.
      if (disconnected) store.clearDisconnected(caller.userId);

      const missingScopes = ALL_CLASSROOM_SCOPES.filter((scope) => !info.scopes.includes(scope));
      return ok({
        // Connected = at least one Classroom scope; partial grants disable features one by one.
        connected: missingScopes.length < ALL_CLASSROOM_SCOPES.length,
        needsReconnect: false,
        email: info.email,
        grantedScopes: info.scopes,
        missingScopes,
      } satisfies ClassroomStatus);
    },
  },

  "/api/classroom/disconnect": {
    POST: classroomHandler(async (_req, caller, token) => {
      await revokeToken(token);
      classroom().markDisconnected(caller.userId);
      return ok({ disconnected: true });
    }),
  },

  "/api/classroom/courses": {
    GET: classroomHandler(async (req, _caller, token) => {
      const archived = new URL(req.url).searchParams.get("archived") === "1";
      const url = new URL(`${CLASSROOM}/courses`);
      url.searchParams.set("teacherId", "me");
      url.searchParams.append("courseStates", "ACTIVE");
      if (archived) url.searchParams.append("courseStates", "ARCHIVED");
      url.searchParams.set("pageSize", "100");

      const courses = await googleListAll<GoogleCourse>(token, url.toString(), "courses");
      const counted = await Promise.all(
        courses.map(async (course): Promise<Course> => {
          const studentCount = await googleListAll<{ userId: string }>(
            token,
            `${CLASSROOM}/courses/${encodeURIComponent(course.id)}/students?pageSize=100&fields=students(userId),nextPageToken`,
            "students",
          ).then(
            (students) => students.length,
            // A course whose roster we cannot read still lists; the count just stays unknown.
            () => null,
          );
          return {
            id: course.id,
            name: course.name,
            section: course.section ?? null,
            state: course.courseState,
            link: course.alternateLink ?? "",
            studentCount,
          };
        }),
      );
      return ok(counted);
    }),
  },

  "/api/classroom/courses/:courseId": {
    GET: classroomHandler(async (req: BunRequest<"/api/classroom/courses/:courseId">, _caller, token) => {
      const course = await getCourse(token, req.params.courseId);
      return ok({
        id: course.id,
        name: course.name,
        section: course.section ?? null,
        state: course.courseState,
        link: course.alternateLink ?? "",
        studentCount: null,
      } satisfies Course);
    }),
  },

  "/api/classroom/courses/:courseId/students": {
    GET: classroomHandler(
      async (req: BunRequest<"/api/classroom/courses/:courseId/students">, _caller, token) =>
        ok(await listStudents(token, req.params.courseId)),
    ),
  },

  "/api/classroom/courses/:courseId/announcements": {
    GET: classroomHandler(
      async (req: BunRequest<"/api/classroom/courses/:courseId/announcements">, _caller, token) => {
        const url = new URL(
          `${CLASSROOM}/courses/${encodeURIComponent(req.params.courseId)}/announcements`,
        );
        url.searchParams.append("announcementStates", "PUBLISHED");
        url.searchParams.append("announcementStates", "DRAFT");
        url.searchParams.set("orderBy", "updateTime desc");
        url.searchParams.set("pageSize", "30");
        const body = await googleFetch<{ announcements?: GoogleAnnouncement[] }>(token, url.toString());
        return ok(
          (body.announcements ?? []).map(
            (announcement): Announcement => ({
              id: announcement.id,
              text: announcement.text ?? "",
              state: announcement.state,
              link: announcement.alternateLink ?? "",
              createdAt: announcement.creationTime,
              scheduledAt: announcement.scheduledTime ?? null,
              materials: (announcement.materials ?? [])
                .map(materialLink)
                .filter((item): item is { title: string; url: string } => item !== null),
            }),
          ),
        );
      },
    ),

    POST: classroomHandler(
      async (req: BunRequest<"/api/classroom/courses/:courseId/announcements">, caller, token) => {
        const body = await readMultipart(req);
        if (body instanceof Response) return body;
        const parsed = parseAnnouncementInput(body.payload);
        if (!parsed.ok) return fail(400, "Invalid announcement", parsed.reason);
        const input = parsed.value;

        const store = classroom();
        const existing = store.findAnnouncementByRequest(caller.userId, input.requestId);
        if (existing) return ok({ id: existing });

        const links = resolvePresentations(req, input.attachments);
        if (links instanceof Response) return links;
        const driveIds = await uploadAttachments(token, input.attachments, body.form);
        if (driveIds instanceof Response) return driveIds;

        const created = await googleFetch<{ id: string }>(
          token,
          `${CLASSROOM}/courses/${encodeURIComponent(req.params.courseId)}/announcements`,
          {
            method: "POST",
            body: JSON.stringify(announcementBody(input, toMaterials(input.attachments, driveIds, links))),
          },
        );
        store.recordAnnouncement(caller.userId, input.requestId, created.id);
        return ok({ id: created.id }, { status: 201 });
      },
    ),
  },

  "/api/classroom/courses/:courseId/coursework": {
    GET: classroomHandler(
      async (req: BunRequest<"/api/classroom/courses/:courseId/coursework">, caller, token) => {
        const { courseId } = req.params;
        const url = new URL(`${CLASSROOM}/courses/${encodeURIComponent(courseId)}/courseWork`);
        url.searchParams.append("courseWorkStates", "PUBLISHED");
        url.searchParams.append("courseWorkStates", "DRAFT");
        url.searchParams.set("pageSize", "100");

        const courseWork = await googleListAll<GoogleCourseWork>(token, url.toString(), "courseWork");
        const ours = new Map(
          classroom().listAssignments(caller.userId, courseId).map((a) => [a.courseWorkId, a.id]),
        );

        return ok(
          courseWork.map(
            (work): CourseWorkSummary => ({
              id: work.id,
              title: work.title,
              state: work.state,
              link: work.alternateLink ?? "",
              dueAt: fromGoogleDue(work.dueDate, work.dueTime),
              maxPoints: work.maxPoints ?? null,
              ownedByApp: work.associatedWithDeveloper === true,
              assignmentId: ours.get(work.id) ?? null,
            }),
          ),
        );
      },
    ),
  },

  "/api/classroom/courses/:courseId/coursework/:courseWorkId/submissions": {
    GET: classroomHandler(
      async (
        req: BunRequest<"/api/classroom/courses/:courseId/coursework/:courseWorkId/submissions">,
        _caller,
        token,
      ) => {
        const { courseId, courseWorkId } = req.params;
        const [submissions, students] = await Promise.all([
          googleListAll<GoogleSubmission>(
            token,
            `${CLASSROOM}/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions?pageSize=100`,
            "studentSubmissions",
          ),
          listStudents(token, courseId),
        ]);
        const names = new Map(students.map((student) => [student.userId, student.name]));

        return ok(
          submissions
            .map(
              (submission): Submission => ({
                userId: submission.userId,
                studentName: names.get(submission.userId) ?? submission.userId,
                state: submission.state,
                late: submission.late === true,
                grade: submission.assignedGrade ?? submission.draftGrade ?? null,
              }),
            )
            .sort((a, b) => a.studentName.localeCompare(b.studentName)),
        );
      },
    ),
  },

  "/api/classroom/assignments": {
    POST: classroomHandler(async (req, caller, token) => {
      const body = await readMultipart(req);
      if (body instanceof Response) return body;
      const parsed = parseAssignmentInput(body.payload);
      if (!parsed.ok) return fail(400, "Invalid assignment", parsed.reason);
      const input = parsed.value;

      const store = classroom();
      const sets = exerciseSets();
      // A retry after a network failure answers with the task already created.
      const existing = store.findAssignmentByRequest(caller.userId, input.requestId);
      if (existing) return ok(existing);

      const exerciseSetIds = [
        ...new Set(
          input.attachments.flatMap((a) => (a.kind === "exercise" ? [a.exerciseSetId] : [])),
        ),
      ];
      for (const id of exerciseSetIds) {
        if (!sets.findForUser(caller.userId, id)) return fail(404, "Exercise set not found", { id });
      }
      const links = resolvePresentations(req, input.attachments);
      if (links instanceof Response) return links;

      const course = await getCourse(token, input.courseId);
      const driveIds = await uploadAttachments(token, input.attachments, body.form);
      if (driveIds instanceof Response) return driveIds;

      const created = await googleFetch<GoogleCourseWork>(
        token,
        `${CLASSROOM}/courses/${encodeURIComponent(input.courseId)}/courseWork`,
        {
          method: "POST",
          body: JSON.stringify(courseWorkBody(input, toMaterials(input.attachments, driveIds, links))),
        },
      );

      const assignment = store.createAssignment(caller.userId, {
        requestId: input.requestId,
        courseId: input.courseId,
        courseWorkId: created.id,
        title: input.title,
        instructionsHtml: input.instructionsHtml,
        maxPoints: input.maxPoints,
        dueAt: input.dueAt,
        state: created.state,
        scheduledAt: input.scheduledAt,
        link: created.alternateLink ?? "",
        studentIds: input.studentIds,
        exerciseSetIds,
        presentationSlugs: [...links.keys()],
      });

      const assignedAt = new Date().toISOString();
      for (const id of exerciseSetIds) {
        sets.recordUsage(caller.userId, id, {
          courseId: course.id,
          courseName: course.name,
          courseWorkId: created.id,
          courseWorkTitle: input.title,
          link: assignment.link,
          assignedAt,
          dueAt: input.dueAt,
        });
      }

      return ok(assignment, { status: 201 });
    }),
  },

  "/api/classroom/assignments/:id": {
    GET: async (req: BunRequest<"/api/classroom/assignments/:id">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;
      const assignment = classroom().findAssignment(caller.userId, req.params.id);
      return assignment ? ok(assignment) : fail(404, "Assignment not found");
    },

    PATCH: classroomHandler(
      async (req: BunRequest<"/api/classroom/assignments/:id">, caller, token) => {
        const store = classroom();
        const assignment = store.findAssignment(caller.userId, req.params.id);
        if (!assignment) return fail(404, "Assignment not found");

        const parsed = parseAssignmentPatch(await req.json().catch(() => undefined));
        if (!parsed.ok) return fail(400, "Invalid assignment", parsed.reason);
        const patch = parsed.value;

        // Re-read the live state: the teacher may have published it from Classroom.
        const live = await googleFetch<GoogleCourseWork>(
          token,
          `${CLASSROOM}/courses/${encodeURIComponent(assignment.courseId)}/courseWork/${encodeURIComponent(assignment.courseWorkId)}`,
        );
        const { body, updateMask } = courseWorkPatch(patch, live.state);
        const updated = await googleFetch<GoogleCourseWork>(
          token,
          `${CLASSROOM}/courses/${encodeURIComponent(assignment.courseId)}/courseWork/${encodeURIComponent(assignment.courseWorkId)}?updateMask=${updateMask}`,
          { method: "PATCH", body: JSON.stringify(body) },
        );

        const saved = store.updateAssignment(caller.userId, assignment.id, {
          title: patch.title,
          instructionsHtml: patch.instructionsHtml,
          maxPoints: patch.maxPoints,
          dueAt: patch.dueAt,
          state: updated.state,
          scheduledAt: live.state === "DRAFT" ? patch.scheduledAt : assignment.scheduledAt,
          link: updated.alternateLink ?? assignment.link,
        });
        if (!saved) return fail(404, "Assignment not found");
        exerciseSets().syncUsages(caller.userId, assignment.courseWorkId, {
          courseWorkTitle: patch.title,
          link: updated.alternateLink ?? assignment.link,
          dueAt: patch.dueAt,
        });
        return ok(saved);
      },
    ),
  },
} as const;
