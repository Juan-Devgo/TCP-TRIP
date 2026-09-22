/**
 * The role vocabulary, shared by both halves of the app.
 *
 * It lives in `lib/` because the server and the client each need it and
 * neither may import the other's module: `src/api/auth.ts` pulls in
 * `@clerk/backend` (and the secret key), while the sidebar runs in the browser.
 * One list of role names, used by the server to *decide* and by the client to
 * *hide* — which is the whole split:
 *
 * **The client's copy is cosmetic.** Hiding a sidebar entry is not access
 * control; every role check that matters is the one in `src/api/*.ts`, made
 * against Clerk on the server. A student who types the editor's path gets the
 * page and then a 403 from every call it makes.
 *
 * Roles and their purposes are documented in `docs/users/roles.md`.
 */

export const APP_ROLES = ["student", "teacher", "admin"] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** Everyone who signs up is a student until an admin validates them. */
export const DEFAULT_ROLE: AppRole = "student";

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

/**
 * The role out of Clerk's public metadata — the one place it is stored, on the
 * server as well as here. Anything unexpected reads as `student`, so a typo in
 * the admin panel cannot accidentally grant a capability.
 */
export function roleFromMetadata(metadata: unknown): AppRole {
  if (typeof metadata !== "object" || metadata === null) return DEFAULT_ROLE;

  const role = (metadata as Record<string, unknown>)["role"];
  return isAppRole(role) ? role : DEFAULT_ROLE;
}

/** Authoring theory presentations is the teacher's job, per the role doc. */
export function canAuthorPresentations(role: AppRole): boolean {
  return role === "teacher";
}

/** Approving or rejecting them is the administrator's. */
export function canReviewPresentations(role: AppRole): boolean {
  return role === "admin";
}
