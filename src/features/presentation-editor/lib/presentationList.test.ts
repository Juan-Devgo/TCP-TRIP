import { describe, expect, test } from "bun:test";

import {
  byLastEdited,
  groupByTopic,
} from "@/features/presentation-editor/lib/presentationList";
import type { PresentationTopic } from "@/lib/presentations/contract";

function listed(id: string, topic: PresentationTopic, updatedAt: string) {
  return { id, topic, updatedAt };
}

const OLD = listed("old", "general", "2026-01-01T10:00:00.000Z");
const MID = listed("mid", "link-layer", "2026-03-01T10:00:00.000Z");
const NEW = listed("new", "general", "2026-06-01T10:00:00.000Z");

describe("byLastEdited", () => {
  test("puts the most recently edited first", () => {
    expect(byLastEdited([OLD, NEW, MID]).map((item) => item.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  test("does not reorder its input", () => {
    const input = [OLD, NEW];
    byLastEdited(input);
    expect(input).toEqual([OLD, NEW]);
  });
});

describe("groupByTopic", () => {
  test("only topics with a presentation get a group", () => {
    expect(groupByTopic([OLD, MID, NEW]).map((group) => group.topic)).toEqual([
      "link-layer",
      "general",
    ]);
  });

  test("groups follow the syllabus order, items the last edit", () => {
    const groups = groupByTopic([OLD, NEW, MID]);
    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([
      ["mid"],
      ["new", "old"],
    ]);
  });

  test("nothing to list, no groups", () => {
    expect(groupByTopic([])).toEqual([]);
  });
});
