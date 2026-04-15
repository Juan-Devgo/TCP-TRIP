// reconcileRoleRequests — checks role_requests with status 'pending' against Clerk.
// Called at app startup. Full implementation in V2.0 (E-007).
export async function reconcileRoleRequests(): Promise<void> {
  // TODO V2.0: Query role_requests WHERE status = 'pending', verify against Clerk publicMetadata.
  // If Clerk shows role = 'teacher' but DB shows 'pending', update DB to 'approved'.
}
