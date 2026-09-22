import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";

import { openDatabase } from "@/db/client";
import { PresentationsRepository } from "@/db/domains/presentations";
import {
  MAX_ASSETS_PER_PRESENTATION,
  PRESENTATION_SCHEMA_VERSION,
  type PresentationDocument,
} from "@/lib/presentations/contract";

/** Three Clerk ids: two authors, because ownership is half of what is tested. */
const ANA = "user_ana";
const BRUNO = "user_bruno";
const ADMIN = "user_admin";
const STUDENT = "user_student";

function document(overrides: Partial<PresentationDocument> = {}): PresentationDocument {
  return {
    version: PRESENTATION_SCHEMA_VERSION,
    title: "Capa de transporte",
    topic: "transport-layer",
    mode: "slides",
    markdown: "# Capa de transporte\n\nTCP y UDP.",
    notes: "Recordar el ejemplo del handshake.",
    canvas: { width: 1920, height: 1080 },
    slides: [
      {
        id: "s1",
        title: "Portada",
        notes: "Saludar y preguntar qué recuerdan de la capa de red.",
        elements: [
          {
            id: "e1",
            type: "text",
            x: 160,
            y: 420,
            width: 1600,
            height: 240,
            rotation: 0,
            props: {
              text: "Capa de transporte",
              size: 96,
              weight: 700,
              align: "center",
              color: "foreground",
            },
          },
        ],
      },
      { id: "s2", elements: [] },
    ],
    ...overrides,
  };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);

let db: Database;
let presentations: PresentationsRepository;

beforeEach(() => {
  // An isolated database per test — never the singleton.
  db = openDatabase(":memory:");
  presentations = new PresentationsRepository(db);
});

afterEach(() => {
  // Not `close(true)`: the statements `db.query` caches are still alive, and
  // the strict close reads that as a locked database.
  db.close();
});

/** A saved draft of Ana's, which almost every test starts from. */
function draft(overrides: Partial<PresentationDocument> = {}) {
  const saved = presentations.save(ANA, document(overrides));
  if (!saved) throw new Error("fixture: the draft did not save");
  return saved;
}

/** A draft of Ana's, submitted and approved — i.e. live on Theory. */
function published(overrides: Partial<PresentationDocument> = {}) {
  const saved = draft(overrides);
  presentations.submit(ANA, saved.id);
  const publication = presentations.approve(ADMIN, saved.id, "Ana Pérez");
  if (!publication) throw new Error("fixture: the approval did not happen");
  return { saved, publication };
}

describe("drafts", () => {
  test("a new presentation starts as a draft and nothing is published", () => {
    const saved = draft();

    expect(saved.status).toBe("draft");
    expect(saved.publishedSlug).toBeNull();
    expect(saved.submittedAt).toBeNull();
    expect(saved.document.slides).toHaveLength(2);
  });

  test("columns are kept in step with the document", () => {
    const saved = draft({ title: "Capa de enlace", topic: "link-layer", mode: "markdown" });

    const row = db
      .query<{ title: string; topic: string; mode: string }, []>(
        "SELECT title, topic, mode FROM presentations",
      )
      .get();

    expect(row).toEqual({ title: "Capa de enlace", topic: "link-layer", mode: "markdown" });
    expect(saved.title).toBe("Capa de enlace");
  });

  test("another author's id matches nothing", () => {
    const saved = draft();

    expect(presentations.findForUser(BRUNO, saved.id)).toBeNull();
    expect(presentations.save(BRUNO, document(), saved.id)).toBeNull();
    expect(presentations.remove(BRUNO, saved.id)).toBe(false);
    expect(presentations.listForUser(BRUNO)).toHaveLength(0);
  });

  test("saving does not change the review status", () => {
    const saved = draft();
    presentations.submit(ANA, saved.id);

    const edited = presentations.save(ANA, document({ title: "Otro título" }), saved.id);

    // An autosave must not quietly pull a submission out of the queue.
    expect(edited?.status).toBe("pending");
  });
});

