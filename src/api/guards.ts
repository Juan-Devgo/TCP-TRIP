/**
 * The role guards, in one place because more than one route module needs them.
 *
 * Each returns **either** the verified caller or the `Response` that refuses
 * them, so a handler is one line and cannot accidentally carry on with a
 * student's id:
 *
 * ```ts
 * const caller = await adminOnly(req);
 * if (isRefusal(caller)) return caller;
 * ```
 *
 * 401 and 403 are told apart on purpose: the first means "sign in", the second
 * means "ask an administrator to validate you", and the UI says different
 * things for each.
 */

import { requireCaller, type Caller } from "@/api/auth";
import { fail } from "@/api/http";

const UNAUTHENTICATED = "Sign in to continue";
const TEACHER_ONLY = "Only a verified teacher can author content";
const ADMIN_ONLY = "Only an administrator can do this";

/** The caller if they may author content (a teacher), or the refusal. */
export async function authorOnly(req: Request): Promise<Caller | Response> {
  const caller = await requireCaller(req);
  if (!caller) return fail(401, UNAUTHENTICATED);
  if (caller.role !== "teacher") return fail(403, TEACHER_ONLY);

  return caller;
}

/** The caller if they are an administrator, or the refusal. */
export async function adminOnly(req: Request): Promise<Caller | Response> {
  const caller = await requireCaller(req);
  if (!caller) return fail(401, UNAUTHENTICATED);
  if (caller.role !== "admin") return fail(403, ADMIN_ONLY);

  return caller;
}

/** Narrows a guard's answer. A `Response` is the refusal, anything else is the caller. */
export function isRefusal(value: Caller | Response): value is Response {
  return value instanceof Response;
}
