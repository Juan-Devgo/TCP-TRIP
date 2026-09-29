/**
 * SQL for the Classroom tables: TCP-TRIP's own assignments, the announcement
 * request log and the disconnect marker. Binds parameters, returns rows.
 */

import { BaseDao } from "@/db/core/dao";
import type { WriteResult } from "@/db/core/types";
import {
  DELETE_DISCONNECT,
  INSERT_ANNOUNCEMENT_REQUEST,
  INSERT_ASSIGNMENT,
  SELECT_ANNOUNCEMENT_BY_REQUEST,
  SELECT_ASSIGNMENT,
  SELECT_ASSIGNMENT_BY_REQUEST,
  SELECT_ASSIGNMENTS_BY_COURSE,
  SELECT_DISCONNECT,
  UPDATE_ASSIGNMENT,
  UPSERT_DISCONNECT,
} from "@/db/domains/classroom/classroom.queries";
import type { AssignmentRow } from "@/db/domains/classroom/classroom.types";

export type AssignmentWrite = {
  id: string;
  userId: string;
  requestId: string;
  courseId: string;
  courseWorkId: string;
  title: string;
  instructionsHtml: string;
  maxPoints: number | null;
  dueAt: string | null;
  state: string;
  scheduledAt: string | null;
  link: string;
  /** JSON arrays, already serialized. */
  studentIds: string;
  exerciseSetIds: string;
  presentationSlugs: string;
  createdAt: string;
  updatedAt: string;
};

export type AssignmentUpdate = Pick<
  AssignmentWrite,
  | "id"
  | "userId"
  | "title"
  | "instructionsHtml"
  | "maxPoints"
  | "dueAt"
  | "state"
  | "scheduledAt"
  | "link"
  | "updatedAt"
>;

export class ClassroomDao extends BaseDao<AssignmentRow> {
  insertAssignment(values: AssignmentWrite): WriteResult {
    return this.write(INSERT_ASSIGNMENT, { ...values });
  }

  updateAssignment(values: AssignmentUpdate): WriteResult {
    return this.write(UPDATE_ASSIGNMENT, { ...values });
  }

  findAssignment(userId: string, id: string): AssignmentRow | null {
    return this.one(SELECT_ASSIGNMENT, { userId, id });
  }

  findAssignmentByRequest(userId: string, requestId: string): AssignmentRow | null {
    return this.one(SELECT_ASSIGNMENT_BY_REQUEST, { userId, requestId });
  }

  listAssignmentsByCourse(userId: string, courseId: string): AssignmentRow[] {
    return this.all(SELECT_ASSIGNMENTS_BY_COURSE, { userId, courseId });
  }

  insertAnnouncementRequest(userId: string, requestId: string, announcementId: string): WriteResult {
    return this.write(INSERT_ANNOUNCEMENT_REQUEST, { userId, requestId, announcementId });
  }

  findAnnouncementByRequest(userId: string, requestId: string): string | null {
    return (
      this.one<{ announcement_id: string }>(SELECT_ANNOUNCEMENT_BY_REQUEST, { userId, requestId })
        ?.announcement_id ?? null
    );
  }

  upsertDisconnect(userId: string, at: string): WriteResult {
    return this.write(UPSERT_DISCONNECT, { userId, at });
  }

  deleteDisconnect(userId: string): WriteResult {
    return this.write(DELETE_DISCONNECT, { userId });
  }

  hasDisconnect(userId: string): boolean {
    return this.one(SELECT_DISCONNECT, { userId }) !== null;
  }
}
