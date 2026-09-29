/**
 * Who is calling, decided on the server.
 *
 * Ownership in this app is a Clerk user id, and the **only** trustworthy source
 * of it is a verified token. A route asks `requireUserId`; it never reads an id
 * from a body, a query string or a header the client chose to send.
 *
 * `CLERK_SECRET_KEY` has no `PUBLIC_` prefix on purpose: Bun inlines exactly the
 * `PUBLIC_*` literals into the client bundle (`bunfig.toml`, `build.ts`), so the
 * secret cannot leak into it by accident.
 */

import { createClerkClient } from "@clerk/backend";

import { DEFAULT_ROLE, isAppRole, type AppRole } from "@/lib/auth/roles";

let client: ReturnType<typeof createClerkClient> | null = null;

export function getClerk() {
  if (client) return client;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("Missing CLERK_SECRET_KEY in .env");

  // The publishable key lets Clerk read the same-origin session cookie as well
  // as the `Authorization: Bearer` header the SPA sends.
  const publishableKey = process.env.PUBLIC_CLERK_PUBLISHABLE_KEY;

  client = createClerkClient(
    publishableKey ? { secretKey, publishableKey } : { secretKey },
  );
  return client;
}

/**
 * Who the request is, straight out of the verified token: the Clerk user id and
 * the role its claims carry (`null` when the token has no role claim).
 */
type Verified = {
  userId: string;
  /** `null` = the token said nothing about the role; ask Clerk instead. */
  claimedRole: AppRole | null;
};

async function verify(req: Request): Promise<Verified | null> {
  // `isAuthenticated`, not the deprecated `isSignedIn`: it is the discriminant
  // of the modern `AuthenticatedState | UnauthenticatedState` union, so after
  // this guard `toAuth()` is typed as a signed-in auth object with a `userId`.
  const state = await getClerk().authenticateRequest(req);
  if (!state.isAuthenticated) return null;

  const auth = state.toAuth();

  return {
    userId: auth.userId,
    // The claim is validated, never trusted for its shape: an unconfigured
    // dashboard, an old token or a typo in the metadata all read as "nothing
    // useful here", and `requireCaller` falls back to reading the user.
    claimedRole: claimedRole(auth.sessionClaims["metadata"]),
  };
}

/**
 * The role a session token declares, or `null` when it declares none.
 *
 * `student` in the claim is a real answer and is kept; an *absent* role is
 * what makes this `null`, so the fallback read only happens when the token
 * genuinely has nothing to say.
 */
function claimedRole(metadata: unknown): AppRole | null {
  if (typeof metadata !== "object" || metadata === null) return null;

  const role = (metadata as Record<string, unknown>)["role"];
  return isAppRole(role) ? role : null;
}

/**
 * The verified Clerk user id, or `null` when the request carries no valid
 * session. Callers answer a `null` with 401 — there is no fallback identity.
 */
export async function requireUserId(req: Request): Promise<string | null> {
  return (await verify(req))?.userId ?? null;
}

/**
 * The verified user id, or the empty string when the request carries no
 * session — for the reads that are public but answer *more* to the owner (an
 * image belonging to an unpublished draft). The empty string matches no Clerk
 * id, so it can be handed straight to a query.
 */
export async function optionalUserId(req: Request): Promise<string> {
  return (await requireUserId(req)) ?? "";
}

/* ------------------------------------------------------------------- roles */

/**
 * The role names themselves live in `@/lib/auth/roles` because the browser half
 * of the app needs them too (to hide a sidebar entry). **This file is where
 * they are decided**: the client's copy only hides things.
 */
export type { AppRole };

/** Who is calling and what they are allowed to be. */
export type Caller = {
  userId: string;
  role: AppRole;
};

/**
 * Role and display name both live in Clerk's **public metadata** — the single
 * source of truth for both, writable only from the dashboard or the Backend
 * API, so nothing the client sends can affect either.
 *
 * The role normally arrives **inside the verified session token** (see
 * `CustomJwtSessionClaims` in `src/types/clerk.d.ts`), which costs no API call
 * at all. This cache is the fallback: it serves the display name, and the role
 * for a token minted before the claim was configured.
 *
 * A cached answer lives for a minute. The consequence is deliberate and small:
 * on the fallback path a role just granted takes up to `PROFILE_TTL_MS` to take
 * effect, and on the token path it takes effect when the token next refreshes
 * (about a minute, or immediately after a reload). A revoked *session* is not
 * affected either way — `authenticateRequest` verifies that on every request.
 */
const PROFILE_TTL_MS = 60_000;

type Profile = {
  role: AppRole;
  displayName: string;
  readAt: number;
};

const profiles = new Map<string, Profile>();

async function getProfile(userId: string): Promise<Profile> {
  const cached = profiles.get(userId);
  if (cached && Date.now() - cached.readAt < PROFILE_TTL_MS) return cached;

  const user = await getClerk().users.getUser(userId);
  const role = user.publicMetadata?.["role"];

  const profile: Profile = {
    role: isAppRole(role) ? role : DEFAULT_ROLE,
    displayName:
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "—",
    readAt: Date.now(),
  };

  profiles.set(userId, profile);
  return profile;
}

/**
 * The verified caller with their role, or `null` for a 401. Use this instead of
 * `requireUserId` whenever the route is gated on being a teacher or an admin.
 */
export async function requireCaller(req: Request): Promise<Caller | null> {
  const verified = await verify(req);
  if (!verified) return null;

  // The token already said it: no network call, and no cache to go stale.
  if (verified.claimedRole) {
    return { userId: verified.userId, role: verified.claimedRole };
  }

  const { role } = await getProfile(verified.userId);
  return { userId: verified.userId, role };
}

/**
 * The caller **only if** they hold one of the given roles, otherwise `null` —
 * so a route reads as one guard and cannot accidentally continue with a
 * student's id. It does not distinguish "signed out" from "not allowed"; the
 * route decides whether that is a 401 or a 403 by asking `requireCaller`
 * first when the difference matters to the UI.
 */
export async function requireRole(
  req: Request,
  ...roles: readonly AppRole[]
): Promise<Caller | null> {
  const caller = await requireCaller(req);
  if (!caller) return null;

  return roles.includes(caller.role) ? caller : null;
}

/**
 * The name a published presentation is bylined with, resolved server-side at
 * approval time. A client-supplied author would be a forgeable author.
 */
export async function getDisplayName(userId: string): Promise<string> {
  return (await getProfile(userId)).displayName;
}

/** Drops a cached role — called when an admin changes someone's role. */
export function forgetProfile(userId: string): void {
  profiles.delete(userId);
}
