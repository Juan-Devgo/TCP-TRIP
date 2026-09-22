import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";

import { openDatabase } from "@/db/client";
import { PresentationsRepository } from "@/db/domains/presentations";
import { TheoryMenuRepository } from "@/db/domains/theory-menu";
import {
  PRESENTATION_SCHEMA_VERSION,
  type PresentationDocument,
} from "@/lib/presentations/contract";
import { MAX_THEORY_SECTIONS } from "@/lib/theory/contract";

const ANA = "user_ana";
const ADMIN = "user_admin";

function document(title: string): PresentationDocument {
  return {
    version: PRESENTATION_SCHEMA_VERSION,
    title,
    topic: "transport-layer",
    mode: "markdown",
    markdown: `# ${title}`,
    notes: "",
    canvas: { width: 1920, height: 1080 },
    slides: [{ id: "s1", elements: [] }],
  };
}

let db: Database;
let menu: TheoryMenuRepository;
let presentations: PresentationsRepository;

beforeEach(() => {
  db = openDatabase(":memory:");
  menu = new TheoryMenuRepository(db);
  presentations = new PresentationsRepository(db);
});

afterEach(() => {
  db.close();
});

/** A presentation of Ana's, approved — i.e. eligible for the menu. */
function published(title: string) {
  const saved = presentations.save(ANA, document(title));
  if (!saved) throw new Error("fixture: the draft did not save");

  presentations.submit(ANA, saved.id);
  const publication = presentations.approve(ADMIN, saved.id, "Ana Gómez");
  if (!publication) throw new Error("fixture: the approval did not happen");

  return { id: saved.id, slug: publication.slug, title };
}

/** A draft of Ana's that no admin has approved. */
function draft(title: string) {
  const saved = presentations.save(ANA, document(title));
  if (!saved) throw new Error("fixture: the draft did not save");
  return saved;
}

function section(label: string) {
  const created = menu.createSection(ADMIN, label, "layers");
  if (!created.ok) throw new Error(`fixture: the section was refused (${created.reason})`);
  return created.section;
}

describe("sections", () => {
  test("a new menu is empty", () => {
    expect(menu.menu()).toEqual([]);
    expect(menu.adminMenu()).toEqual([]);
  });

  test("a created section appears in both menus, with no items", () => {
    const created = section("Capa de enlace");

    expect(menu.menu()).toEqual([
      { id: created.id, label: "Capa de enlace", icon: "layers", items: [] },
    ]);
    expect(menu.adminMenu()).toHaveLength(1);
  });

  test("sections keep the order they were created in", () => {
    section("Primera");
    section("Segunda");
    section("Tercera");

    expect(menu.menu().map((entry) => entry.label)).toEqual([
      "Primera",
      "Segunda",
      "Tercera",
    ]);
  });

  test("moving a section down swaps it with its neighbour", () => {
    const first = section("Primera");
    section("Segunda");

    expect(menu.moveSection(first.id, 1)).toEqual({ ok: true });
    expect(menu.menu().map((entry) => entry.label)).toEqual(["Segunda", "Primera"]);
  });

  test("moving past the end is refused, and changes nothing", () => {
    const first = section("Primera");
    section("Segunda");

    expect(menu.moveSection(first.id, -1).ok).toBe(false);
    expect(menu.menu().map((entry) => entry.label)).toEqual(["Primera", "Segunda"]);
  });

  test("renaming a section changes its label and icon", () => {
    const created = section("Capa de enlace");

    expect(menu.renameSection(created.id, "Capa de red", "network")).toEqual({ ok: true });

    const [updated] = menu.menu();
    expect(updated?.label).toBe("Capa de red");
    expect(updated?.icon).toBe("network");
  });

  test("renaming an unknown section is refused, not silently ignored", () => {
    expect(menu.renameSection("nope", "Otra", "layers")).toEqual({
      ok: false,
      reason: "section-missing",
    });
  });

  test("the section cap is enforced", () => {
    for (let index = 0; index < MAX_THEORY_SECTIONS; index += 1) {
      section(`Sección ${index}`);
    }

    expect(menu.createSection(ADMIN, "Una más", "layers")).toEqual({
      ok: false,
      reason: "full",
    });
  });

  test("deleting a section takes its items with it, not the presentations", () => {
    const created = section("Capa de transporte");
    const live = published("TCP");
    menu.addItem(ADMIN, created.id, live.id, null);

    expect(menu.removeSection(created.id)).toEqual({ ok: true });
    expect(menu.menu()).toEqual([]);
    // The presentation is still published — it is simply unfiled again.
    expect(menu.assignable().map((entry) => entry.slug)).toEqual([live.slug]);
  });
});

