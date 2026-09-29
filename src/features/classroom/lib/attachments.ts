import type { TFunction } from "i18next";

import { renderExerciseSetPdf } from "@/config/exerciseTools";
import type { Attachment } from "@/lib/classroom";
import type { ExerciseSet } from "@/lib/exercises/sets";
import type { UploadFiles } from "@/services/classroom";

/** What the attachments section holds before it is sent. Files stay in memory. */
export type DraftAttachment =
  | { kind: "link"; clientId: string; url: string; title: string }
  | { kind: "youtube"; clientId: string; url: string }
  | { kind: "file"; clientId: string; file: File }
  | { kind: "exercise"; clientId: string; exerciseSetId: string; title: string; includeAnswers: boolean }
  /** A published theory presentation, sent as a link to its reader — no upload. */
  | { kind: "presentation"; clientId: string; slug: string; title: string };

/** Accepted local files: documents and images a handout is made of. */
export const FILE_ACCEPT =
  ".pdf,.doc,.docx,.odt,.ppt,.pptx,.odp,.xls,.xlsx,.ods,.txt,.csv,.pcap,.pcapng,image/*";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function attachmentName(attachment: DraftAttachment): string {
  switch (attachment.kind) {
    case "link":
      return attachment.title || attachment.url;
    case "youtube":
      return attachment.url;
    case "file":
      return attachment.file.name;
    case "exercise":
    case "presentation":
      return attachment.title;
  }
}

/**
 * Splits the draft into the JSON payload and the bytes that travel next to
 * it. Exercise sets are rendered to their frozen PDF here, in the browser,
 * where the PDF pipeline lives.
 */
export async function prepareUpload(
  attachments: readonly DraftAttachment[],
  sets: readonly ExerciseSet[],
  t: TFunction,
): Promise<{ payload: Attachment[]; files: UploadFiles }> {
  const files: UploadFiles = new Map();
  const payload: Attachment[] = [];

  for (const attachment of attachments) {
    switch (attachment.kind) {
      case "link":
        payload.push({
          kind: "link",
          url: attachment.url,
          ...(attachment.title ? { title: attachment.title } : {}),
        });
        break;
      case "youtube":
        payload.push({ kind: "youtube", url: attachment.url });
        break;
      case "file":
        files.set(attachment.clientId, attachment.file);
        payload.push({ kind: "file", clientId: attachment.clientId, name: attachment.file.name });
        break;
      case "exercise": {
        const set = sets.find((item) => item.id === attachment.exerciseSetId);
        if (!set) throw new Error(`Exercise set ${attachment.exerciseSetId} is gone`);
        const pdf = await renderExerciseSetPdf(set, attachment.includeAnswers, t);
        files.set(attachment.clientId, pdf);
        payload.push({
          kind: "exercise",
          clientId: attachment.clientId,
          exerciseSetId: set.id,
          includeAnswers: attachment.includeAnswers,
          name: pdf.name,
        });
        break;
      }
      case "presentation":
        // The server resolves the slug to the reader URL and the approved title.
        payload.push({ kind: "presentation", slug: attachment.slug, title: attachment.title });
        break;
    }
  }

  return { payload, files };
}
