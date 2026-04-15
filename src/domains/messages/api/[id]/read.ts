import type { APIRoute } from "astro";
import { sql } from "../../../../shared/lib/sql";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const POST: APIRoute = async ({ locals, params }) => {
  const { isAuthenticated, userId } = (locals as any).auth();
  if (!isAuthenticated) return json({ error: "Unauthorized" }, 401);

  const [existing] = await sql`SELECT id, to_user_id FROM messages WHERE id = ${params.id!}`;

  if (!existing) return json({ error: "Not found" }, 404);
  if (existing.to_user_id !== userId) return json({ error: "Forbidden" }, 403);

  const [updated] = await sql`
    UPDATE messages SET read_at = NOW()
    WHERE id = ${params.id!} AND read_at IS NULL
    RETURNING read_at
  `;

  const readAt = updated?.read_at ?? existing.read_at;
  return json({ ok: true, readAt });
};
