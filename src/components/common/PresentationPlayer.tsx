import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Ellipsis,
  Flag,
  MessageCircleQuestion,
  PenTool,
  X,
} from "lucide-react";

import { PresentationStage } from "@/components/common/PresentationStage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppRole } from "@/hooks/useAppRole";
import {
  slideProgressPercent,
  type PresentationDocument,
} from "@/lib/presentations/contract";

/**
 * What every presentable page offers from presentation mode. Announced, not
 * built yet: they render disabled so the set is visible and fixed before any
 * of them exists (`docs/ui/PresentationMode.md`).
 */
const PRESENTABLE_ACTIONS = [
  { id: "export", icon: Download },
  { id: "ask", icon: MessageCircleQuestion },
  { id: "report", icon: Flag },
  { id: "board", icon: PenTool },
] as const;

/**
 * Presentation mode: one slide at a time, filling the screen, driven by the
 * keyboard.
 *
 * It is a common component rather than a feature's because every presentable
 * page needs exactly this — a teacher previewing their draft, an admin reading
 * a submission, anyone reading a published deck — and a feature may not import
 * another feature.
 *
 * The chrome is deliberately small: the two chevrons, what sits between them,
 * the actions menu and a way out. Between the chevrons a **student** sees how
 * far through the deck they are (the same measure their saved progress uses);
 * everyone else sees a plain `n / total`. Speaker notes exist only when the
 * caller says the viewer may read them — the author, projecting their own deck.
 *
 * `fullscreen` asks the browser for the real thing. It is requested on the
 * *document*, not on this node: the tooltips and the actions menu are portalled
 * to `<body>`, and only the fullscreen element's subtree is painted. Refused is
 * fine — the player is already a full-window overlay.
 *
 * Key handling is bound to this component's own node, not to `document`:
 * inactive tabs stay mounted in this app, so a global listener here would eat
 * the arrow keys of whatever tab is actually on screen. The node takes focus
 * when it opens, which is also what a projector needs.
 */
export function PresentationPlayer({
  document,
  initialSlide = 0,
  fullscreen = false,
  speakerNotes = false,
  onSlideChange,
  onClose,
}: {
  document: PresentationDocument;
  /** Where to resume — a reader coming back to a deck they had started. */
  initialSlide?: number;
  /** Take over the screen, not just the window. */
  fullscreen?: boolean;
  /** The viewer may read the slides' notes (`N`): the deck's author only. */
  speakerNotes?: boolean;
  /** Called with every slide reached; the reader turns it into a percentage. */
  onSlideChange?: (index: number, total: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { role } = useAppRole();
  const total = document.slides.length;
  const [index, setIndex] = useState(() => clampIndex(initialSlide, total));
  const [showNotes, setShowNotes] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  // The player only answers keys while it has focus, so it takes it on open.
  useEffect(() => {
    frame.current?.focus();
  }, []);

  useEffect(() => {
    if (!fullscreen) return;

    // Refused is not an error here: the overlay already fills the window.
    void window.document.documentElement.requestFullscreen?.().catch(() => undefined);

    return () => {
      if (window.document.fullscreenElement) {
        void window.document.exitFullscreen?.().catch(() => undefined);
      }
    };
  }, [fullscreen]);

  useEffect(() => {
    onSlideChange?.(index, total);
  }, [index, total, onSlideChange]);

  const current = clampIndex(index, total);
  const slide = document.slides[current];
  const isFirst = current === 0;
  const isLast = current >= total - 1;

  function go(delta: number) {
    setIndex((value) => clampIndex(value + delta, total));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const keys: Record<string, () => void> = {
      ArrowRight: () => go(1),
      ArrowDown: () => go(1),
      PageDown: () => go(1),
      " ": () => go(1),
      ArrowLeft: () => go(-1),
      ArrowUp: () => go(-1),
      PageUp: () => go(-1),
      Home: () => setIndex(0),
      End: () => setIndex(total - 1),
      Escape: onClose,
    };
    if (speakerNotes) keys["n"] = () => setShowNotes((value) => !value);

    const handler = keys[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  }

  return (
    <div
      ref={frame}
      tabIndex={-1}
      role="dialog"
      aria-modal
      aria-label={t("presentations.player.label", { title: document.title })}
      onKeyDown={onKeyDown}
      className="bg-background fixed inset-0 z-50 flex flex-col focus-visible:outline-none"
    >
      <div className="flex items-center justify-end gap-1 px-4 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="icon" variant="ghost" aria-label={t("presentations.player.actions")}>
                <Ellipsis />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-auto min-w-48">
            {PRESENTABLE_ACTIONS.map(({ id, icon: Icon }) => (
              <DropdownMenuItem key={id} disabled>
                <Icon />
                {t(`presentations.player.action.${id}`)}
                <DropdownMenuShortcut>{t("presentations.player.soon")}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="icon" variant="ghost" aria-label={t("presentations.player.close")} onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        {slide && (
          <PresentationStage
            slide={slide}
            canvas={document.canvas}
            // The stage keeps the deck's aspect ratio; this caps it so a tall
            // window does not push the controls off the bottom.
            className="max-h-full max-w-[min(100%,calc((100vh-9rem)*16/9))]"
          />
        )}
      </div>

      {speakerNotes && showNotes && (
        <div className="border-border bg-muted/40 max-h-40 overflow-y-auto border-t px-6 py-3">
          <p className="m-0 text-sm whitespace-pre-wrap">
            {slide?.notes ?? t("presentations.player.noNotes")}
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 px-4 py-3">
        <Chevron
          direction="previous"
          label={t("presentations.player.previous")}
          disabled={isFirst}
          onClick={() => go(-1)}
        />

        {role === "student" ? (
          <Progress
            value={slideProgressPercent(current, total)}
            className="w-full max-w-sm gap-1"
          >
            <ProgressLabel className="min-w-0 flex-1 truncate">
              {slide?.title ?? t("presentations.player.slide", { number: current + 1 })}
            </ProgressLabel>
            <ProgressValue />
          </Progress>
        ) : (
          <span className="text-muted-foreground min-w-16 text-center font-mono text-sm tabular-nums">
            {current + 1} / {total}
          </span>
        )}

        <Chevron
          direction="next"
          label={t("presentations.player.next")}
          disabled={isLast}
          onClick={() => go(1)}
        />
      </div>
    </div>
  );
}

function Chevron({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button size="icon" variant="outline" aria-label={label} disabled={disabled} onClick={onClick}>
            <Icon />
          </Button>
        }
      />
      <TooltipContent side="top">
        {label}
        <Kbd>{direction === "previous" ? "←" : "→"}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, index));
}
