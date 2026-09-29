/**
 * The shared half of every API client under `src/services/`: the error the UI
 * branches on, and the `fetch` wrapper that speaks the server's envelope.
 *
 * It exists because there is now more than one client (presentations, the
 * Theory menu) and they must fail the same way — a component that knows how to
 * show a 403 should not have to know *which* API produced it.
 *
 * Ownership and role are never sent from here: the request carries a Clerk
 * session token and the server resolves both from it.
 */

/**
 * A failed API call, carrying the HTTP status so the UI can tell the cases
 * apart — 401 asks the user to sign in, 403 means the role is missing, 404
 * means it is gone, 409 that the state moved under the caller.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** `error.details` as the server sent it, when it sent any. */
    readonly details: unknown = undefined,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /**
   * `error.details.code` — the machine-readable reason some routes add on top
   * of the status (`google_reauth`, `exercise_set_used`), or `null`.
   */
  get code(): string | null {
    const details = this.details;
    return typeof details === "object" && details !== null && "code" in details
      ? String((details as { code: unknown }).code)
      : null;
  }

  /** The user is signed out (or the session expired mid-session). */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** Signed in, but not a teacher (or not an admin) — a different message. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Already submitted, already decided, already listed. */
  get isConflict(): boolean {
    return this.status === 409;
  }
}

/**
 * `ClerkProvider` mounts the instance on `window`, which is how a plain module
 * reaches the session. A same-origin cookie would also authenticate the
 * request, but the header is deterministic and needs no handshake.
 */
export async function authHeaders(): Promise<HeadersInit> {
  const token = await window.Clerk?.session?.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      // A `FormData` body sets its own multipart boundary — declaring JSON over
      // it would make the upload unparseable on the server.
      ...(init.body === undefined || init.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(await authHeaders()),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string; details?: unknown };
    } | null;
    throw new ApiError(
      response.status,
      body?.error?.message ?? `Request failed with ${response.status}`,
      body?.error?.details,
    );
  }

  return (await response.json()) as T;
}

/**
 * The query cache's retry policy: a 4xx will be answered the same way again,
 * so only a server or network failure is worth a second try.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 2;
}