describe("items", () => {
  test("an approved presentation can be filed, and links to its slug", () => {
    const created = section("Capa de transporte");
    const live = published("TCP");

    const added = menu.addItem(ADMIN, created.id, live.id, null);
    expect(added.ok).toBe(true);

    expect(menu.menu()[0]?.items).toEqual([
      { id: added.ok ? added.item.id : "", label: "TCP", slug: live.slug },
    ]);
  });

  test("a label overrides the author's title, and clearing it restores it", () => {
    const created = section("Capa de transporte");
    const live = published("TCP");

    const added = menu.addItem(ADMIN, created.id, live.id, "Transporte fiable");
    if (!added.ok) throw new Error("the item was refused");

    expect(menu.menu()[0]?.items[0]?.label).toBe("Transporte fiable");

    expect(menu.renameItem(added.item.id, null)).toEqual({ ok: true });
    expect(menu.menu()[0]?.items[0]?.label).toBe("TCP");
  });

  test("an unapproved draft cannot be filed", () => {
    const created = section("Capa de transporte");
    const pending = draft("Borrador");

    expect(menu.addItem(ADMIN, created.id, pending.id, null)).toEqual({
      ok: false,
      reason: "not-published",
    });
  });

  test("a presentation cannot be filed twice", () => {
    const first = section("Primera");
    const second = section("Segunda");
    const live = published("TCP");

    expect(menu.addItem(ADMIN, first.id, live.id, null).ok).toBe(true);
    expect(menu.addItem(ADMIN, second.id, live.id, null)).toEqual({
      ok: false,
      reason: "already-listed",
    });
  });

  test("filing under a section that does not exist is refused", () => {
    const live = published("TCP");

    expect(menu.addItem(ADMIN, "nope", live.id, null)).toEqual({
      ok: false,
      reason: "section-missing",
    });
  });

  test("items keep their order, and a move swaps two of them", () => {
    const created = section("Capa de transporte");
    const tcp = published("TCP");
    const udp = published("UDP");

    const first = menu.addItem(ADMIN, created.id, tcp.id, null);
    menu.addItem(ADMIN, created.id, udp.id, null);
    if (!first.ok) throw new Error("the item was refused");

    expect(menu.menu()[0]?.items.map((item) => item.label)).toEqual(["TCP", "UDP"]);

    expect(menu.moveItem(first.item.id, 1)).toEqual({ ok: true });
    expect(menu.menu()[0]?.items.map((item) => item.label)).toEqual(["UDP", "TCP"]);
  });

  test("an item can be reassigned to another section", () => {
    const first = section("Primera");
    const second = section("Segunda");
    const live = published("TCP");

    const added = menu.addItem(ADMIN, first.id, live.id, null);
    if (!added.ok) throw new Error("the item was refused");

    expect(menu.reassignItem(added.item.id, second.id)).toEqual({ ok: true });

    const sections = menu.menu();
    expect(sections[0]?.items).toEqual([]);
    expect(sections[1]?.items.map((item) => item.label)).toEqual(["TCP"]);
  });

  test("deleting an item leaves the section and the presentation alone", () => {
    const created = section("Capa de transporte");
    const live = published("TCP");

    const added = menu.addItem(ADMIN, created.id, live.id, null);
    if (!added.ok) throw new Error("the item was refused");

    expect(menu.removeItem(added.item.id)).toEqual({ ok: true });
    expect(menu.menu()[0]?.items).toEqual([]);
    expect(menu.assignable().map((entry) => entry.slug)).toEqual([live.slug]);
  });
});

describe("the menu follows the review", () => {
  test("withdrawing a presentation hides its item but keeps the section", () => {
    const created = section("Capa de transporte");
    const live = published("TCP");
    menu.addItem(ADMIN, created.id, live.id, null);

    presentations.withdraw(ANA, live.id);

    expect(menu.menu()).toEqual([
      { id: created.id, label: "Capa de transporte", icon: "layers", items: [] },
    ]);

    // The admin still sees the entry — and that it leads nowhere.
    const [adminSection] = menu.adminMenu();
    expect(adminSection?.items[0]?.published).toBe(false);
    expect(adminSection?.items[0]?.slug).toBe("");
  });

  test("re-approving brings the same item back, at its new slug", () => {
    const created = section("Capa de transporte");
    const live = published("TCP");
    const added = menu.addItem(ADMIN, created.id, live.id, "Transporte fiable");
    if (!added.ok) throw new Error("the item was refused");

    presentations.withdraw(ANA, live.id);
    presentations.submit(ANA, live.id);
    const republished = presentations.approve(ADMIN, live.id, "Ana Gómez");

    // Withdrawing deletes the publication, so approving again mints a fresh
    // slug. The menu entry survives it because it points at the presentation
    // and resolves the slug on read — which is the whole reason it does.
    expect(republished?.slug).not.toBe(live.slug);
    expect(menu.menu()[0]?.items).toEqual([
      { id: added.item.id, label: "Transporte fiable", slug: republished?.slug ?? "" },
    ]);
  });

  test("deleting the presentation deletes the item it was filed as", () => {
    const created = section("Capa de transporte");
    const live = published("TCP");
    menu.addItem(ADMIN, created.id, live.id, null);

    presentations.remove(ANA, live.id);

    expect(menu.adminMenu()[0]?.items).toEqual([]);
  });

  test("only unfiled presentations are offered to the admin", () => {
    const created = section("Capa de transporte");
    const tcp = published("TCP");
    published("UDP");

    menu.addItem(ADMIN, created.id, tcp.id, null);

    expect(menu.assignable().map((entry) => entry.title)).toEqual(["UDP"]);
  });
});
