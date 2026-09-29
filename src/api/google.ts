import { getClerk } from "@/api/auth";
import { fail } from "@/api/http";
import type { ClassroomErrorCode } from "@/lib/classroom";

/**
 * The only door to Google. The access token is read from Clerk (which holds
 * the OAuth grant) on every request and never leaves the server.
 */

export class GoogleError extends Error {
  constructor(
    readonly code: ClassroomErrorCode,
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}

/** What a route answers when a Google call fails. The client keys its UI on `details.code`. */
export function googleErrorResponse(error: unknown): Response | null {
  if (!(error instanceof GoogleError)) return null;
  return fail(error.status, error.message, { code: error.code });
}

/** The Google access token Clerk holds for this user, refreshed by Clerk on read. */
export async function googleToken(userId: string): Promise<string> {
  let token: string | undefined;
  try {
    const { data } = await getClerk().users.getUserOauthAccessToken(userId, "google");
    token = data[0]?.token;
    if (data.length === 0) {
      throw new GoogleError("google_not_connected", "No Google account is connected");
    }
  } catch (error) {
    if (error instanceof GoogleError) throw error;
    // Clerk fails the read when the refresh token is gone (revoked or expired).
    console.warn("[google] token read failed", error);
    throw new GoogleError("google_reauth", "The Google authorization must be renewed");
  }
  if (!token) throw new GoogleError("google_reauth", "The Google authorization must be renewed");
  return token;
}

type GoogleErrorBody = {
  error?: { code?: number; message?: string; status?: string; details?: { reason?: string }[] };
};

/** `fetch` against a Google API, mapping its failures onto `GoogleError`. */
export async function googleFetch<T>(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });
  if (res.ok) {
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  const body = (await res.json().catch(() => ({}))) as GoogleErrorBody;
  const message = body.error?.message ?? `Google answered ${res.status}`;
  const reasons = body.error?.details?.map((detail) => detail.reason) ?? [];

  if (res.status === 401) {
    throw new GoogleError("google_reauth", "The Google authorization must be renewed");
  }
  if (
    res.status === 403 &&
    (reasons.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT") || /insufficient.*scope/i.test(message))
  ) {
    throw new GoogleError("google_scopes", "A Google permission is missing");
  }
  console.warn(`[google] ${init.method ?? "GET"} ${url} → ${res.status}`, message);
  throw new GoogleError("google_error", message, res.status >= 500 ? 502 : res.status);
}

/** Follows `nextPageToken` until the list is complete. */
export async function googleListAll<T>(
  token: string,
  url: string,
  key: string,
): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  do {
    const page = new URL(url);
    if (pageToken) page.searchParams.set("pageToken", pageToken);
    const body = await googleFetch<Record<string, unknown> & { nextPageToken?: string }>(
      token,
      page.toString(),
    );
    items.push(...((body[key] as T[] | undefined) ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return items;
}

/** The scopes and email a token actually carries — Google's word, not Clerk's cache. */
export async function tokenInfo(
  token: string,
): Promise<{ valid: true; scopes: string[]; email: string | null } | { valid: false }> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) return { valid: false };
  const body = (await res.json()) as { scope?: string; email?: string };
  return {
    valid: true,
    scopes: (body.scope ?? "").split(" ").filter(Boolean),
    email: body.email ?? null,
  };
}

/** Revokes the grant at Google: TCP-TRIP loses access until the teacher reconnects. */
export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

export type DriveFile = { id: string; name: string; webViewLink?: string };

/**
 * Uploads a file into the teacher's Drive (`drive.file` only sees files the
 * app created) so Classroom can attach it: the API cannot take raw bytes.
 */
export async function uploadToDrive(token: string, file: File): Promise<DriveFile> {
  const boundary = `tcptrip-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: file.name });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
    await file.arrayBuffer(),
    `\r\n--${boundary}--`,
  ]);

  return googleFetch<DriveFile>(
    token,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
}
