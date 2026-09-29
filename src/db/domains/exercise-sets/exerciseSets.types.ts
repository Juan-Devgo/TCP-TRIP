/** The `exercise_sets` and `exercise_set_usages` tables as SQLite returns them. */

export type ExerciseSetRow = {
  id: string;
  user_id: string;
  title: string;
  language: string;
  blocks: string;
  created_at: string;
  updated_at: string;
};

export type ExerciseUsageRow = {
  id: string;
  set_id: string;
  user_id: string;
  course_id: string;
  course_name: string;
  coursework_id: string;
  coursework_title: string;
  link: string;
  assigned_at: string;
  due_at: string | null;
};
