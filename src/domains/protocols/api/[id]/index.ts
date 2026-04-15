import type { APIRoute } from "astro";
import { sql } from "../../../../shared/lib/sql";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const GET: APIRoute = async ({ locals, params }) => {
  const { isAuthenticated, userId } = (locals as any).auth();
  if (!isAuthenticated) return json({ error: "Unauthorized" }, 401);

  const [row] = await sql`
    SELECT id, user_id, name, description, fields, created_at, updated_at, is_public, share_code
    FROM protocols WHERE id = ${params.id!}
  `;

  if (!row) return json({ error: "Not found" }, 404);
  if (row.user_id !== userId) return json({ error: "Forbidden" }, 403);

  return json({
    id: row.id,
    name: row.name,
    description: row.description,
    fields: row.fields,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPublic: row.is_public,
    shareCode: row.share_code,
  });
};

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const { isAuthenticated, userId } = (locals as any).auth();
  if (!isAuthenticated) return json({ error: "Unauthorized" }, 401);

  const body = (await request.json()) as any;
  const { name, description, fields } = body;

  if (!name || !fields) return json({ error: "name and fields are required" }, 400);

  const [existing] = await sql`SELECT id, user_id FROM protocols WHERE id = ${params.id!}`;

  if (!existing) return json({ error: "Not found" }, 404);
  if (existing.user_id !== userId) return json({ error: "Forbidden" }, 403);

  const [updated] = await sql`
    UPDATE protocols
    SET name = ${name}, description = ${description ?? ""}, fields = ${JSON.stringify(fields)}, updated_at = NOW()
    WHERE id = ${params.id!}
    RETURNING updated_at
  `;

  return json({ ok: true, updatedAt: updated.updated_at });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const { isAuthenticated, userId } = (locals as any).auth();
  if (!isAuthenticated) return json({ error: "Unauthorized" }, 401);

  const [existing] = await sql`SELECT id, user_id FROM protocols WHERE id = ${params.id!}`;

  if (!existing) return json({ error: "Not found" }, 404);
  if (existing.user_id !== userId) return json({ error: "Forbidden" }, 403);

  await sql`DELETE FROM protocols WHERE id = ${params.id!}`;

  return json({ ok: true });
};
