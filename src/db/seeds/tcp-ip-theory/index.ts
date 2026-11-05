import type { Database } from "bun:sqlite";

import { getDb } from "@/db/client";
import { PresentationsRepository } from "@/db/domains/presentations";
import { TheoryMenuRepository } from "@/db/domains/theory-menu";
import {
  parsePresentationDocument,
  type PresentationDocument,
} from "@/lib/presentations/contract";
import type { TheoryIconName, TheoryPlacement } from "@/lib/theory/contract";

import { applicationDocument } from "./application";
import { internetDocument } from "./internet";
import { linkDocument } from "./link";
import { overviewDocument } from "./overview";
import { transportDocument } from "./transport";

/**
 * The base theory of the course: the TCP/IP model and each of its four layers,
 * as five presentations (a reading in markdown plus a slide deck each).
 *
 * It goes into the database **the way a teacher's work does**, not by writing
 * rows: the teacher's draft is saved and submitted, and an administrator
 * approves it into the Theory menu. So the content passes the same contract
 * gate, gets a real slug, a frozen publication, its speaker notes and a review
 * trail — nothing a reader or the admin panel sees tells it apart from a
 * presentation authored in the editor.
 */

export const TCP_IP_SECTION: { label: string; icon: TheoryIconName } = {
  label: "Modelo TCP/IP",
  icon: "layers",
};

/** Course order: the model first, then the layers from the wire upwards. */
export function tcpIpTheoryDocuments(): PresentationDocument[] {
  return [
    overviewDocument(),
    linkDocument(),
    internetDocument(),
    transportDocument(),
    applicationDocument(),
  ];
}

export type SeedOptions = {
  /** Clerk id of the teacher the presentations belong to. */
  teacherId: string;
  /** Clerk id of the administrator recorded as approving them. */
  adminId: string;
  /** The byline students read, as the approval route would take it from Clerk. */
  authorName: string;
};

export type SeedReport = {
  created: string[];
  /** Titles the teacher already had — the seed never duplicates a deck. */
  skipped: string[];
  sectionId: string | null;
};

export function seedTcpIpTheory(options: SeedOptions, db: Database = getDb()): SeedReport {
  const presentations = new PresentationsRepository(db);
  const menu = new TheoryMenuRepository(db);

  const run = db.transaction((): SeedReport => {
    const report: SeedReport = { created: [], skipped: [], sectionId: null };
    const owned = new Set(presentations.listForUser(options.teacherId).map((p) => p.title));
    let createdSection = false;

    for (const candidate of tcpIpTheoryDocuments()) {
      // The same gate the route puts every stored document through.
      const parsed = parsePresentationDocument(candidate);
      if (!parsed.ok) {
        throw new Error(
          `"${candidate.title}" is not a valid presentation (${parsed.issue}${parsed.at ? ` at ${parsed.at}` : ""})`,
        );
      }
      const document = parsed.document;

      if (owned.has(document.title)) {
        report.skipped.push(document.title);
        continue;
      }

      const draft = presentations.save(options.teacherId, document);
      if (!draft) throw new Error(`"${document.title}" did not save`);
      if (!presentations.submit(options.teacherId, draft.id)) {
        throw new Error(`"${document.title}" could not be submitted`);
      }

      const section = menu.adminMenu().find((entry) => entry.label === TCP_IP_SECTION.label);
      const placement: TheoryPlacement = section
        ? { sectionId: section.id }
        : { section: TCP_IP_SECTION };
      createdSection ||= section === undefined;

      const approved = presentations.approveIntoMenu(
        options.adminId,
        draft.id,
        options.authorName,
        null,
        placement,
      );
      if (!approved.ok) {
        throw new Error(`"${document.title}" could not be approved: ${approved.reason}`);
      }

      report.created.push(document.title);
    }

    const section = menu.adminMenu().find((entry) => entry.label === TCP_IP_SECTION.label);
    report.sectionId = section?.id ?? null;

    // A section created here is the foundation of the course: it goes to the
    // top of the menu. One that already existed keeps the place an admin gave it.
    if (section && createdSection) {
      while (menu.adminMenu()[0]?.id !== section.id) {
        if (!menu.moveSection(section.id, -1).ok) break;
      }
    }

    return report;
  });

  return run();
}
