import type { APIRoute } from "astro";
import { sql } from "../../../../shared/lib/sql";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const POST: APIRoute = async ({ locals, params, url }) => {
  const { isAuthenticated, userId } = (locals as any).auth();
  if (!isAuthenticated) return json({ error: "Unauthorized" }, 401);

  const [row] = await sql`SELECT id, user_id, share_code FROM protocols WHERE id = ${params.id!}`;

  if (!row) return json({ error: "Not found" }, 404);
  if (row.user_id !== userId) return json({ error: "Forbidden" }, 403);

  let shareCode: string = row.share_code;
  if (!shareCode) {
    // Generate until unique
    shareCode = crypto.randomUUID().slice(0, 8).toUpperCase();
    await sql`
      UPDATE protocols SET share_code = ${shareCode}, is_public = true WHERE id = ${params.id!}
    `;
  }

  const shareUrl = `${url.origin}/protocols/${shareCode}`;
  return json({ shareCode, shareUrl });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const { isAuthenticated, userId } = (locals as any).auth();
  if (!isAuthenticated) return json({ error: "Unauthorized" }, 401);

  const [existing] = await sql`SELECT id, user_id FROM protocols WHERE id = ${params.id!}`;

  if (!existing) return json({ error: "Not found" }, 404);
  if (existing.user_id !== userId) return json({ error: "Forbidden" }, 403);

  await sql`UPDATE protocols SET share_code = NULL, is_public = false WHERE id = ${params.id!}`;

  return json({ ok: true });
};
