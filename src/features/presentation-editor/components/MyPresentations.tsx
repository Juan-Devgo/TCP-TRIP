import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  FileText,
  History,
  Layers,
  Loader2,
  Plus,
  Presentation,
  StickyNote,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useCrumbLabel } from "@/context/PageChromeProvider";
import { useTabPath } from "@/context/TabsProvider";
import { PresentationEditor } from "@/features/presentation-editor/components/PresentationEditor";
import {
  byLastEdited,
  groupByTopic,
} from "@/features/presentation-editor/lib/presentationList";
import type { PresentationStatus } from "@/lib/presentations/contract";
import {
  deletePresentation,
  listPresentations,
  PresentationApiError,
  type SavedPresentation,
} from "@/services/presentations";
import { cn } from "@/lib/utils";

/** The tab's own path; a segment after it is the draft being edited. */
const BASE_PATH = "/teacher/presentations/mine";
const NEW_PATH = "/teacher/presentations/new";

/** How the listing is laid out: one grid by last edit, or one per topic. */
type ListView = "recent" | "topic";

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
  const pathname = useTabPath();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: "loading" });
  const [view, setView] = useState<ListView>("recent");

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

  const draft =
    openId !== null && state.status === "ready"
      ? state.presentations.find((presentation) => presentation.id === openId)
      : undefined;

  // The crumb names the draft, not its id.
  useCrumbLabel(
    draft ? pathname : null,
    draft ? draft.title.trim() || t("presentations.editor.untitled") : null,
  );

  if (openId !== null) {
    // Still loading, or an id that is not this teacher's — the two are told
    // apart below, because only the second one is worth a message.
    if (state.status === "loading") {
      return (
        <div
          role="status"
          className="text-muted-foreground flex min-h-[60vh] items-center justify-center"
        >
          <Loader2 className="size-8 animate-spin" aria-hidden />
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      );
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

    // No "back to the list" button: the breadcrumb and the tab's back arrow
    // already go there.
    return (
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
    );
  }

  const newPresentation = () => navigate(NEW_PATH);

  if (state.status === "ready" && state.presentations.length === 0) {
    return <EmptyPresentations onNew={newPresentation} />;
  }

  const open = (presentation: SavedPresentation) =>
    navigate(`${BASE_PATH}/${presentation.id}`);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0">{t("presentations.mine.title")}</h2>
        <Button variant="outline" onClick={newPresentation}>
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

      {state.status === "ready" && (
        <Tabs value={view} onValueChange={(value: ListView) => setView(value)}>
          <TabsList aria-label={t("presentations.mine.view.label")}>
            <TabsTrigger value="recent">
              <History />
              {t("presentations.mine.view.recent")}
            </TabsTrigger>
            <TabsTrigger value="topic">
              <Layers />
              {t("presentations.mine.view.topic")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="pt-4">
            <CardGrid
              presentations={byLastEdited(state.presentations)}
              showTopic
              onOpen={open}
              onDelete={(presentation) => void remove(presentation)}
            />
          </TabsContent>

          <TabsContent value="topic" className="flex flex-col gap-6 pt-4">
            {groupByTopic(state.presentations).map((group) => (
              <section key={group.topic} className="flex flex-col gap-3">
                <h3 className="m-0 flex items-baseline gap-2 text-base">
                  {t(`presentations.topics.${group.topic}`)}
                  <span className="text-muted-foreground text-sm font-normal">
                    {group.items.length}
                  </span>
                </h3>
                <CardGrid
                  presentations={group.items}
                  showTopic={false}
                  onOpen={open}
                  onDelete={(presentation) => void remove(presentation)}
                />
              </section>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}

function CardGrid({
  presentations,
  showTopic,
  onOpen,
  onDelete,
}: {
  presentations: readonly SavedPresentation[];
  /** Off inside a topic group, where the heading already says it. */
  showTopic: boolean;
  onOpen: (presentation: SavedPresentation) => void;
  onDelete: (presentation: SavedPresentation) => void;
}) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
      {presentations.map((presentation) => (
        <PresentationCard
          key={presentation.id}
          presentation={presentation}
          showTopic={showTopic}
          onOpen={() => onOpen(presentation)}
          onDelete={() => onDelete(presentation)}
        />
      ))}
    </ul>
  );
}

/** Where a draft stands in the review, as a colour dot a glance can read. */
const STATUS_DOT: Record<PresentationStatus, string> = {
  draft: "bg-muted-foreground",
  pending: "bg-primary",
  published: "bg-tertiary",
  rejected: "bg-destructive",
};

function PresentationCard({
  presentation,
  showTopic,
  onOpen,
  onDelete,
}: {
  presentation: SavedPresentation;
  showTopic: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const ModeIcon = presentation.mode === "slides" ? Presentation : FileText;
  const edited = new Date(presentation.updatedAt);

  return (
    <li className="bg-card text-card-foreground border-border hover:border-primary has-[button:focus-visible]:ring-ring/50 relative m-0 flex aspect-square w-56 flex-col gap-2 rounded-xl border p-3 transition-colors has-[button:focus-visible]:ring-[3px]">
      <div className="flex items-start justify-between gap-2">
        <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          <ModeIcon className="size-4" />
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className={cn("size-2 rounded-full", STATUS_DOT[presentation.status])} />
          {t(`presentations.status.${presentation.status}`)}
        </span>
      </div>

      {/* The whole card opens the draft: the title's hit area is stretched
          over it, so the delete button below stays a separate control. */}
      <button
        type="button"
        className="line-clamp-2 cursor-pointer text-left font-semibold leading-snug outline-none after:absolute after:inset-0 after:rounded-xl"
        onClick={onOpen}
      >
        {presentation.title}
      </button>

      {showTopic && (
        <span className="text-muted-foreground -mt-1 truncate text-xs">
          {t(`presentations.topics.${presentation.topic}`)}
        </span>
      )}

      {/* The author's own notes — this is the one screen that shows them, and
          a student never gets them at all: the published copy is stripped of
          both kinds of note. */}
      {presentation.document.notes && (
        <span className="text-muted-foreground flex min-h-0 items-start gap-1 text-xs">
          <StickyNote className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-2 whitespace-pre-wrap">
            {presentation.document.notes}
          </span>
        </span>
      )}

      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="text-muted-foreground flex min-w-0 flex-col text-xs">
          <span className="truncate">
            {t(`presentations.editor.modes.${presentation.mode}`)}
            {presentation.mode === "slides" &&
              ` · ${t("presentations.mine.slides", {
                count: presentation.document.slides.length,
              })}`}
          </span>
          <time dateTime={presentation.updatedAt} title={edited.toLocaleString(i18n.language)}>
            {t("presentations.mine.edited", {
              date: new Intl.DateTimeFormat(i18n.language, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(edited),
            })}
          </time>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="text-destructive relative size-7 shrink-0"
          aria-label={t("presentations.mine.delete")}
          title={t("presentations.mine.delete")}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

/** No presentation yet: say so in the middle of the page, and offer the way out. */
function EmptyPresentations({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation();

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <span className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl">
        <Presentation className="size-7" />
      </span>
      <h2 className="m-0">{t("presentations.mine.emptyTitle")}</h2>
      <p className="text-muted-foreground m-0 max-w-sm text-sm">
        {t("presentations.mine.emptyHint")}
      </p>
      <Button className="mt-2" onClick={onNew}>
        <Plus />
        {t("presentations.mine.new")}
      </Button>
    </section>
  );
}
