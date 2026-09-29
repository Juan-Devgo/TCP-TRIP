import { describe, expect, test } from "bun:test";

import {
  announcementBody,
  courseWorkBody,
  courseWorkPatch,
  fromGoogleDue,
  parseAnnouncementInput,
  parseAssignmentInput,
  toGoogleDue,
  toMaterials,
} from "@/api/classroomMapping";
import { youtubeId } from "@/lib/classroom";

const NOW = new Date("2026-09-01T12:00:00.000Z");

const VALID = {
  requestId: "r1",
  courseId: "c1",
  title: " Taller 1 ",
  instructionsHtml: "<b>Lee</b><ul><li>a</li></ul>",
  studentIds: [],
  maxPoints: 10,
  dueAt: "2026-09-10T23:59:00.000Z",
  mode: "publish",
  scheduledAt: null,
  attachments: [],
};

describe("due dates", () => {
  test("round-trips through Classroom's UTC date/time pair", () => {
    const due = toGoogleDue("2026-09-10T04:30:00.000Z");
    expect(due).toEqual({
      dueDate: { year: 2026, month: 9, day: 10 },
      dueTime: { hours: 4, minutes: 30 },
    });
    expect(fromGoogleDue(due.dueDate, due.dueTime)).toBe("2026-09-10T04:30:00.000Z");
  });

  test("no date means no due", () => {
    expect(fromGoogleDue(undefined, undefined)).toBeNull();
  });
});

describe("youtubeId", () => {
  test.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=3", "dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://example.com/watch?v=dQw4w9WgXcQ", null],
    ["not a url", null],
  ])("%s → %s", (url, id) => {
    expect(youtubeId(url)).toBe(id);
  });
});

describe("parseAssignmentInput", () => {
  test("accepts and normalizes a valid assignment", () => {
    const parsed = parseAssignmentInput(VALID, NOW);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.title).toBe("Taller 1");
  });

  test.each([
    [{ title: "" }, "title is required"],
    [{ dueAt: "2026-08-01T00:00:00.000Z" }, "dueAt is in the past"],
    [{ maxPoints: -1 }, "maxPoints must be a non-negative number"],
    [{ mode: "schedule" }, "scheduledAt is required to schedule"],
    [
      { mode: "schedule", scheduledAt: "2026-09-11T00:00:00.000Z" },
      "dueAt must come after scheduledAt",
    ],
    [{ attachments: [{ kind: "link", url: "javascript:alert(1)" }] }, "link attachment needs an http(s) url"],
    [{ attachments: [{ kind: "youtube", url: "https://example.com" }] }, "youtube attachment needs a YouTube video url"],
    [
      { attachments: [{ kind: "presentation", slug: "../admin", title: "x" }] },
      "presentation attachment needs a published slug",
    ],
    [{ attachments: Array.from({ length: 21 }, () => ({ kind: "link", url: "https://a.co" })) }, "at most 20 attachments"],
  ])("rejects %p", (override, reason) => {
    const parsed = parseAssignmentInput({ ...VALID, ...override }, NOW);
    expect(parsed).toEqual({ ok: false, reason });
  });

  test("treats zero points as ungraded and an empty editor as no instructions", () => {
    const parsed = parseAssignmentInput({ ...VALID, maxPoints: 0, instructionsHtml: "<div><br></div>" }, NOW);
    expect(parsed.ok && parsed.value.maxPoints).toBeNull();
    expect(parsed.ok && parsed.value.instructionsHtml).toBe("");
  });
});

describe("courseWorkBody", () => {
  test("sends plain-text instructions, points, due date and every student", () => {
    const parsed = parseAssignmentInput(VALID, NOW);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(courseWorkBody(parsed.value, [])).toEqual({
      title: "Taller 1",
      description: "Lee\n• a",
      workType: "ASSIGNMENT",
      state: "PUBLISHED",
      maxPoints: 10,
      dueDate: { year: 2026, month: 9, day: 10 },
      dueTime: { hours: 23, minutes: 59 },
      assigneeMode: "ALL_STUDENTS",
    });
  });

  test("schedules as a draft for selected students", () => {
    const parsed = parseAssignmentInput(
      {
        ...VALID,
        dueAt: null,
        maxPoints: null,
        mode: "schedule",
        scheduledAt: "2026-09-05T13:00:00.000Z",
        studentIds: ["s1", "s1", "s2"],
      },
      NOW,
    );
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(courseWorkBody(parsed.value, [])).toMatchObject({
      state: "DRAFT",
      scheduledTime: "2026-09-05T13:00:00.000Z",
      assigneeMode: "INDIVIDUAL_STUDENTS",
      individualStudentsOptions: { studentIds: ["s1", "s2"] },
    });
  });
});

