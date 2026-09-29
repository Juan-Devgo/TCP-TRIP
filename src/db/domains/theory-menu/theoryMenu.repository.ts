/**
 * The Theory menu as the API talks to it.
 *
 * This domain is the one place in the app where an administrator edits what
 * *every* user sees, so the rules that matter live here and not in a route:
 *
 * - An entry may only point at a **published** presentation. Assigning an
 *   unapproved draft is refused, and an entry whose presentation is later
 *   withdrawn stops appearing in the reader's menu without anything having to
 *   delete it (the public read joins through `presentation_publications`).
 * - A presentation appears **once**. The unique column makes it impossible to
 *   file the same material under two sections; moving it is an update.
 * - Order is normalised on every move: the rows come back `0…n-1`, so
 *   positions cannot drift into ties after a few reorders.
 *
 * Nothing here is user-scoped — the menu is global. The *right* to call it is
 * the route's job (`adminOnly`), and the admin's id is recorded on every row
 * they create.
 */

import type { Database } from "bun:sqlite";

import { getDb } from "@/db/client";
import { BaseRepository } from "@/db/core/repository";
import { TheoryMenuDao } from "@/db/domains/theory-menu/theoryMenu.dao";
import type {
  AdminMenuRow,
  AssignableRow,
  PublicMenuRow,
  SectionRow,
} from "@/db/domains/theory-menu/theoryMenu.types";
import {
  DEFAULT_THEORY_ICON,
  isTheoryIconName,
  MAX_THEORY_ITEMS_PER_SECTION,
  MAX_THEORY_SECTIONS,
  type AssignablePresentation,
  type MoveDirection,
  type TheoryAdminItem,
  type TheoryAdminSection,
  type TheoryIconName,
  type TheoryMenuItem,
  type TheoryMenuSection,
} from "@/lib/theory/contract";

/** Why a write was refused — each one is a different status to the client. */
export type MenuRefusal =
  | "full"
  | "section-missing"
  | "item-missing"
  | "presentation-missing"
  | "not-published"
  | "already-listed";

export type CreateSectionResult =
  | { ok: true; section: TheoryAdminSection }
  | { ok: false; reason: MenuRefusal };

export type AddItemResult =
  | { ok: true; item: TheoryAdminItem }
  | { ok: false; reason: MenuRefusal };

export type MenuWriteResult = { ok: true } | { ok: false; reason: MenuRefusal };

export class TheoryMenuRepository extends BaseRepository<SectionRow, TheoryAdminSection> {
  private readonly dao: TheoryMenuDao;

  constructor(db: Database = getDb()) {
    super(db);
    this.dao = new TheoryMenuDao(db);
  }

  /**
   * A section on its own, with no entries yet — the shape a freshly created
   * section has. Reading the menu builds its sections from the joined rows
   * instead, because the entries come from the same query.
   */
  protected toEntity(row: SectionRow): TheoryAdminSection {
    return { id: row.id, label: row.label, icon: icon(row.icon), items: [] };
  }

  /* -------------------------------------------------------------- reading */

  /**
   * The menu a reader gets: sections in order, each with the entries whose
   * presentation is approved right now. An empty section is kept — the admin
   * put it there, and the sidebar says it has no items yet.
   */
  menu(): TheoryMenuSection[] {
    const sections = new Map<string, TheoryMenuSection>();

    for (const row of this.dao.publicMenu()) {
      const section = sections.get(row.section_id) ?? {
        id: row.section_id,
        label: row.section_label,
        icon: icon(row.section_icon),
        items: [],
      };
      sections.set(section.id, section);

      const item = publicItem(row);
      if (item) section.items.push(item);
    }

    // Insertion order is the query's `ORDER BY` — a `Map` preserves it.
    return [...sections.values()];
  }

  /** The same menu for the panel that edits it, withdrawn entries included. */
  adminMenu(): TheoryAdminSection[] {
    const sections = new Map<string, TheoryAdminSection>();

    for (const row of this.dao.adminMenu()) {
      const section = sections.get(row.section_id) ?? {
        id: row.section_id,
        label: row.section_label,
        icon: icon(row.section_icon),
        items: [],
      };
      sections.set(section.id, section);

      const item = adminItem(row);
      if (item) section.items.push(item);
    }

    return [...sections.values()];
  }

