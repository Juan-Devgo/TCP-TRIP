/**
 * Every statement the `protocols` domain runs.
 *
 * **Ownership is in the `WHERE` clause.** Each query below except the share
 * lookup filters on `user_id`, so a request carrying someone else's protocol id
 * matches zero rows instead of returning their work — the check cannot be
 * forgotten in a branch, because it is the query.
 */

export const INSERT_PROTOCOL = `
  INSERT INTO protocols (
    id, user_id, name, schema_version, document, share_id, created_at, updated_at
  )
  VALUES (
    $id, $userId, $name, $schemaVersion, $document, NULL, $createdAt, $updatedAt
  )
`;

export const UPDATE_PROTOCOL = `
  UPDATE protocols
     SET name = $name,
         schema_version = $schemaVersion,
         document = $document,
         updated_at = $updatedAt
   WHERE id = $id
     AND user_id = $userId
`;

export const SELECT_PROTOCOL = `
  SELECT * FROM protocols
   WHERE id = $id
     AND user_id = $userId
`;

export const SELECT_PROTOCOLS_BY_USER = `
  SELECT * FROM protocols
   WHERE user_id = $userId
   ORDER BY updated_at DESC
`;

export const DELETE_PROTOCOL = `
  DELETE FROM protocols
   WHERE id = $id
     AND user_id = $userId
`;

/**
 * Mints a share id, and only once: the `share_id IS NULL` guard makes a second
 * call a no-op instead of rotating the link a student already handed out.
 */
export const SET_SHARE_ID = `
  UPDATE protocols
     SET share_id = $shareId,
         updated_at = $updatedAt
   WHERE id = $id
     AND user_id = $userId
     AND share_id IS NULL
`;

/** The one query with no owner: a share link is public by definition. */
export const SELECT_PROTOCOL_BY_SHARE_ID = `
  SELECT * FROM protocols
   WHERE share_id = $shareId
`;
