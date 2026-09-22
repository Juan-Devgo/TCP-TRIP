import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MonitorPlay } from "lucide-react";

import { Markdown } from "@/components/common/Markdown";
import { PresentationPlayer } from "@/components/common/PresentationPlayer";
import { PresentationStage } from "@/components/common/PresentationStage";
import { Button } from "@/components/ui/button";
import { useIsTabActive } from "@/context/TabsProvider";
import { useReadingProgress } from "@/features/theory-presentations/lib/useReadingProgress";
import {
  scrollProgressPercent,
  slideProgressPercent,
} from "@/lib/presentations/contract";
import {
  getPublishedPresentation,
  type PublishedPresentation,
} from "@/services/presentations";

type State =
  | { status: "loading" }
  | { status: "found"; presentation: PublishedPresentation }
  | { status: "missing" }
  | { status: "error" };

/** Where the reader was, as the two views spell it. */
function resumeSlide(position: string | null): number | null {
  if (!position?.startsWith("slide:")) return null;

  const index = Number(position.slice("slide:".length));
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function resumeRatio(position: string | null): number | null {
  if (!position?.startsWith("scroll:")) return null;

  const ratio = Number(position.slice("scroll:".length));
  return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : null;
}

/**
 * One published presentation, as a student reads it.
 *
 * The **same document** is shown two ways and both count towards one
 * percentage: the page below (scrolled) and presentation mode (slide by slide).
 * That is the point of storing a single number — a student who read half of it
 * on the train and opens it on a projector is still half way through.
 *
 * Progress needs a session, so a signed-out reader gets the content and no
 * tracking; the hook stops asking after the first 401 rather than reporting an
 * error over a lecture.
 */
export function PublishedPresentationView({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const isActive = useIsTabActive();
  const [state, setState] = useState<State>({ status: "loading" });
  const [presenting, setPresenting] = useState<number | null>(null);
  const article = useRef<HTMLDivElement>(null);

  const found = state.status === "found" ? state.presentation : null;
  const { progress, report } = useReadingProgress(slug, found !== null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    getPublishedPresentation(slug)
      .then((presentation) => {
        if (cancelled) return;
        setState(
          presentation ? { status: "found", presentation } : { status: "missing" },
        );
      })
      .catch((error: unknown) => {
        console.error("Could not load the presentation", error);
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  /**
   * Scrolled height is the reading view's measure. The listener is bound only
   * while this tab is the one on screen: inactive tabs stay mounted here, and a
   * hidden reader would otherwise report the scrolling of the visible tab.
   */
  useEffect(() => {
    if (!found || !isActive || presenting !== null) return;

    function onScroll() {
      const root = window.document.documentElement;
      const percent = scrollProgressPercent(
        root.scrollTop,
        root.scrollHeight,
        root.clientHeight,
      );
      const ratio =
        root.scrollHeight > root.clientHeight
          ? root.scrollTop / (root.scrollHeight - root.clientHeight)
          : 1;

      report(percent, `scroll:${ratio.toFixed(2)}`);
    }

    // Fires once on mount too: a presentation shorter than the window is
    // already fully read, and nothing would ever scroll to say so.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [found, isActive, presenting, report]);

  if (state.status === "loading") {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  if (state.status === "missing" || state.status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <p className="m-0">
          {t(
            state.status === "missing"
              ? "presentations.read.missing"
              : "presentations.errors.generic",
          )}
        </p>
        {/* No "back to the index": there is none. The sidebar is the index,
            and the toolbar's back button walks this tab's own history. */}
        <p className="text-muted-foreground m-0 text-sm">
          {t("presentations.read.emptyHint")}
        </p>
      </div>
    );
  }

  const presentation = state.presentation;
  const slideResume = resumeSlide(progress?.position ?? null);
  const scrollResume = resumeRatio(progress?.position ?? null);

  return (
    <article className="flex flex-col gap-4" ref={article}>
      <header className="flex flex-col gap-1">
        <h1 className="m-0">{presentation.title}</h1>
        <p className="text-muted-foreground m-0 text-sm">
          {t("presentations.read.byline", {
            author: presentation.authorName,
            topic: t(`presentations.topics.${presentation.topic}`),
          })}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => setPresenting(slideResume ?? 0)}
          disabled={presentation.document.slides.length === 0}
        >
          <MonitorPlay />
          {t("presentations.read.present")}
        </Button>

        {progress && progress.percent > 0 && (
          <span className="text-muted-foreground text-sm">
            {t("presentations.read.progress", { percent: progress.percent })}
          </span>
        )}

        {scrollResume !== null && scrollResume > 0.02 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const root = window.document.documentElement;
              window.scrollTo({
                top: scrollResume * (root.scrollHeight - root.clientHeight),
                behavior: "smooth",
              });
            }}
          >
            {t("presentations.read.resume")}
          </Button>
        )}
      </div>

      {/* Markdown first when that is how it was written, and the slides below
          it — both halves of the document are published, so both are readable
          without switching anything. */}
      {presentation.document.markdown.trim() !== "" && (
        <Markdown source={presentation.document.markdown} />
      )}

      {presentation.document.slides.length > 0 && (
        <ol className="m-0 flex list-none flex-col gap-6 p-0">
          {presentation.document.slides.map((slide, index) => (
            <li key={slide.id} className="m-0 flex flex-col gap-1 p-0">
              <span className="text-muted-foreground font-mono text-xs">
                {index + 1}/{presentation.document.slides.length}
                {slide.title ? ` · ${slide.title}` : ""}
              </span>
              <PresentationStage
                slide={slide}
                canvas={presentation.document.canvas}
                className="border-border rounded-lg border"
              />
            </li>
          ))}
        </ol>
      )}

      {presenting !== null && (
        <PresentationPlayer
          document={presentation.document}
          initialSlide={presenting}
          // Presentation mode's measure — the same percentage, counted the way
          // that view can count it.
          onSlideChange={(index, total) =>
            report(slideProgressPercent(index, total), `slide:${index}`)
          }
          onClose={() => setPresenting(null)}
        />
      )}
    </article>
  );
}