  /** Published presentations not linked anywhere — the admin's picker. */
  assignable(): AssignablePresentation[] {
    return this.dao.assignable().map(toAssignable);
  }

  /**
   * Whether the presentation already has an entry — even one hidden because it
   * was withdrawn. An approval uses it to decide whether the admin still has to
   * say where the presentation goes: an entry keeps its place across
   * re-approvals.
   */
  isListed(presentationId: string): boolean {
    return this.dao.findItemByPresentation(presentationId) !== null;
  }

  /* ------------------------------------------------------------- sections */

  createSection(
    adminId: string,
    label: string,
    iconName: TheoryIconName,
  ): CreateSectionResult {
    // Counted and inserted in one transaction: two admins adding a section at
    // the same moment must not both read "19".
    const create = this.transaction((): CreateSectionResult => {
      if (this.dao.countSections() >= MAX_THEORY_SECTIONS) {
        return { ok: false, reason: "full" };
      }

      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      this.dao.insertSection({
        id,
        label,
        icon: iconName,
        position: this.dao.nextSectionPosition(),
        createdBy: adminId,
        createdAt: now,
        updatedAt: now,
      });

      return { ok: true, section: { id, label, icon: iconName, items: [] } };
    });

    return create();
  }

  renameSection(id: string, label: string, iconName: TheoryIconName): MenuWriteResult {
    const changed = this.dao.updateSection({
      id,
      label,
      icon: iconName,
      updatedAt: new Date().toISOString(),
    }).changes;

    return changed > 0 ? { ok: true } : { ok: false, reason: "section-missing" };
  }

  /**
   * Deletes a section **and its entries** (the foreign key cascades). The
   * presentations themselves are untouched: they go back to being publishable
   * material with no place in the menu, which is what `assignable()` lists.
   */
  removeSection(id: string): MenuWriteResult {
    return this.dao.deleteSection(id).changes > 0
      ? { ok: true }
      : { ok: false, reason: "section-missing" };
  }

  /** Swaps a section with its neighbour, then renumbers `0…n-1`. */
  moveSection(id: string, direction: MoveDirection): MenuWriteResult {
    const move = this.transaction((): MenuWriteResult => {
      const order = this.dao.sectionOrder();
      const swapped = swap(order.map((row) => row.id), id, direction);
      if (!swapped) return { ok: false, reason: "section-missing" };

      const now = new Date().toISOString();
      swapped.forEach((sectionId, position) => {
        this.dao.setSectionPosition(sectionId, position, now);
      });

      return { ok: true };
    });

    return move();
  }

  /* ---------------------------------------------------------------- items */

