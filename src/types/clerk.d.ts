/**
 * `ClerkProvider` puts the Clerk instance on `window`, which is how a plain
 * module — `src/services/protocols.ts` is not a component and cannot call
 * `useAuth()` — gets a session token for the `Authorization` header.
 *
 * Only the sliver actually used is declared: everything is optional, because
 * Clerk is still loading during the first paint and the session is absent while
 * signed out.
 */
interface Window {
  Clerk?: {
    session?: {
      getToken(): Promise<string | null>;
    } | null;
  };
}

/**
 * Custom claims Clerk puts in the session token, which `@clerk/backend` hands
 * back as `sessionClaims` (`src/api/auth.ts`).
 *
 * They arrive because the Clerk Dashboard is configured to copy the user's
 * public metadata into the token — **Sessions → Customize session token**:
 *
 * ```json
 * { "metadata": "{{user.public_metadata}}" }
 * ```
 *
 * That is what lets the server know the caller's role from the verified token
 * alone, with no call to Clerk's API per request. The claim is *not* trusted
 * for its shape: `roleFromMetadata` validates whatever turns up, so an
 * unconfigured dashboard or a stale token reads as `student` and the server
 * falls back to reading the user.
 *
 * The role names are declared in `src/lib/auth/roles.ts`; they are repeated
 * here because a `.d.ts` with an import stops being a global declaration file.
 */
interface CustomJwtSessionClaims {
  metadata?: {
    role?: "student" | "teacher" | "admin";
  };
}
