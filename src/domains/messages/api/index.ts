import type { APIRoute } from "astro";
import { sql } from "../../../shared/lib/sql";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const GET: APIRoute = async ({ locals, url }) => {
  const { isAuthenticated, userId } = (locals as any).auth();
  if (!isAuthenticated) return json({ error: "Unauthorized" }, 401);

  const box = url.searchParams.get("box") ?? "inbox";

  const rows = box === "sent"
    ? await sql`
        SELECT id, from_user_id, to_user_id, protocol_id, header_values, payload,
               created_at, read_at, protocol_snapshot, from_display_name, to_display_name
        FROM messages WHERE from_user_id = ${userId} ORDER BY created_at DESC
      `
    : await sql`
        SELECT id, from_user_id, to_user_id, protocol_id, header_values, payload,
               created_at, read_at, protocol_snapshot, from_display_name, to_display_name
        FROM messages WHERE to_user_id = ${userId} ORDER BY created_at DESC
      `;

  const messages = rows.map((r: any) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    toUserId: r.to_user_id,
    protocolId: r.protocol_id,
    headerValues: r.header_values,
    payload: r.payload,
    createdAt: r.created_at,
    readAt: r.read_at,
    protocolSnapshot: r.protocol_snapshot,
    fromDisplayName: r.from_display_name,
    toDisplayName: r.to_display_name,
  }));

  return json(messages);
};

export const POST: APIRoute = async ({ locals, request }) => {
  const { isAuthenticated, userId } = (locals as any).auth();
  if (!isAuthenticated) return json({ error: "Unauthorized" }, 401);

  const body = (await request.json()) as any;
  const { toUserId, protocolId, headerValues, payload, protocolSnapshot, fromDisplayName, toDisplayName } = body;

  if (!toUserId || !headerValues) {
    return json({ error: "toUserId and headerValues are required" }, 400);
  }

  const [row] = await sql`
    INSERT INTO messages (
      from_user_id, to_user_id, protocol_id, header_values, payload,
      protocol_snapshot, from_display_name, to_display_name
    )
    VALUES (
      ${userId}, ${toUserId}, ${protocolId ?? null}, ${JSON.stringify(headerValues)}, ${payload ?? ""},
      ${protocolSnapshot ? JSON.stringify(protocolSnapshot) : null}, ${fromDisplayName ?? null}, ${toDisplayName ?? null}
    )
    RETURNING id, created_at
  `;

  return json({ id: row.id, createdAt: row.created_at }, 201);
};
