/**
 * The Theory menu API: one public read, and the administrator's editing of it.
 *
 * The sidebar's Theory section is built by an admin rather than hardcoded, so
 * these routes are what turn an approved presentation into navigation. Two
 * levels of access and nothing in between:
 *
 * - **Public** — `GET /api/theory/menu`. The menu is navigation for educational
 *   content: no session required, and the answer carries no presentation ids,
 *   no author ids and no entries whose presentation is not currently approved.
 * - **Admin** — everything under `/api/admin/theory/`. These change what every
 *   user of the app sees, which is why the rows record who created them.
 *
 * Messages are English and for the developer; the client turns the status into
 * translated copy.
 */

import type { BunRequest } from "bun";

import { adminOnly, isRefusal } from "@/api/guards";
import { fail, ok } from "@/api/http";
import { TheoryMenuRepository, type MenuRefusal } from "@/db/domains/theory-menu";
import {
  isMoveDirection,
  isTheoryIconName,
  MAX_THEORY_ITEM_LABEL_LENGTH,
  MAX_THEORY_SECTION_LABEL_LENGTH,
  normalizeLabel,
  THEORY_ICON_NAMES,
  type MoveDirection,
  type TheoryIconName,
} from "@/lib/theory/contract";

function repository(): TheoryMenuRepository {
  return new TheoryMenuRepository();
}

/**
 * A refusal as HTTP. "It is not there" is a 404; "it is there but this cannot
 * happen to it" is a 409 — the client shows a different message for each, and
 * neither is a retry.
 */
function refuse(reason: MenuRefusal): Response {
  switch (reason) {
    case "section-missing":
      return fail(404, "Theory section not found");
    case "item-missing":
      return fail(404, "Menu entry not found");
    case "presentation-missing":
      return fail(404, "Presentation not found");
    case "not-published":
      return fail(409, "Only an approved presentation can be added to the menu");
    case "already-listed":
      return fail(409, "That presentation is already in the menu");
    case "full":
      return fail(409, "The menu cannot hold any more entries here");
  }
}

/** The body, or `null` when it was not JSON at all. */
async function body(req: Request): Promise<Record<string, unknown> | null> {
  const payload = (await req.json().catch(() => null)) as unknown;
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : null;
}

type SectionInput = { label: string; icon: TheoryIconName };

/**
 * A section's label and icon out of a body, or the response refusing it.
 *
 * The icon is checked against the allowlist here: it is rendered as a component
 * on the client, so an unknown name is a bad request and never a stored value.
 */
function readSection(payload: Record<string, unknown> | null): SectionInput | Response {
  const label = normalizeLabel(payload?.["label"], MAX_THEORY_SECTION_LABEL_LENGTH);
  if (label === null) {
    return fail(400, "`label` is required", { maxLength: MAX_THEORY_SECTION_LABEL_LENGTH });
  }

  const icon = payload?.["icon"];
  if (!isTheoryIconName(icon)) {
    return fail(400, "Unknown icon", { allowed: THEORY_ICON_NAMES });
  }

  return { label, icon };
}

/**
 * An entry's label: a trimmed string, or `null` for "keep the author's title".
 * An absent field and an empty one both mean the same thing, which is what a
 * cleared text input sends.
 */
function readItemLabel(value: unknown): string | null | Response {
  if (value === undefined || value === null || value === "") return null;

  const label = normalizeLabel(value, MAX_THEORY_ITEM_LABEL_LENGTH);
  return label === null
    ? fail(400, "`label` is too long", { maxLength: MAX_THEORY_ITEM_LABEL_LENGTH })
    : label;
}

function readMove(value: unknown): MoveDirection | Response {
  return isMoveDirection(value) ? value : fail(400, "`move` must be -1 or 1");
}

