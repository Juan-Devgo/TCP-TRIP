/**
 * The local half of the Classroom integration. Classroom itself is the source
 * of truth for courses, rosters and submissions; this keeps only what Google
 * cannot: which tasks TCP-TRIP created (the only ones it may edit), their
 * formatted instructions, and the request ids that make retries idempotent.
 */

import type { Database } from "bun:sqlite";

import { getDb } from "@/db/client";
import { BaseRepository } from "@/db/core/repository";
import { ClassroomDao } from "@/db/domains/classroom/classroom.dao";
import type { AssignmentRow } from "@/db/domains/classroom/classroom.types";
import type { StoredAssignment } from "@/lib/classroom";

export type NewAssignment = Omit<StoredAssignment, "id" | "createdAt" | "updatedAt"> & {
  requestId: string;
};

export type AssignmentChanges = Pick<
  StoredAssignment,
  "title" | "instructionsHtml" | "maxPoints" | "dueAt" | "state" | "scheduledAt" | "link"
>;

export class ClassroomRepository extends BaseRepository<AssignmentRow, StoredAssignment> {
  private readonly dao: ClassroomDao;

  /** `now` is injectable so tests get deterministic timestamps. */
  constructor(
    db: Database = getDb(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    super(db);
    this.dao = new ClassroomDao(db);
  }

  protected toEntity(row: AssignmentRow): StoredAssignment {
    return {
      id: row.id,
      courseId: row.course_id,
      courseWorkId: row.coursework_id,
      title: row.title,
      instructionsHtml: row.instructions_html,
      maxPoints: row.max_points,
      dueAt: row.due_at,
      state: row.state,
      scheduledAt: row.scheduled_at,
      link: row.link,
      studentIds: JSON.parse(row.student_ids) as string[],
      exerciseSetIds: JSON.parse(row.exercise_set_ids) as string[],
      presentationSlugs: JSON.parse(row.presentation_slugs) as string[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /* --------------------------------------------------------- assignments */

  /** A retry after a network failure answers with the task already created. */
  findAssignmentByRequest(userId: string, requestId: string): StoredAssignment | null {
    return this.toEntityOrNull(this.dao.findAssignmentByRequest(userId, requestId));
  }

  findAssignment(userId: string, id: string): StoredAssignment | null {
    return this.toEntityOrNull(this.dao.findAssignment(userId, id));
  }

  listAssignments(userId: string, courseId: string): StoredAssignment[] {
    return this.toEntities(this.dao.listAssignmentsByCourse(userId, courseId));
  }

  createAssignment(userId: string, input: NewAssignment): StoredAssignment {
    const id = crypto.randomUUID();
    const now = this.now();
    this.dao.insertAssignment({
      id,
      userId,
      requestId: input.requestId,
      courseId: input.courseId,
      courseWorkId: input.courseWorkId,
      title: input.title,
      instructionsHtml: input.instructionsHtml,
      maxPoints: input.maxPoints,
      dueAt: input.dueAt,
      state: input.state,
      scheduledAt: input.scheduledAt,
      link: input.link,
      studentIds: JSON.stringify(input.studentIds),
      exerciseSetIds: JSON.stringify(input.exerciseSetIds),
      presentationSlugs: JSON.stringify(input.presentationSlugs),
      createdAt: now,
      updatedAt: now,
    });
    return this.findAssignment(userId, id) as StoredAssignment;
  }

  /** `null` = not one of the caller's (owner-scoped 404). */
  updateAssignment(userId: string, id: string, changes: AssignmentChanges): StoredAssignment | null {
    const { changes: touched } = this.dao.updateAssignment({
      ...changes,
      id,
      userId,
      updatedAt: this.now(),
    });
    return touched > 0 ? this.findAssignment(userId, id) : null;
  }

  /* ------------------------------------------------------- announcements */

  findAnnouncementByRequest(userId: string, requestId: string): string | null {
    return this.dao.findAnnouncementByRequest(userId, requestId);
  }

  /** First write wins: a retried post keeps the id of the one Classroom has. */
  recordAnnouncement(userId: string, requestId: string, announcementId: string): void {
    this.dao.insertAnnouncementRequest(userId, requestId, announcementId);
  }

  /* ---------------------------------------------------------- connection */

  /**
   * A revoked grant looks exactly like an expired one to Google. Remembering
   * that the teacher chose to disconnect lets the UI say "not connected"
   * instead of "your authorization expired".
   */
  markDisconnected(userId: string): void {
    this.dao.upsertDisconnect(userId, this.now());
  }

  clearDisconnected(userId: string): void {
    this.dao.deleteDisconnect(userId);
  }

  isDisconnected(userId: string): boolean {
    return this.dao.hasDisconnect(userId);
  }
}
