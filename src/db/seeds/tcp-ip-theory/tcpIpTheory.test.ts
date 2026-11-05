import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";

import { openDatabase } from "@/db/client";
import { PresentationsRepository } from "@/db/domains/presentations";
import { TheoryMenuRepository } from "@/db/domains/theory-menu";
import {
  isWithinPresentationLimit,
  parsePresentationDocument,
} from "@/lib/presentations/contract";

import { TCP_IP_SECTION, seedTcpIpTheory, tcpIpTheoryDocuments } from ".";

const TEACHER = "user_teacher";
const ADMIN = "user_admin";
const OPTIONS = { teacherId: TEACHER, adminId: ADMIN, authorName: "Docente de Redes" };

describe("the TCP/IP theory documents", () => {
  const documents = tcpIpTheoryDocuments();

  test("cover the model and each of the four layers", () => {
    expect(documents.map((document) => document.topic)).toEqual([
      "tcp-ip-model",
      "link-layer",
      "internet-layer",
      "transport-layer",
      "application-layer",
    ]);
  });

  test.each(documents.map((document) => [document.title, document] as const))(
    "%s passes the contract gate with a reading and slides",
    (_title, document) => {
      const parsed = parsePresentationDocument(document);
      expect(parsed).toMatchObject({ ok: true });
      expect(isWithinPresentationLimit(JSON.stringify(document))).toBe(true);

      expect(document.markdown.length).toBeGreaterThan(2_000);
      expect(document.slides.length).toBeGreaterThanOrEqual(8);
      for (const slide of document.slides) {
        expect(slide.title).toBeTruthy();
        expect(slide.notes).toBeTruthy();
        expect(slide.elements.length).toBeGreaterThan(0);
      }
    },
  );
});

describe("seedTcpIpTheory", () => {
  let db: Database;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  test("publishes every deck through the review flow, filed in one section at the top", () => {
    const menu = new TheoryMenuRepository(db);
    menu.createSection(ADMIN, "Existente", "book-open");

    const report = seedTcpIpTheory(OPTIONS, db);
    expect(report.created).toHaveLength(5);
    expect(report.skipped).toEqual([]);

    const sections = menu.adminMenu();
    expect(sections[0]?.label).toBe(TCP_IP_SECTION.label);
    expect(sections[0]?.items.map((item) => item.title)).toEqual(
      tcpIpTheoryDocuments().map((document) => document.title),
    );

    const presentations = new PresentationsRepository(db);
    const drafts = presentations.listForUser(TEACHER);
    expect(drafts.every((draft) => draft.status === "published")).toBe(true);
    for (const draft of drafts) {
      expect(presentations.reviews(draft.id).map((review) => review.action).sort()).toEqual([
        "approve",
        "submit",
      ]);

      // Students get the deck without the teacher's notes; the author keeps them.
      const published = presentations.findPublishedBySlug(draft.publishedSlug ?? "");
      expect(published?.authorName).toBe(OPTIONS.authorName);
      expect(published?.document.notes).toBe("");
      expect(published?.document.slides.every((slide) => slide.notes === undefined)).toBe(true);
      expect(Object.keys(presentations.findSpeakerNotes(TEACHER, draft.publishedSlug ?? "") ?? {})).toHaveLength(
        draft.document.slides.length,
      );
    }
  });

  test("running it twice changes nothing", () => {
    seedTcpIpTheory(OPTIONS, db);
    const again = seedTcpIpTheory(OPTIONS, db);

    expect(again.created).toEqual([]);
    expect(again.skipped).toHaveLength(5);
    expect(new PresentationsRepository(db).listForUser(TEACHER)).toHaveLength(5);
    expect(new TheoryMenuRepository(db).adminMenu()).toHaveLength(1);
  });
});