describe("submission", () => {
  test("submitting queues the draft and logs it", () => {
    const saved = draft();

    const submitted = presentations.submit(ANA, saved.id);

    expect(submitted?.status).toBe("pending");
    expect(submitted?.submittedAt).not.toBeNull();
    expect(presentations.reviews(saved.id).map((entry) => entry.action)).toEqual(["submit"]);
  });

  test("submitting twice is refused, so a place in the queue is not lost", () => {
    const saved = draft();
    const first = presentations.submit(ANA, saved.id);

    expect(presentations.submit(ANA, saved.id)).toBeNull();
    expect(presentations.findForUser(ANA, saved.id)?.submittedAt).toBe(
      first?.submittedAt ?? null,
    );
  });

  test("only the owner can submit", () => {
    const saved = draft();

    expect(presentations.submit(BRUNO, saved.id)).toBeNull();
    expect(presentations.findForUser(ANA, saved.id)?.status).toBe("draft");
  });
});

describe("review", () => {
  test("the queue is oldest submission first and carries the author id", () => {
    const first = draft({ title: "Primera" });
    const second = presentations.save(BRUNO, document({ title: "Segunda" }));
    presentations.submit(ANA, first.id);
    presentations.submit(BRUNO, second!.id);

    const queue = presentations.listForReview("pending");

    expect(queue.map((entry) => entry.title)).toEqual(["Primera", "Segunda"]);
    expect(queue[0]?.authorId).toBe(ANA);
  });

  test("approving freezes the document and publishes it under a slug", () => {
    const { publication } = published();

    expect(publication.slug).toMatch(/^capa-de-transporte-[0-9a-f]{6}$/);
    expect(publication.authorName).toBe("Ana Pérez");
    expect(publication.document.title).toBe("Capa de transporte");
    expect(presentations.findPublishedBySlug(publication.slug)?.title).toBe(
      "Capa de transporte",
    );
  });

  test("the published snapshot does not follow the author's later edits", () => {
    const { saved, publication } = published();

    presentations.save(ANA, document({ title: "Versión no revisada" }), saved.id);

    // Theory keeps serving what was reviewed.
    expect(presentations.findPublishedBySlug(publication.slug)?.title).toBe(
      "Capa de transporte",
    );
    expect(presentations.findForUser(ANA, saved.id)?.title).toBe("Versión no revisada");
  });

  test("re-approving replaces the snapshot and keeps the original slug", () => {
    const { saved, publication } = published();

    presentations.save(ANA, document({ title: "Segunda versión" }), saved.id);
    presentations.submit(ANA, saved.id);
    const again = presentations.approve(ADMIN, saved.id, "Ana Pérez");

    // A link already handed to a class has to go on working.
    expect(again?.slug).toBe(publication.slug);
    expect(presentations.findPublishedBySlug(publication.slug)?.title).toBe(
      "Segunda versión",
    );
  });

  test("approving the same submission twice is a no-op", () => {
    const { saved } = published();

    expect(presentations.approve(ADMIN, saved.id, "Ana Pérez")).toBeNull();
  });

  test("a draft that was never submitted cannot be approved", () => {
    const saved = draft();

    expect(presentations.approve(ADMIN, saved.id, "Ana Pérez")).toBeNull();
    expect(presentations.findPublishedBySlug("whatever")).toBeNull();
  });

  test("rejecting records the reason and leaves any live version alone", () => {
    const { saved, publication } = published();
    presentations.save(ANA, document({ title: "Tercera" }), saved.id);
    presentations.submit(ANA, saved.id);

    const rejected = presentations.reject(ADMIN, saved.id, "Falta la bibliografía");

    expect(rejected?.status).toBe("rejected");
    expect(rejected?.reviewNote).toBe("Falta la bibliografía");
    // A rejected *new* version does not take down the approved one.
    expect(presentations.findPublishedBySlug(publication.slug)?.title).toBe(
      "Capa de transporte",
    );
  });

  test("the review log keeps every decision, newest first", () => {
    const { saved } = published();
    presentations.submit(ANA, saved.id);
    presentations.reject(ADMIN, saved.id, "Corrige el diagrama");

    expect(presentations.reviews(saved.id).map((entry) => entry.action)).toEqual([
      "reject",
      "submit",
      "approve",
      "submit",
    ]);
  });
});

