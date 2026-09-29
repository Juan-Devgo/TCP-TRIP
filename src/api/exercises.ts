import type { BunRequest } from "bun";

import { authorOnly, isRefusal } from "@/api/guards";
import { fail, ok } from "@/api/http";
import { ExerciseSetsRepository, SET_IN_USE } from "@/db/domains/exercise-sets";
import { parseExerciseSetInput } from "@/lib/exercises/sets";

/**
 * Teacher-authored exercise sets (`Crear ejercicios` / `Mis ejercicios`).
 * Every route is teacher-only and scoped to the verified caller: another
 * teacher's set id is the same 404 as an unknown one.
 */

function repository(): ExerciseSetsRepository {
  return new ExerciseSetsRepository();
}

const NOT_FOUND = "Exercise set not found";

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export const exerciseRoutes = {
  "/api/exercises": {
    GET: async (req: BunRequest<"/api/exercises">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;
      return ok(repository().listForUser(caller.userId));
    },

    POST: async (req: BunRequest<"/api/exercises">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;
      const parsed = parseExerciseSetInput(await readJson(req));
      if (!parsed.ok) return fail(400, "Invalid exercise set", parsed.reason);
      return ok(repository().create(caller.userId, parsed.input), { status: 201 });
    },
  },

  "/api/exercises/:id": {
    GET: async (req: BunRequest<"/api/exercises/:id">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;
      const set = repository().findForUser(caller.userId, req.params.id);
      return set ? ok(set) : fail(404, NOT_FOUND);
    },

    PUT: async (req: BunRequest<"/api/exercises/:id">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;
      const parsed = parseExerciseSetInput(await readJson(req));
      if (!parsed.ok) return fail(400, "Invalid exercise set", parsed.reason);
      const result = repository().update(caller.userId, req.params.id, parsed.input);
      if (result === null) return fail(404, NOT_FOUND);
      if (result === SET_IN_USE) {
        return fail(409, "Exercise set already assigned", { code: "exercise_set_used" });
      }
      return ok(result);
    },

    DELETE: async (req: BunRequest<"/api/exercises/:id">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;
      return repository().remove(caller.userId, req.params.id)
        ? ok({ deleted: true })
        : fail(404, NOT_FOUND);
    },
  },

  "/api/exercises/:id/duplicate": {
    POST: async (req: BunRequest<"/api/exercises/:id/duplicate">) => {
      const caller = await authorOnly(req);
      if (isRefusal(caller)) return caller;
      const source = repository().findForUser(caller.userId, req.params.id);
      if (!source) return fail(404, NOT_FOUND);
      const body = (await readJson(req)) as { title?: unknown } | undefined;
      const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : source.title;
      const copy = repository().create(caller.userId, {
        title,
        language: source.language,
        blocks: source.blocks,
      });
      return ok(copy, { status: 201 });
    },
  },
} as const;
