/**
 * Every statement the `classroom` domain runs — the local half of the
 * Classroom integration. Each one filters on `user_id`.
 */

export const INSERT_ASSIGNMENT = `
  INSERT INTO classroom_assignments (
    id, user_id, request_id, course_id, coursework_id, title, instructions_html,
    max_points, due_at, state, scheduled_at, link, student_ids, exercise_set_ids,
    presentation_slugs, created_at, updated_at
  )
  VALUES (
    $id, $userId, $requestId, $courseId, $courseWorkId, $title, $instructionsHtml,
    $maxPoints, $dueAt, $state, $scheduledAt, $link, $studentIds, $exerciseSetIds,
    $presentationSlugs, $createdAt, $updatedAt
  )
`;

export const UPDATE_ASSIGNMENT = `
  UPDATE classroom_assignments
     SET title = $title,
         instructions_html = $instructionsHtml,
         max_points = $maxPoints,
         due_at = $dueAt,
         state = $state,
         scheduled_at = $scheduledAt,
         link = $link,
         updated_at = $updatedAt
   WHERE id = $id
     AND user_id = $userId
`;

export const SELECT_ASSIGNMENT = `
  SELECT * FROM classroom_assignments
   WHERE id = $id
     AND user_id = $userId
`;

export const SELECT_ASSIGNMENT_BY_REQUEST = `
  SELECT * FROM classroom_assignments
   WHERE request_id = $requestId
     AND user_id = $userId
`;

export const SELECT_ASSIGNMENTS_BY_COURSE = `
  SELECT * FROM classroom_assignments
   WHERE user_id = $userId
     AND course_id = $courseId
   ORDER BY created_at DESC
`;

export const INSERT_ANNOUNCEMENT_REQUEST = `
  INSERT OR IGNORE INTO classroom_announcement_requests (user_id, request_id, announcement_id)
  VALUES ($userId, $requestId, $announcementId)
`;

export const SELECT_ANNOUNCEMENT_BY_REQUEST = `
  SELECT announcement_id FROM classroom_announcement_requests
   WHERE user_id = $userId
     AND request_id = $requestId
`;

export const UPSERT_DISCONNECT = `
  INSERT OR REPLACE INTO classroom_disconnects (user_id, at)
  VALUES ($userId, $at)
`;

export const DELETE_DISCONNECT = `
  DELETE FROM classroom_disconnects WHERE user_id = $userId
`;

export const SELECT_DISCONNECT = `
  SELECT user_id FROM classroom_disconnects WHERE user_id = $userId
`;
