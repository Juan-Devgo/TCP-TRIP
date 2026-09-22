import { useUser } from "@clerk/clerk-react";

import { DEFAULT_ROLE, roleFromMetadata, type AppRole } from "@/lib/auth/roles";

/**
 * The signed-in user's role, as Clerk's public metadata reports it.
 *
 * **For hiding, never for guarding.** The role is granted by hand in the admin
 * panel and enforced on the server (`src/api/auth.ts`); this hook exists so the
 * sidebar does not offer a teacher's editor to a student, not to protect
 * anything. Every request the hidden page would make is checked again server
 * side, where the answer is a 403.
 *
 * While Clerk is still loading, and for a signed-out visitor, the answer is
 * `student` — the least capable role, so nothing flashes into view and then
 * disappears.
 */
export function useAppRole(): { role: AppRole; isLoaded: boolean } {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded || !isSignedIn) return { role: DEFAULT_ROLE, isLoaded };

  return { role: roleFromMetadata(user.publicMetadata), isLoaded };
}
