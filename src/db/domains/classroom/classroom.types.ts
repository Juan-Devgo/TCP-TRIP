/** The `classroom_assignments` table as SQLite returns it. */
export type AssignmentRow = {
  id: string;
  user_id: string;
  request_id: string;
  course_id: string;
  coursework_id: string;
  title: string;
  instructions_html: string;
  max_points: number | null;
  due_at: string | null;
  state: string;
  scheduled_at: string | null;
  link: string;
  student_ids: string;
  exercise_set_ids: string;
  presentation_slugs: string;
  created_at: string;
  updated_at: string;
};
