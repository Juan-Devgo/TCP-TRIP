/**
 * Every statement the `exercise-sets` domain runs. Each one filters on
 * `user_id`, so another teacher's set id matches zero rows.
 */

export const INSERT_SET = `
  INSERT INTO exercise_sets (id, user_id, title, language, blocks, created_at, updated_at)
  VALUES ($id, $userId, $title, $language, $blocks, $createdAt, $updatedAt)
`;

export const UPDATE_SET = `
  UPDATE exercise_sets
     SET title = $title,
         language = $language,
         blocks = $blocks,
         updated_at = $updatedAt
   WHERE id = $id
     AND user_id = $userId
`;

export const SELECT_SET = `
  SELECT * FROM exercise_sets
   WHERE id = $id
     AND user_id = $userId
`;

export const SELECT_SETS_BY_USER = `
  SELECT * FROM exercise_sets
   WHERE user_id = $userId
   ORDER BY created_at DESC
`;

export const DELETE_SET = `
  DELETE FROM exercise_sets
   WHERE id = $id
     AND user_id = $userId
`;

export const INSERT_USAGE = `
  INSERT INTO exercise_set_usages (
    id, set_id, user_id, course_id, course_name, coursework_id, coursework_title,
    link, assigned_at, due_at
  )
  VALUES (
    $id, $setId, $userId, $courseId, $courseName, $courseWorkId, $courseWorkTitle,
    $link, $assignedAt, $dueAt
  )
`;

/** Every usage of the caller's sets; the repository groups them per set. */
export const SELECT_USAGES_BY_USER = `
  SELECT * FROM exercise_set_usages
   WHERE user_id = $userId
   ORDER BY assigned_at DESC
`;

export const SELECT_USAGES_BY_SET = `
  SELECT * FROM exercise_set_usages
   WHERE user_id = $userId
     AND set_id = $setId
   ORDER BY assigned_at DESC
`;

/** Keeps the snapshots in step when the assignment is edited from TCP-TRIP. */
export const UPDATE_USAGES_BY_COURSEWORK = `
  UPDATE exercise_set_usages
     SET coursework_title = $courseWorkTitle,
         link = $link,
         due_at = $dueAt
   WHERE user_id = $userId
     AND coursework_id = $courseWorkId
`;
