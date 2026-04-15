import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals, url }) => {
  const { isAuthenticated } = (locals as any).auth();
  if (!isAuthenticated) {
    return new Response("Unauthorized", { status: 401 });
  }

  const query = url.searchParams.get("q")?.trim();
  if (!query || query.length < 3) {
    return new Response(JSON.stringify({ users: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Use Clerk backend to search users by email or username
    const { clerkClient } = await import("@clerk/astro/server");

    // @ts-ignore – clerkClient shape varies by version
    const client = typeof clerkClient === "function" ? clerkClient() : clerkClient;

    const result = await client.users.getUserList({
      emailAddress: [query],
      limit: 5,
    });

    const users = (result.data ?? result).map((u: any) => ({
      id: u.id,
      displayName:
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
        u.username ||
        u.emailAddresses?.[0]?.emailAddress ||
        u.id,
      email: u.emailAddresses?.[0]?.emailAddress ?? "",
      imageUrl: u.imageUrl ?? "",
    }));

    return new Response(JSON.stringify({ users }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("User search error:", err);
    return new Response(JSON.stringify({ users: [], error: "Search unavailable" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
