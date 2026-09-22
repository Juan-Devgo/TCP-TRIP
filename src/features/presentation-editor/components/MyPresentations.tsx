import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft, Plus, StickyNote, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PresentationEditor } from "@/features/presentation-editor/components/PresentationEditor";
import {
  deletePresentation,
  listPresentations,
  PresentationApiError,
  type SavedPresentation,
} from "@/services/presentations";
import { cn } from "@/lib/utils";

/** The tab's own path; a segment after it is the draft being edited. */
const BASE_PATH = "/teacher/presentations/mine";

/** Which draft the URL points at, or `null` for the listing. */
export function draftIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith(`${BASE_PATH}/`)) return null;

  const id = pathname.slice(BASE_PATH.length + 1);
  return id === "" ? null : decodeURIComponent(id);
}

type State =
  | { status: "loading" }
  | { status: "ready"; presentations: SavedPresentation[] }
  | { status: "error" };

/**
 * `Mis Presentaciones`: everything this teacher has written, and the editor for
 * whichever one is open.
 *
 * Opening a draft is **navigation inside this tab** (`/teacher/presentations/mine/<id>`
 * is not a registered page, so the tab reducer pushes it onto this tab's own
 * history). That gives the URL, the breadcrumb and the per-tab back button for
 * free, and keeps one editor open at a time instead of one per draft.
 */
export function MyPresentations() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: "loading" });

  const openId = draftIdFromPath(pathname);

  const load = useCallback(() => {
    let cancelled = false;

    listPresentations()
      .then((presentations) => {
        if (!cancelled) setState({ status: "ready", presentations });
      })
      .catch((error: unknown) => {
        console.error("Could not list the presentations", error);
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(load, [load]);

  async function remove(presentation: SavedPresentation) {
    const title = t("presentations.toast.delete");
    try {
      await deletePresentation(presentation.id);
      setState((current) =>
        current.status === "ready"
          ? {
              status: "ready",
              presentations: current.presentations.filter(
                (candidate) => candidate.id !== presentation.id,
              ),
            }
          : current,
      );
      toast.add({ title, type: "success", description: t("presentations.toast.deletedBody") });
    } catch (error) {
      console.error(title, error);
      toast.add({
        title,
        type: "error",
        description: t(
          error instanceof PresentationApiError && error.isForbidden
            ? "presentations.errors.notTeacher"
            : "presentations.errors.generic",
        ),
      });
    }
  }

  if (openId !== null) {
    const draft =
      state.status === "ready"
        ? state.presentations.find((presentation) => presentation.id === openId)
        : undefined;

    // Still loading, or an id that is not this teacher's — the two are told
    // apart below, because only the second one is worth a message.
    if (state.status === "loading") {
      return <p className="text-muted-foreground">{t("common.loading")}</p>;
    }

    if (!draft) {
      return (
        <div className="flex flex-col gap-3">
          <p className="m-0">{t("presentations.mine.notFound")}</p>
          <Button variant="outline" className="self-start" onClick={() => navigate(BASE_PATH)}>
            <ArrowLeft />
            {t("presentations.mine.backToList")}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="self-start" onClick={() => navigate(BASE_PATH)}>
          <ArrowLeft />
          {t("presentations.mine.backToList")}
        </Button>

        <PresentationEditor
          draft={draft}
          // Keep the listing honest: a save here changes the row behind it.
          onSaved={(saved) =>
            setState((current) =>
              current.status === "ready"
                ? {
                    status: "ready",
                    presentations: current.presentations.map((candidate) =>
                      candidate.id === saved.id ? saved : candidate,
                    ),
                  }
                : current,
            )
          }
        />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0">{t("presentations.mine.title")}</h2>
        <Button variant="outline" onClick={() => navigate("/teacher/presentations/new")}>
          <Plus />
          {t("presentations.mine.new")}
        </Button>
      </div>

      <p className="text-muted-foreground m-0 text-sm">{t("presentations.mine.intro")}</p>

      {state.status === "loading" && (
        <p className="text-muted-foreground m-0">{t("common.loading")}</p>
      )}

      {state.status === "error" && (
        <p className="text-destructive m-0">{t("presentations.errors.list")}</p>
      )}

      {state.status === "ready" && state.presentations.length === 0 && (
        <p className="m-0">{t("presentations.mine.empty")}</p>
      )}

      {state.status === "ready" && state.presentations.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {state.presentations.map((presentation) => (
            <li
              key={presentation.id}
              className="border-border m-0 flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <button
                type="button"
                className="min-w-0 flex-1 cursor-pointer text-left"
                onClick={() => navigate(`${BASE_PATH}/${presentation.id}`)}
              >
                <span className="block truncate font-medium">{presentation.title}</span>
                <span className="text-muted-foreground block text-xs">
                  {t(`presentations.topics.${presentation.topic}`)} ·{" "}
                  {t(`presentations.editor.modes.${presentation.mode}`)} ·{" "}
                  {t("presentations.mine.slides", {
                    count: presentation.document.slides.length,
                  })}
                </span>

                {/* The author's own notes — this is the one screen that shows
                    them, and a student never gets them at all: the published
                    copy is stripped of both kinds of note. */}
                {presentation.document.notes && (
                  <span className="text-muted-foreground mt-1 flex items-start gap-1 text-xs">
                    <StickyNote className="mt-0.5 size-3 shrink-0" />
                    <span className="line-clamp-2 whitespace-pre-wrap">
                      {presentation.document.notes}
                    </span>
                  </span>
                )}
              </button>

              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  presentation.status === "published" && "text-tertiary-ink",
                  presentation.status === "pending" && "text-primary-ink",
                  presentation.status === "rejected" && "text-destructive",
                  presentation.status === "draft" && "text-muted-foreground",
                )}
              >
                {t(`presentations.status.${presentation.status}`)}
              </span>

              <Button
                size="icon"
                variant="ghost"
                className="text-destructive size-8 shrink-0"
                aria-label={t("presentations.mine.delete")}
                title={t("presentations.mine.delete")}
                onClick={() => void remove(presentation)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