describe("withdrawing and deleting", () => {
  test("withdrawing takes the presentation off Theory immediately", () => {
    const { saved, publication } = published();

    const withdrawn = presentations.withdraw(ANA, saved.id);

    expect(withdrawn?.status).toBe("draft");
    expect(withdrawn?.publishedSlug).toBeNull();
    expect(presentations.findPublishedBySlug(publication.slug)).toBeNull();
  });

  test("deleting the draft takes its publication, assets and progress with it", () => {
    const { saved, publication } = published();
    presentations.addAsset(ANA, saved.id, {
      filename: "diagrama.png",
      mime: "image/png",
      bytes: PNG,
    });
    presentations.saveProgress(STUDENT, publication.slug, 40, "slide:1");

    expect(presentations.remove(ANA, saved.id)).toBe(true);

    expect(presentations.findPublishedBySlug(publication.slug)).toBeNull();
    expect(presentations.listProgress(STUDENT)).toHaveLength(0);
    expect(
      db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM presentation_assets").get()
        ?.count,
    ).toBe(0);
  });
});

describe("the Theory listing", () => {
  test("lists only published presentations, newest first, with slide counts", () => {
    published({ title: "Transporte" });
    draft({ title: "Sin publicar" });

    const listing = presentations.listPublished();

    expect(listing).toHaveLength(1);
    expect(listing[0]?.title).toBe("Transporte");
    expect(listing[0]?.slideCount).toBe(2);
  });

  test("narrows to one topic", () => {
    published({ title: "Transporte", topic: "transport-layer" });
    published({ title: "Enlace", topic: "link-layer" });

    expect(presentations.listPublished("link-layer").map((entry) => entry.title)).toEqual([
      "Enlace",
    ]);
  });
});

describe("images", () => {
  test("an upload belongs to the presentation and is readable by its owner", () => {
    const saved = draft();

    const result = presentations.addAsset(ANA, saved.id, {
      filename: "diagrama.png",
      mime: "image/png",
      bytes: PNG,
    });

    expect(result.ok).toBe(true);
    const asset = result.ok ? result.asset : null;
    expect(asset?.byteSize).toBe(PNG.byteLength);
    expect(presentations.readAsset(asset!.id, ANA)?.bytes).toEqual(PNG);
  });

  test("an unpublished draft's image is not readable by anyone else", () => {
    const saved = draft();
    const result = presentations.addAsset(ANA, saved.id, {
      filename: "diagrama.png",
      mime: "image/png",
      bytes: PNG,
    });
    const id = result.ok ? result.asset.id : "";

    expect(presentations.readAsset(id, BRUNO)).toBeNull();
    // A signed-out reader passes the empty string.
    expect(presentations.readAsset(id, "")).toBeNull();
  });

  test("once published, its images are readable by anyone", () => {
    const saved = draft();
    const result = presentations.addAsset(ANA, saved.id, {
      filename: "diagrama.png",
      mime: "image/png",
      bytes: PNG,
    });
    const id = result.ok ? result.asset.id : "";
    presentations.submit(ANA, saved.id);
    presentations.approve(ADMIN, saved.id, "Ana Pérez");

    expect(presentations.readAsset(id, "")?.mime).toBe("image/png");
  });

  test("uploading to somebody else's presentation is refused", () => {
    const saved = draft();

    const result = presentations.addAsset(BRUNO, saved.id, {
      filename: "x.png",
      mime: "image/png",
      bytes: PNG,
    });

    expect(result).toEqual({ ok: false, reason: "notFound" });
  });

  test("the per-presentation cap is enforced", () => {
    const saved = draft();
    for (let index = 0; index < MAX_ASSETS_PER_PRESENTATION; index += 1) {
      presentations.addAsset(ANA, saved.id, {
        filename: `${index}.png`,
        mime: "image/png",
        bytes: PNG,
      });
    }

    const overflow = presentations.addAsset(ANA, saved.id, {
      filename: "one-too-many.png",
      mime: "image/png",
      bytes: PNG,
    });

    expect(overflow).toEqual({ ok: false, reason: "tooMany" });
  });

  test("an image the published version uses cannot be deleted", () => {
    const saved = draft();
    const result = presentations.addAsset(ANA, saved.id, {
      filename: "diagrama.png",
      mime: "image/png",
      bytes: PNG,
    });
    const assetId = result.ok ? result.asset.id : "";

    // Put the image on a slide, then publish that version.
    presentations.save(
      ANA,
      document({
        slides: [
          {
            id: "s1",
            elements: [
              {
                id: "e1",
                type: "image",
                x: 0,
                y: 0,
                width: 800,
                height: 600,
                rotation: 0,
                props: { assetId, alt: "Diagrama", fit: "contain" },
              },
            ],
          },
        ],
      }),
      saved.id,
    );
    presentations.submit(ANA, saved.id);
    presentations.approve(ADMIN, saved.id, "Ana Pérez");

    expect(presentations.removeAsset(ANA, saved.id, assetId)).toEqual({
      ok: false,
      reason: "published",
    });

    // Withdrawing frees it again.
    presentations.withdraw(ANA, saved.id);
    expect(presentations.removeAsset(ANA, saved.id, assetId)).toEqual({ ok: true });
  });
});