describe("courseWorkPatch", () => {
  const patch = {
    title: "Quiz",
    instructionsHtml: "",
    maxPoints: null,
    dueAt: null,
    mode: "publish" as const,
    scheduledAt: null,
  };

  test("clears points and due date through the mask on a published item", () => {
    const { body, updateMask } = courseWorkPatch(patch, "PUBLISHED");
    expect(body).toEqual({ title: "Quiz", description: "" });
    expect(updateMask).toBe("title,description,maxPoints,dueDate,dueTime");
  });

  test("lets a draft be published", () => {
    const { body, updateMask } = courseWorkPatch(patch, "DRAFT");
    expect(body.state).toBe("PUBLISHED");
    expect(updateMask).toContain("state");
  });
});

describe("materials", () => {
  test("maps every attachment kind", () => {
    const materials = toMaterials(
      [
        { kind: "link", url: "https://rfc-editor.org", title: "RFC" },
        { kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" },
        { kind: "file", clientId: "f1", name: "guia.pdf" },
        { kind: "exercise", clientId: "e1", exerciseSetId: "s1", includeAnswers: false, name: "t.pdf" },
        { kind: "presentation", slug: "modelo-tcp-ip-abc123", title: "client title" },
      ],
      new Map([
        ["f1", "drive-f1"],
        ["e1", "drive-e1"],
      ]),
      new Map([
        [
          "modelo-tcp-ip-abc123",
          { url: "https://tcp-trip.app/theory/presentations/modelo-tcp-ip-abc123", title: "Modelo TCP/IP" },
        ],
      ]),
    );
    expect(materials).toEqual([
      { link: { url: "https://rfc-editor.org", title: "RFC" } },
      { youtubeVideo: { id: "dQw4w9WgXcQ" } },
      { driveFile: { driveFile: { id: "drive-f1" }, shareMode: "VIEW" } },
      { driveFile: { driveFile: { id: "drive-e1" }, shareMode: "VIEW" } },
      {
        link: {
          url: "https://tcp-trip.app/theory/presentations/modelo-tcp-ip-abc123",
          title: "Modelo TCP/IP",
        },
      },
    ]);
  });

  test("refuses a presentation the server did not resolve", () => {
    expect(() =>
      toMaterials([{ kind: "presentation", slug: "gone", title: "x" }], new Map()),
    ).toThrow();
  });

  test("refuses a file whose upload is missing", () => {
    expect(() => toMaterials([{ kind: "file", clientId: "x", name: "a" }], new Map())).toThrow();
  });
});

describe("announcements", () => {
  test("publishes now or schedules as a draft", () => {
    const now = parseAnnouncementInput({ requestId: "r", text: " Hola " }, NOW);
    if (!now.ok) throw new Error(now.reason);
    expect(announcementBody(now.value, [])).toEqual({
      text: "Hola",
      state: "PUBLISHED",
      assigneeMode: "ALL_STUDENTS",
    });

    const later = parseAnnouncementInput(
      { requestId: "r", text: "Hola", scheduledAt: "2026-09-02T00:00:00.000Z" },
      NOW,
    );
    if (!later.ok) throw new Error(later.reason);
    expect(announcementBody(later.value, [])).toMatchObject({
      state: "DRAFT",
      scheduledTime: "2026-09-02T00:00:00.000Z",
    });
  });

  test("requires text", () => {
    expect(parseAnnouncementInput({ requestId: "r", text: "  " }, NOW)).toEqual({
      ok: false,
      reason: "text is required",
    });
  });
});
