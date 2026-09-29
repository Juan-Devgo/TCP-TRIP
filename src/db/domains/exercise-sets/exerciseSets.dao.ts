/**
 * SQL for `exercise_sets` and the usages that hang off it. Binds parameters,
 * returns rows, decides nothing — the rules are the repository's.
 */

import { BaseDao } from "@/db/core/dao";
import type { WriteResult } from "@/db/core/types";
import {
  DELETE_SET,
  INSERT_SET,
  INSERT_USAGE,
  SELECT_SET,
  SELECT_SETS_BY_USER,
  SELECT_USAGES_BY_SET,
  SELECT_USAGES_BY_USER,
  UPDATE_SET,
  UPDATE_USAGES_BY_COURSEWORK,
} from "@/db/domains/exercise-sets/exerciseSets.queries";
import type {
  ExerciseSetRow,
  ExerciseUsageRow,
} from "@/db/domains/exercise-sets/exerciseSets.types";

export type ExerciseSetWrite = {
  id: string;
  userId: string;
  title: string;
  language: string;
  /** The blocks, already serialized. */
  blocks: string;
};

export type ExerciseUsageWrite = {
  id: string;
  setId: string;
  userId: string;
  courseId: string;
  courseName: string;
  courseWorkId: string;
  courseWorkTitle: string;
  link: string;
  assignedAt: string;
  dueAt: string | null;
};

export class ExerciseSetsDao extends BaseDao<ExerciseSetRow> {
  insert(values: ExerciseSetWrite & { createdAt: string; updatedAt: string }): WriteResult {
    return this.write(INSERT_SET, { ...values });
  }

  update(values: ExerciseSetWrite & { updatedAt: string }): WriteResult {
    return this.write(UPDATE_SET, { ...values });
  }

  findById(userId: string, id: string): ExerciseSetRow | null {
    return this.one(SELECT_SET, { userId, id });
  }

  listByUser(userId: string): ExerciseSetRow[] {
    return this.all(SELECT_SETS_BY_USER, { userId });
  }

  deleteById(userId: string, id: string): WriteResult {
    return this.write(DELETE_SET, { userId, id });
  }

  insertUsage(values: ExerciseUsageWrite): WriteResult {
    return this.write(INSERT_USAGE, { ...values });
  }

  usagesByUser(userId: string): ExerciseUsageRow[] {
    return this.all<ExerciseUsageRow>(SELECT_USAGES_BY_USER, { userId });
  }

  usagesBySet(userId: string, setId: string): ExerciseUsageRow[] {
    return this.all<ExerciseUsageRow>(SELECT_USAGES_BY_SET, { userId, setId });
  }

  updateUsagesByCourseWork(values: {
    userId: string;
    courseWorkId: string;
    courseWorkTitle: string;
    link: string;
    dueAt: string | null;
  }): WriteResult {
    return this.write(UPDATE_USAGES_BY_COURSEWORK, { ...values });
  }
}
