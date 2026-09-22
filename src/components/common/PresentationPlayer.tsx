import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, StickyNote, X } from "lucide-react";

import { PresentationStage } from "@/components/common/PresentationStage";
import { Button } from "@/components/ui/button";
import type { PresentationDocument } from "@/lib/presentations/contract";
import { cn } from "@/lib/utils";

/**
 * Presentation mode: one slide at a time, filling the screen, driven by the
 * keyboard.
 *
 * It is a common component rather than a feature's because three callers need
 * exactly this — a teacher previewing their draft, a teacher projecting a
 * published deck, and a student reading one — and a feature may not import
 * another feature.
 *
 * `fullscreen` asks the browser for the real thing — the projector wants the
 * whole screen, not a maximised window with a tab strip. The request can be
 * refused (it needs a user gesture, and some browsers refuse it outright); when
 * it is, the player stays the full-window overlay it already was.
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
  onSlideChange,
  onClose,
}: {
  document: PresentationDocument;
  /** Where to resume — a reader coming back to a deck they had started. */
  initialSlide?: number;
  /** Take over the screen, not just the window. */
  fullscreen?: boolean;
  /** Called with every slide reached; the reader turns it into a percentage. */
  onSlideChange?: (index: number, total: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const total = document.slides.length;
  const [index, setIndex] = useState(() => clampIndex(initialSlide, total));
  const [showNotes, setShowNotes] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  // The player only answers keys while it has focus, so it takes it on open.
  useEffect(() => {
    frame.current?.focus();
  }, []);

  useEffect(() => {
    const node = frame.current;
    if (!fullscreen || !node) return;

    // Refused is not an error here: the overlay already fills the window.
    void node.requestFullscreen?.().catch(() => undefined);

    return () => {
      if (window.document.fullscreenElement) {
        void window.document.exitFullscreen?.().catch(() => undefined);
      }
    };
  }, [fullscreen]);

  useEffect(() => {
    onSlideChange?.(index, total);
  }, [index, total, onSlideChange]);

  const slide = document.slides[clampIndex(index, total)];

  function go(delta: number) {
    setIndex((current) => clampIndex(current + delta, total));
  }

  function onKeyDown(event: React.KeyboardEvent) {
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
      n: () => setShowNotes((current) => !current),
    };

    const handler = keys[event.key];
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
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="truncate text-sm font-semibold">{document.title}</span>
        <span className="text-muted-foreground font-mono text-sm">
          {index + 1}/{total}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={showNotes ? "default" : "outline"}
            onClick={() => setShowNotes((current) => !current)}
          >
            <StickyNote />
            {t("presentations.player.notes")}
          </Button>
          <Button size="icon" variant="ghost" aria-label={t("presentations.player.close")} onClick={onClose}>
            <X />
          </Button>
        </div>
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

      {showNotes && (
        <div className="border-border bg-muted/40 max-h-40 overflow-y-auto border-t px-6 py-3">
          <p className="m-0 text-sm whitespace-pre-wrap">
            {slide?.notes ?? t("presentations.player.noNotes")}
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 px-4 py-3">
        <Button variant="outline" disabled={index === 0} onClick={() => go(-1)}>
          <ChevronLeft />
          {t("presentations.player.previous")}
        </Button>
        <Button
          variant="outline"
          disabled={index >= total - 1}
          onClick={() => go(1)}
        >
          {t("presentations.player.next")}
          <ChevronRight />
        </Button>
        <span className={cn("text-muted-foreground ml-4 hidden text-xs sm:inline")}>
          {t("presentations.player.hint")}
        </span>
      </div>
    </div>
  );
}

function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, index));
}
