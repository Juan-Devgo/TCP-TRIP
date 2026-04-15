import type { APIRoute } from "astro";
import { sql } from "../../../shared/lib/sql";

export const GET: APIRoute = async ({ locals }) => {
  const { isAuthenticated, userId } = (locals as any).auth();
  if (!isAuthenticated) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const rows = await sql`
    SELECT id, name, description, fields, created_at, updated_at, is_public, share_code
    FROM protocols
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;

  const protocols = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    fields: r.fields,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    isPublic: r.is_public,
    shareCode: r.share_code,
  }));

  return new Response(JSON.stringify(protocols), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const { isAuthenticated, userId } = (locals as any).auth();
  if (!isAuthenticated) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const body = (await request.json()) as any;
  const { name, description, fields } = body;

  if (!name || !fields) {
    return new Response(JSON.stringify({ error: "name and fields are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [row] = await sql`
    INSERT INTO protocols (user_id, name, description, fields)
    VALUES (${userId}, ${name}, ${description ?? ""}, ${JSON.stringify(fields)})
    RETURNING id, name, description, fields, created_at, updated_at, is_public, share_code
  `;

  return new Response(
    JSON.stringify({
      id: row.id,
      name: row.name,
      description: row.description,
      fields: row.fields,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isPublic: row.is_public,
      shareCode: row.share_code,
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
