import type { APIRoute } from "astro";
import { sql } from "../../../../shared/lib/sql";

export const GET: APIRoute = async ({ params }) => {
  const [row] = await sql`
    SELECT id, name, description, fields, created_at, share_code
    FROM protocols
    WHERE share_code = ${params.shareCode!} AND is_public = true
  `;

  if (!row) {
    return new Response(JSON.stringify({ error: "Not found or not public" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      id: row.id,
      name: row.name,
      description: row.description,
      fields: row.fields,
      createdAt: row.created_at,
      shareCode: row.share_code,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
