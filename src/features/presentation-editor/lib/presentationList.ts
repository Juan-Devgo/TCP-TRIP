import { PRESENTATION_TOPICS, type PresentationTopic } from "@/lib/presentations/contract";

/** The two fields the listing orders on — what a `SavedPresentation` carries. */
type Listed = { topic: PresentationTopic; updatedAt: string };

export type TopicGroup<T extends Listed> = { topic: PresentationTopic; items: T[] };

/** Most recently edited first. A copy: the server's order is left alone. */
export function byLastEdited<T extends Listed>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/**
 * One group per topic that has at least one presentation, in the syllabus
 * order of `PRESENTATION_TOPICS` (a fixed place for each topic beats one that
 * moves on every save), each group most recently edited first.
 */
export function groupByTopic<T extends Listed>(items: readonly T[]): TopicGroup<T>[] {
  const sorted = byLastEdited(items);

  return PRESENTATION_TOPICS.map((topic) => ({
    topic,
    items: sorted.filter((item) => item.topic === topic),
  })).filter((group) => group.items.length > 0);
}