describe("reading progress", () => {
  test("a reader's percentage is stored against the slug they read", () => {
    const { publication } = published();

    const progress = presentations.saveProgress(STUDENT, publication.slug, 35, "scroll:0.35");

    expect(progress).toMatchObject({ slug: publication.slug, percent: 35, position: "scroll:0.35" });
    expect(presentations.findProgress(STUDENT, publication.slug)?.percent).toBe(35);
  });

  test("progress only ever moves forward, but the position follows the reader", () => {
    const { publication } = published();
    presentations.saveProgress(STUDENT, publication.slug, 80, "slide:8");

    const back = presentations.saveProgress(STUDENT, publication.slug, 10, "slide:1");

    // Scrolling back up to re-read something is not losing progress…
    expect(back?.percent).toBe(80);
    // …but "where was I?" is answered by the latest position.
    expect(back?.position).toBe("slide:1");
  });

  test("both modes write to the same row", () => {
    const { publication } = published();

    presentations.saveProgress(STUDENT, publication.slug, 50, "scroll:0.5");
    const fromPresentationMode = presentations.saveProgress(
      STUDENT,
      publication.slug,
      75,
      "slide:6",
    );

    expect(fromPresentationMode?.percent).toBe(75);
    expect(presentations.listProgress(STUDENT)).toHaveLength(1);
  });

  test("progress is per reader", () => {
    const { publication } = published();
    presentations.saveProgress(STUDENT, publication.slug, 90, "slide:9");

    expect(presentations.findProgress(BRUNO, publication.slug)).toBeNull();
    expect(presentations.listProgress(BRUNO)).toHaveLength(0);
  });

  test("an unpublished slug cannot be tracked", () => {
    draft();

    expect(presentations.saveProgress(STUDENT, "no-such-slug", 20, null)).toBeNull();
    expect(presentations.findProgress(STUDENT, "no-such-slug")).toBeNull();
  });

  test("progress survives a re-approval, because the slug does", () => {
    const { saved, publication } = published();
    presentations.saveProgress(STUDENT, publication.slug, 60, "slide:5");

    presentations.save(ANA, document({ title: "Revisada" }), saved.id);
    presentations.submit(ANA, saved.id);
    presentations.approve(ADMIN, saved.id, "Ana Pérez");

    expect(presentations.findProgress(STUDENT, publication.slug)?.percent).toBe(60);
  });

  test("withdrawing hides progress from the listing without losing the row", () => {
    const { saved, publication } = published();
    presentations.saveProgress(STUDENT, publication.slug, 70, "slide:7");

    presentations.withdraw(ANA, saved.id);

    // Nothing to link to, so nothing to badge…
    expect(presentations.listProgress(STUDENT)).toHaveLength(0);
    // …but re-approving brings the reader back where they were.
    presentations.submit(ANA, saved.id);
    const again = presentations.approve(ADMIN, saved.id, "Ana Pérez");
    expect(presentations.findProgress(STUDENT, again!.slug)?.percent).toBe(70);
  });
});

describe("what a publication does not carry", () => {
  test("neither the author's notes nor a slide's reach a student", () => {
    const { publication } = published();

    expect(publication.document.notes).toBe("");
    expect(publication.document.slides[0]?.notes).toBeUndefined();
  });

  test("the notes survive in the draft the author keeps editing", () => {
    const saved = draft();
    presentations.submit(ANA, saved.id);
    presentations.approve(ADMIN, saved.id, "Ana Pérez");

    const own = presentations.findForUser(ANA, saved.id);
    expect(own?.document.notes).toBe("Recordar el ejemplo del handshake.");
    expect(own?.document.slides[0]?.notes).toBe(
      "Saludar y preguntar qué recuerdan de la capa de red.",
    );
  });

  test("the reader's own fetch of a published slug is stripped too", () => {
    const { publication } = published();
    const read = presentations.findPublishedBySlug(publication.slug);

    expect(read?.document.notes).toBe("");
    expect(read?.document.slides[0]?.notes).toBeUndefined();
  });
});
