import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  Announcement,
  AnnouncementInput,
  AssignmentInput,
  AssignmentPatch,
  ClassroomStatus,
  Course,
  CourseWorkSummary,
  StoredAssignment,
  Student,
  Submission,
} from "@/lib/classroom";
import { ApiError, request } from "@/services/client";
import { exerciseKeys } from "@/services/exercises";

/**
 * Query hooks over `/api/classroom/*`. The server holds the Google token; this
 * file only ever sees TCP-TRIP's own shapes.
 */

export const classroomKeys = {
  status: ["classroom", "status"] as const,
  courses: (archived: boolean) => ["classroom", "courses", { archived }] as const,
  course: (id: string) => ["classroom", "course", id] as const,
  students: (courseId: string) => ["classroom", "course", courseId, "students"] as const,
  announcements: (courseId: string) => ["classroom", "course", courseId, "announcements"] as const,
  coursework: (courseId: string) => ["classroom", "course", courseId, "coursework"] as const,
  submissions: (courseId: string, courseWorkId: string) =>
    ["classroom", "course", courseId, "coursework", courseWorkId] as const,
  assignment: (id: string) => ["classroom", "assignment", id] as const,
};

/** The Google failures the UI handles by asking the teacher to (re)connect. */
export function isConnectionError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.code === "google_not_connected" ||
      error.code === "google_reauth" ||
      error.code === "google_scopes")
  );
}

/**
 * Bytes that go along with a create request, keyed by the attachment's
 * `clientId`: local files as picked, exercise sets as rendered PDFs.
 */
export type UploadFiles = Map<string, File>;

function multipart(payload: unknown, files: UploadFiles): FormData {
  const form = new FormData();
  form.set("payload", JSON.stringify(payload));
  for (const [clientId, file] of files) form.set(`file:${clientId}`, file, file.name);
  return form;
}

export function useClassroomStatus(enabled = true) {
  return useQuery({
    queryKey: classroomKeys.status,
    queryFn: () => request<ClassroomStatus>("/api/classroom/status"),
    enabled,
    staleTime: 60_000,
  });
}

export function useDisconnectClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => request<{ disconnected: true }>("/api/classroom/disconnect", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classroom"] }),
  });
}

export function useCourses(archived: boolean, enabled = true) {
  return useQuery({
    queryKey: classroomKeys.courses(archived),
    queryFn: () => request<Course[]>(`/api/classroom/courses${archived ? "?archived=1" : ""}`),
    enabled,
  });
}

export function useCourse(courseId: string) {
  return useQuery({
    queryKey: classroomKeys.course(courseId),
    queryFn: () => request<Course>(`/api/classroom/courses/${encodeURIComponent(courseId)}`),
  });
}

export function useStudents(courseId: string | null) {
  return useQuery({
    queryKey: classroomKeys.students(courseId ?? ""),
    queryFn: () =>
      request<Student[]>(`/api/classroom/courses/${encodeURIComponent(courseId ?? "")}/students`),
    enabled: courseId !== null,
  });
}

export function useAnnouncements(courseId: string) {
  return useQuery({
    queryKey: classroomKeys.announcements(courseId),
    queryFn: () =>
      request<Announcement[]>(`/api/classroom/courses/${encodeURIComponent(courseId)}/announcements`),
  });
}

export function useCreateAnnouncement(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, files }: { input: AnnouncementInput; files: UploadFiles }) =>
      request<{ id: string }>(`/api/classroom/courses/${encodeURIComponent(courseId)}/announcements`, {
        method: "POST",
        body: multipart(input, files),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: classroomKeys.announcements(courseId) }),
  });
}

export function useCourseWork(courseId: string) {
  return useQuery({
    queryKey: classroomKeys.coursework(courseId),
    queryFn: () =>
      request<CourseWorkSummary[]>(`/api/classroom/courses/${encodeURIComponent(courseId)}/coursework`),
  });
}

export function useSubmissions(courseId: string, courseWorkId: string | null) {
  return useQuery({
    queryKey: classroomKeys.submissions(courseId, courseWorkId ?? ""),
    queryFn: () =>
      request<Submission[]>(
        `/api/classroom/courses/${encodeURIComponent(courseId)}/coursework/${encodeURIComponent(courseWorkId ?? "")}/submissions`,
      ),
    enabled: courseWorkId !== null,
  });
}

export function useAssignment(id: string | null) {
  return useQuery({
    queryKey: classroomKeys.assignment(id ?? ""),
    queryFn: () => request<StoredAssignment>(`/api/classroom/assignments/${encodeURIComponent(id ?? "")}`),
    enabled: id !== null,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, files }: { input: AssignmentInput; files: UploadFiles }) =>
      request<StoredAssignment>("/api/classroom/assignments", {
        method: "POST",
        body: multipart(input, files),
      }),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: classroomKeys.coursework(assignment.courseId) });
      // The usage rows changed: `Mis ejercicios` must show where the set went.
      void queryClient.invalidateQueries({ queryKey: exerciseKeys.all });
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AssignmentPatch }) =>
      request<StoredAssignment>(`/api/classroom/assignments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (assignment) => {
      queryClient.setQueryData(classroomKeys.assignment(assignment.id), assignment);
      void queryClient.invalidateQueries({ queryKey: classroomKeys.coursework(assignment.courseId) });
      void queryClient.invalidateQueries({ queryKey: exerciseKeys.all });
    },
  });
}