export const theoryRoutes = {
  /**
   * The Theory navigation, as every reader gets it. Public, cached by nothing:
   * an approval has to show up in the sidebar immediately.
   */
  "/api/theory/menu": {
    GET: () => ok(repository().menu()),
  },

  /* ------------------------------------------------------------ admin */

  /**
   * Everything the panel needs in one request: the menu as it stands, and the
   * approved presentations that are not in it yet.
   */
  "/api/admin/theory/menu": {
    GET: async (req: BunRequest<"/api/admin/theory/menu">) => {
      const caller = await adminOnly(req);
      if (isRefusal(caller)) return caller;

      const menu = repository();
      return ok({ sections: menu.adminMenu(), assignable: menu.assignable() });
    },
  },

  "/api/admin/theory/sections": {
    POST: async (req: BunRequest<"/api/admin/theory/sections">) => {
      const caller = await adminOnly(req);
      if (isRefusal(caller)) return caller;

      const input = readSection(await body(req));
      if (input instanceof Response) return input;

      const created = repository().createSection(caller.userId, input.label, input.icon);
      return created.ok ? ok(created.section) : refuse(created.reason);
    },
  },

  "/api/admin/theory/sections/:id": {
    /**
     * Renames a section, changes its icon, or moves it — `move` and the
     * label/icon pair are separate requests, because they are separate
     * gestures in the panel.
     */
    PATCH: async (req: BunRequest<"/api/admin/theory/sections/:id">) => {
      const caller = await adminOnly(req);
      if (isRefusal(caller)) return caller;

      const payload = await body(req);
      const menu = repository();

      if (payload && "move" in payload) {
        const move = readMove(payload["move"]);
        if (move instanceof Response) return move;

        const moved = menu.moveSection(req.params.id, move);
        return moved.ok ? ok({ moved: true }) : refuse(moved.reason);
      }

      const input = readSection(payload);
      if (input instanceof Response) return input;

      const renamed = menu.renameSection(req.params.id, input.label, input.icon);
      return renamed.ok
        ? ok({ id: req.params.id, label: input.label, icon: input.icon })
        : refuse(renamed.reason);
    },

    DELETE: async (req: BunRequest<"/api/admin/theory/sections/:id">) => {
      const caller = await adminOnly(req);
      if (isRefusal(caller)) return caller;

      const removed = repository().removeSection(req.params.id);
      return removed.ok ? ok({ deleted: true }) : refuse(removed.reason);
    },
  },

  /** Files a published presentation under a section. */
  "/api/admin/theory/sections/:id/items": {
    POST: async (req: BunRequest<"/api/admin/theory/sections/:id/items">) => {
      const caller = await adminOnly(req);
      if (isRefusal(caller)) return caller;

      const payload = await body(req);
      const presentationId = payload?.["presentationId"];
      if (typeof presentationId !== "string" || presentationId === "") {
        return fail(400, "`presentationId` is required");
      }

      const label = readItemLabel(payload?.["label"]);
      if (label instanceof Response) return label;

      const added = repository().addItem(
        caller.userId,
        req.params.id,
        presentationId,
        label,
      );

      return added.ok ? ok(added.item) : refuse(added.reason);
    },
  },

  "/api/admin/theory/items/:id": {
    /** Renames an entry, moves it inside its section, or to another one. */
    PATCH: async (req: BunRequest<"/api/admin/theory/items/:id">) => {
      const caller = await adminOnly(req);
      if (isRefusal(caller)) return caller;

      const payload = await body(req);
      const menu = repository();

      if (payload && "move" in payload) {
        const move = readMove(payload["move"]);
        if (move instanceof Response) return move;

        const moved = menu.moveItem(req.params.id, move);
        return moved.ok ? ok({ moved: true }) : refuse(moved.reason);
      }

      if (payload && "sectionId" in payload) {
        const sectionId = payload["sectionId"];
        if (typeof sectionId !== "string" || sectionId === "") {
          return fail(400, "`sectionId` must be a section id");
        }

        const reassigned = menu.reassignItem(req.params.id, sectionId);
        return reassigned.ok ? ok({ moved: true }) : refuse(reassigned.reason);
      }

      const label = readItemLabel(payload?.["label"]);
      if (label instanceof Response) return label;

      const renamed = menu.renameItem(req.params.id, label);
      return renamed.ok ? ok({ id: req.params.id, label }) : refuse(renamed.reason);
    },

    DELETE: async (req: BunRequest<"/api/admin/theory/items/:id">) => {
      const caller = await adminOnly(req);
      if (isRefusal(caller)) return caller;

      const removed = repository().removeItem(req.params.id);
      return removed.ok ? ok({ deleted: true }) : refuse(removed.reason);
    },
  },
} as const;