  /**
   * Files a published presentation under a section.
   *
   * Every refusal is a different answer to the admin: the section is gone, the
   * presentation was never approved (or has been withdrawn), it is already in
   * the menu, or this section is full.
   */
  addItem(
    adminId: string,
    sectionId: string,
    presentationId: string,
    label: string | null,
  ): AddItemResult {
    const add = this.transaction((): AddItemResult => {
      const section = this.dao.findSection(sectionId);
      if (!section) return { ok: false, reason: "section-missing" };

      const publication = this.dao.findPublication(presentationId);
      if (!publication) return { ok: false, reason: "not-published" };

      if (this.dao.countItems(sectionId) >= MAX_THEORY_ITEMS_PER_SECTION) {
        return { ok: false, reason: "full" };
      }

      const id = crypto.randomUUID();
      try {
        this.dao.insertItem({
          id,
          sectionId,
          presentationId,
          label,
          position: this.dao.nextItemPosition(sectionId),
          createdBy: adminId,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        // The unique column is the real guard against a double file; the read
        // above only lets us answer it as a refusal instead of a 500.
        if (isUniqueViolation(error)) return { ok: false, reason: "already-listed" };
        throw error;
      }

      return {
        ok: true,
        item: {
          id,
          label: label ?? publication.title,
          slug: publication.slug,
          presentationId,
          title: publication.title,
          published: true,
        },
      };
    });

    return add();
  }

  /** `null` restores the author's own title as the label. */
  renameItem(id: string, label: string | null): MenuWriteResult {
    return this.dao.setItemLabel(id, label).changes > 0
      ? { ok: true }
      : { ok: false, reason: "item-missing" };
  }

  /** Moves an entry to another section, appended at its end. */
  reassignItem(id: string, sectionId: string): MenuWriteResult {
    const reassign = this.transaction((): MenuWriteResult => {
      const item = this.dao.findItem(id);
      if (!item) return { ok: false, reason: "item-missing" };

      const section = this.dao.findSection(sectionId);
      if (!section) return { ok: false, reason: "section-missing" };

      if (
        item.section_id !== sectionId &&
        this.dao.countItems(sectionId) >= MAX_THEORY_ITEMS_PER_SECTION
      ) {
        return { ok: false, reason: "full" };
      }

      this.dao.moveItemToSection(id, sectionId, this.dao.nextItemPosition(sectionId));
      return { ok: true };
    });

    return reassign();
  }

  /** Swaps an entry with its neighbour **inside its own section**. */
  moveItem(id: string, direction: MoveDirection): MenuWriteResult {
    const move = this.transaction((): MenuWriteResult => {
      const item = this.dao.findItem(id);
      if (!item) return { ok: false, reason: "item-missing" };

      const order = this.dao.itemOrder(item.section_id);
      const swapped = swap(order.map((row) => row.id), id, direction);
      if (!swapped) return { ok: false, reason: "item-missing" };

      swapped.forEach((itemId, position) => {
        this.dao.setItemPosition(itemId, position);
      });

      return { ok: true };
    });

    return move();
  }

  removeItem(id: string): MenuWriteResult {
    return this.dao.deleteItem(id).changes > 0
      ? { ok: true }
      : { ok: false, reason: "item-missing" };
  }
}

/* ------------------------------------------------------------------ helpers */

/**
 * An unknown stored icon reads as the default rather than breaking the menu.
 *
 * The allowlist can shrink between releases; a section created with an icon
 * that no longer exists must still render.
 */
function icon(value: string): TheoryIconName {
  return isTheoryIconName(value) ? value : DEFAULT_THEORY_ICON;
}

function publicItem(row: PublicMenuRow): TheoryMenuItem | null {
  if (row.item_id === null || row.slug === null) return null;

  return {
    id: row.item_id,
    // The admin's label wins; without one the author's published title does.
    label: row.item_label ?? row.title ?? row.slug,
    slug: row.slug,
  };
}

function adminItem(row: AdminMenuRow): TheoryAdminItem | null {
  if (row.item_id === null || row.presentation_id === null) return null;

  const title = row.published_title ?? row.draft_title ?? "";

  return {
    id: row.item_id,
    label: row.item_label ?? title,
    // No live publication: the entry exists but leads nowhere, and the panel
    // says so instead of offering a broken link.
    slug: row.slug ?? "",
    presentationId: row.presentation_id,
    title,
    published: row.slug !== null,
  };
}

function toAssignable(row: AssignableRow): AssignablePresentation {
  return {
    presentationId: row.presentation_id,
    slug: row.slug,
    title: row.title,
    topic: row.topic,
    authorName: row.author_name,
    publishedAt: row.published_at,
  };
}

/**
 * The list with `id` and its neighbour exchanged, or `null` when the id is
 * unknown or already at that end — a move that cannot happen is not an error,
 * and the caller reports "nothing to do" the same way it reports "no such row".
 */
function swap(ids: string[], id: string, direction: MoveDirection): string[] | null {
  const from = ids.indexOf(id);
  if (from === -1) return null;

  const to = from + direction;
  if (to < 0 || to >= ids.length) return null;

  const reordered = [...ids];
  const moved = reordered[from] as string;
  reordered[from] = reordered[to] as string;
  reordered[to] = moved;
  return reordered;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const code = (error as { code?: unknown }).code;
  return (
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    String((error as { message?: unknown }).message ?? "").includes(
      "UNIQUE constraint failed",
    )
  );
}
