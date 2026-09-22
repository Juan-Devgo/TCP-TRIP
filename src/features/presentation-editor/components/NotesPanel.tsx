import { useTranslation } from "react-i18next";
import { ChevronDown, StickyNote } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PRESENTATION_NOTES_LENGTH } from "@/lib/presentations/contract";

/**
 * The teacher's own notes on the presentation — the plan for the class, what to
 * ask, what went badly last term.
 *
 * They are **not the speaker notes of a slide**: those belong to one slide and
 * show on the presenter screen. These belong to the presentation and are only
 * ever read in `Mis Presentaciones` and here.
 *
 * "Not visible to students" is enforced on the server, not by this panel: the
 * published copy of a document is stripped of both kinds of note
 * (`withoutPrivateNotes`), because a published presentation is JSON a reader
 * could otherwise open in the network tab.
 */
export function NotesPanel({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Collapsible defaultOpen={value.trim() !== ""}>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex w-full cursor-pointer items-center gap-2 text-sm font-semibold">
        <StickyNote className="size-4" />
        {t("presentations.editor.privateNotes")}
        <ChevronDown className="size-4 transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-2">
        <Textarea
          rows={3}
          value={value}
          maxLength={MAX_PRESENTATION_NOTES_LENGTH}
          aria-label={t("presentations.editor.privateNotes")}
          placeholder={t("presentations.editor.privateNotesPlaceholder")}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
          className="text-sm"
        />
        <p className="text-muted-foreground m-0 pt-1 text-xs">
          {t("presentations.editor.privateNotesHint")}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
