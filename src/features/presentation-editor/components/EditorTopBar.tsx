import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsTabActive } from "@/context/TabsProvider";
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
 * The title has no label — it is the heading of the thing being edited — but
 * it keeps the field's border, so it still reads as something to type in.
 * Right after it sits the review status (`PresentationStatusBadge`): what the
 * presentation is called and where it stands are read together. The tabs sit at the
 * far end because they are a **view** switch, not an edit: both halves of the
 * document are stored, and swapping tabs never converts or discards either
 * (which is exactly what the tooltips have to say, because "slides" and
 * "markdown" do not tell a teacher that only one of them can be projected).
 *
 * The Theory topic rides along here rather than in the right-hand panel
 * because the panel only exists in slides mode, and a presentation written as
 * markdown still has to be filed under a topic before it can be submitted.
 *
 * While the presentation has no name of its own, a bubble pointing at the
 * title asks for one: autosave only starts once there is a name, so an
 * untitled scratch deck never lands in "Mis Presentaciones". It is a nudge,
 * not a gate — it stays put while the author works elsewhere (a click outside
 * does not close it), and goes away for good once the title is edited or the
 * author closes it (the ✕ or Escape). Inactive tabs stay mounted in this app,
 * and the bubble is portalled, so it only shows while its tab is on screen.
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
  promptName,
  onDismissPrompt,
  status,
}: {
  title: string;
  topic: PresentationTopic;
  onTitle: (value: string) => void;
  onTopic: (value: PresentationTopic) => void;
  /** The title has stopped being typed — one undo step, not one per letter. */
  onCommit: () => void;
  /** Ask for a name — the editor decides when that is still useful. */
  promptName: boolean;
  onDismissPrompt: () => void;
  /** Where the presentation stands, shown right after its name. */
  status: React.ReactNode;
}) {
  const { t } = useTranslation();
  const active = useIsTabActive();
  const field = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-72 flex-1 items-center gap-1">
        <Input
          ref={field}
          value={title}
          aria-label={t("presentations.editor.title")}
          placeholder={t("presentations.editor.untitled")}
          maxLength={MAX_PRESENTATION_TITLE_LENGTH}
          onChange={(event) => onTitle(event.target.value)}
          onBlur={onCommit}
          className="h-9 flex-1 text-base font-semibold md:text-base"
        />
        {status}
      </div>

      <Popover
        open={promptName && active}
        onOpenChange={(open, details) => {
          // Only an explicit dismissal counts: clicking the canvas to keep
          // working is not an answer to the question.
          if (!open && details.reason === "escape-key") onDismissPrompt();
        }}
      >
        <PopoverContent
          anchor={field}
          side="bottom"
          align="start"
          sideOffset={10}
          // It must not pull the caret out of whatever is being typed.
          initialFocus={false}
          finalFocus={false}
        >
          <PopoverPrimitive.Arrow className="bg-popover ring-foreground/10 -top-1.5 size-3 rotate-45 rounded-[2px] ring-1 [clip-path:polygon(0_0,100%_0,0_100%)]" />
          <div className="flex items-start gap-2">
            <PopoverHeader className="flex-1">
              <PopoverTitle>{t("presentations.editor.namePrompt.title")}</PopoverTitle>
              <PopoverDescription>
                {t("presentations.editor.namePrompt.body")}
              </PopoverDescription>
            </PopoverHeader>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={t("presentations.editor.namePrompt.dismiss")}
              onClick={onDismissPrompt}
            >
              <X />
            </Button>
          </div>
        </PopoverContent>
      </Popover>

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
