/**
 * The teacher's saved exercise sets (`Crear ejercicios` / `Mis ejercicios`)
 * and where each one was handed out. Every call is scoped to the Clerk user id
 * the route verified — never one from a payload.
 */

import type { Database } from "bun:sqlite";

import { getDb } from "@/db/client";
import { BaseRepository } from "@/db/core/repository";
import { ExerciseSetsDao } from "@/db/domains/exercise-sets/exerciseSets.dao";
import type {
  ExerciseSetRow,
  ExerciseUsageRow,
} from "@/db/domains/exercise-sets/exerciseSets.types";
import type {
  ExerciseSet,
  ExerciseSetInput,
  ExerciseUsage,
} from "@/lib/exercises/sets";

export type NewExerciseUsage = Omit<ExerciseUsage, "id">;

/** Why an update was refused: the set was already handed out. */
export const SET_IN_USE = "used" as const;

function toUsage(row: ExerciseUsageRow): ExerciseUsage {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    courseWorkId: row.coursework_id,
    courseWorkTitle: row.coursework_title,
    link: row.link,
    assignedAt: row.assigned_at,
    dueAt: row.due_at,
  };
}

export class ExerciseSetsRepository extends BaseRepository<ExerciseSetRow, ExerciseSet> {
  private readonly dao: ExerciseSetsDao;

  /** `now` is injectable so tests get a deterministic order. */
  constructor(
    db: Database = getDb(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    super(db);
    this.dao = new ExerciseSetsDao(db);
  }

  /** Usages live in their own table; the callers below attach them. */
  protected toEntity(row: ExerciseSetRow): ExerciseSet {
    return {
      id: row.id,
      title: row.title,
      language: row.language,
      blocks: JSON.parse(row.blocks) as ExerciseSet["blocks"],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      usages: [],
    };
  }

  private withUsages(userId: string, row: ExerciseSetRow | null): ExerciseSet | null {
    if (!row) return null;
    return { ...this.toEntity(row), usages: this.dao.usagesBySet(userId, row.id).map(toUsage) };
  }

  /** `Mis ejercicios`: newest first, each with its usages. */
  listForUser(userId: string): ExerciseSet[] {
    const bySet = new Map<string, ExerciseUsage[]>();
    for (const row of this.dao.usagesByUser(userId)) {
      const list = bySet.get(row.set_id) ?? [];
      list.push(toUsage(row));
      bySet.set(row.set_id, list);
    }
    return this.dao
      .listByUser(userId)
      .map((row) => ({ ...this.toEntity(row), usages: bySet.get(row.id) ?? [] }));
  }

  findForUser(userId: string, id: string): ExerciseSet | null {
    return this.withUsages(userId, this.dao.findById(userId, id));
  }

  create(userId: string, input: ExerciseSetInput): ExerciseSet {
    const id = crypto.randomUUID();
    const now = this.now();
    this.dao.insert({
      id,
      userId,
      title: input.title,
      language: input.language,
      blocks: JSON.stringify(input.blocks),
      createdAt: now,
      updatedAt: now,
    });
    return this.findForUser(userId, id) as ExerciseSet;
  }

  /**
   * A set that was already handed out is frozen: rewriting it would make the
   * re-downloaded PDF disagree with what students received. `SET_IN_USE` tells
   * the route to ask for a duplicate instead; `null` is an owner-scoped 404.
   */
  update(
    userId: string,
    id: string,
    input: ExerciseSetInput,
  ): ExerciseSet | null | typeof SET_IN_USE {
    const write = this.transaction((): ExerciseSet | null | typeof SET_IN_USE => {
      const existing = this.dao.findById(userId, id);
      if (!existing) return null;
      if (this.dao.usagesBySet(userId, id).length > 0) return SET_IN_USE;

      this.dao.update({
        id,
        userId,
        title: input.title,
        language: input.language,
        blocks: JSON.stringify(input.blocks),
        updatedAt: this.now(),
      });
      return this.findForUser(userId, id);
    });
    return write();
  }

  /** Usages go with it (`ON DELETE CASCADE`); tasks already in Classroom stay. */
  remove(userId: string, id: string): boolean {
    return this.dao.deleteById(userId, id).changes > 0;
  }

  /** Written once per set when an assignment carrying it is created. */
  recordUsage(userId: string, setId: string, usage: NewExerciseUsage): void {
    if (!this.dao.findById(userId, setId)) return;
    this.dao.insertUsage({ ...usage, id: crypto.randomUUID(), setId, userId });
  }

  /** Keeps the usage snapshots in step when an assignment is edited. */
  syncUsages(
    userId: string,
    courseWorkId: string,
    patch: Pick<NewExerciseUsage, "courseWorkTitle" | "link" | "dueAt">,
  ): void {
    this.dao.updateUsagesByCourseWork({ userId, courseWorkId, ...patch });
  }
}
