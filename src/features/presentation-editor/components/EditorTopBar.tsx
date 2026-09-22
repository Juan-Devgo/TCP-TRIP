import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tip } from "@/features/presentation-editor/components/Tip";
import {
  MAX_PRESENTATION_TITLE_LENGTH,
  PRESENTATION_MODES,
  PRESENTATION_TOPICS,
  type PresentationTopic,
} from "@/lib/presentations/contract";

/**
 * The editor's first row: what this presentation is called, and which of the
 * two ways of writing it is on screen.
 *
 * The title is edited in place rather than in a labelled field — it is the
 * heading of the thing being edited, so it reads as one. The tabs sit at the
 * far end because they are a **view** switch, not an edit: both halves of the
 * document are stored, and swapping tabs never converts or discards either
 * (which is exactly what the tooltips have to say, because "slides" and
 * "markdown" do not tell a teacher that only one of them can be projected).
 *
 * The Theory topic rides along here rather than in the right-hand panel
 * because the panel only exists in slides mode, and a presentation written as
 * markdown still has to be filed under a topic before it can be submitted.
 *
 * It renders the `TabsList` only: the `Tabs` root is the editor's, so the
 * toolbar and the content below can change with the same value.
 */
export function EditorTopBar({
  title,
  topic,
  onTitle,
  onTopic,
  onCommit,
}: {
  title: string;
  topic: PresentationTopic;
  onTitle: (value: string) => void;
  onTopic: (value: PresentationTopic) => void;
  /** The title has stopped being typed — one undo step, not one per letter. */
  onCommit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Input
        value={title}
        aria-label={t("presentations.editor.title")}
        placeholder={t("presentations.editor.untitled")}
        maxLength={MAX_PRESENTATION_TITLE_LENGTH}
        onChange={(event) => onTitle(event.target.value)}
        onBlur={onCommit}
        className="h-9 min-w-56 flex-1 border-transparent bg-transparent px-2 text-base font-semibold shadow-none focus-visible:border-input md:text-base"
      />

      <Select
        items={PRESENTATION_TOPICS.map((value) => ({
          value,
          label: t(`presentations.topics.${value}`),
        }))}
        value={topic}
        onValueChange={(next) => onTopic(String(next) as PresentationTopic)}
      >
        <Tip label={t("presentations.editor.tips.topic")}>
          <SelectTrigger size="sm" className="w-48">
            <SelectValue />
          </SelectTrigger>
        </Tip>
        <SelectContent>
          {PRESENTATION_TOPICS.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`presentations.topics.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <TabsList>
        {PRESENTATION_MODES.map((mode) => (
          <Tooltip key={mode}>
            <TooltipTrigger
              render={
                <TabsTrigger value={mode}>
                  {t(`presentations.editor.modes.${mode}`)}
                </TabsTrigger>
              }
            />
            <TooltipContent side="bottom">
              {t(`presentations.editor.modeTip.${mode}`)}
            </TooltipContent>
          </Tooltip>
        ))}
      </TabsList>
    </div>
  );
}
