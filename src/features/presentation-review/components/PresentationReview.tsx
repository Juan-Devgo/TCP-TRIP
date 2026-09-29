import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, MonitorPlay, X } from "lucide-react";

import { Markdown } from "@/components/common/Markdown";
import { PresentationPlayer } from "@/components/common/PresentationPlayer";
import { PresentationStage } from "@/components/common/PresentationStage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  ApproveDialog,
  type SectionChoice,
} from "@/features/presentation-review/components/ApproveDialog";
import { refreshTheoryMenu } from "@/hooks/useTheoryMenu";
import {
  MAX_REVIEW_NOTE_LENGTH,
  PRESENTATION_STATUSES,
  type PresentationStatus,
} from "@/lib/presentations/contract";
import type { TheoryPlacement } from "@/lib/theory/contract";
import {
  approvePresentation,
  listReviewQueue,
  PresentationApiError,
  rejectPresentation,
  type PresentationInReview,
} from "@/services/presentations";
import { getTheoryMenuForAdmin } from "@/services/theory";
import { cn } from "@/lib/utils";

type State =
  | { status: "loading" }
  | { status: "ready"; queue: PresentationInReview[] }
  | { status: "forbidden" }
  | { status: "error" };

/**
 * The administrator's review panel: what teachers have submitted, and the
 * decision on each one.
 *
 * This is the one screen in the app that shows another user's unpublished work,
 * and it earns that by being the gate: **approving copies the document into
 * Theory**, so what students read is the version that was actually looked at
 * here, and a later edit by the author cannot change it.
 *
 * A rejection needs a reason — the server refuses one without a note, because
 * the note is the only channel back to the teacher.
 *
 * A first approval also decides **where** the presentation goes in the Theory
 * menu (`ApproveDialog`); an edit of something already published comes back
 * through the same queue with an `Edit` badge and keeps its place.
 */
export function PresentationReview() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<PresentationStatus>("pending");
  const [state, setState] = useState<State>({ status: "loading" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [presentingId, setPresentingId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<{
    entry: PresentationInReview;
    sections: SectionChoice[];
  } | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: "loading" });

    listReviewQueue(filter)
      .then((queue) => {
        if (!cancelled) setState({ status: "ready", queue });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof PresentationApiError && error.isForbidden) {
          setState({ status: "forbidden" });
          return;
        }
        console.error("Could not load the review queue", error);
        setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [filter]);

  useEffect(load, [load]);

  function drop(id: string) {
    setState((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            // Deciding takes it out of the queue it was in — the filter is a
            // status, so the row no longer belongs to this listing.
            queue: current.queue.filter((entry) => entry.id !== id),
          }
        : current,
    );
    setOpenId((current) => (current === id ? null : current));
  }

  /**
   * Approves at once when the presentation already has a place in the menu;
   * otherwise asks for one first. The menu is read fresh each time — another
   * admin may have filed or created something since this tab loaded.
   */
  async function requestApproval(entry: PresentationInReview) {
    setBusyId(entry.id);
    try {
      const { sections } = await getTheoryMenuForAdmin();
      const listed = sections.some((section) =>
        section.items.some((item) => item.presentationId === entry.id),
      );

      if (listed) {
        await approve(entry);
        return;
      }

      setPlacing({
        entry,
        sections: sections.map(({ id, label, icon }) => ({ id, label, icon })),
      });
    } catch (error) {
      report(t("presentations.review.toast.approve"), error);
    } finally {
      setBusyId(null);
    }
  }

  async function approve(entry: PresentationInReview, placement?: TheoryPlacement) {
    const title = t("presentations.review.toast.approve");
    setBusyId(entry.id);
    try {
      const published = await approvePresentation(
        entry.id,
        notes[entry.id] ?? "",
        placement,
      );
      setPlacing(null);
      drop(entry.id);
      // Approving can restore an entry that was hidden because this
      // presentation had been withdrawn, so the sidebar reloads.
      void refreshTheoryMenu();
      toast.add({
        title,
        type: "success",
        description: t("presentations.review.toast.approvedBody", {
          title: published.title,
        }),
      });
    } catch (error) {
      report(title, error);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(entry: PresentationInReview) {
    const title = t("presentations.review.toast.reject");
    const note = (notes[entry.id] ?? "").trim();

    if (note === "") {
      toast.add({
        title,
        type: "warning",
        description: t("presentations.review.noteRequired"),
      });
      return;
    }

    setBusyId(entry.id);
    try {
      await rejectPresentation(entry.id, note);
      drop(entry.id);
      toast.add({
        title,
        type: "success",
        description: t("presentations.review.toast.rejectedBody"),
      });
    } catch (error) {
      report(title, error);
    } finally {
      setBusyId(null);
    }
  }

  function report(title: string, error: unknown) {
    console.error(title, error);
    toast.add({
      title,
      type: "error",
      description: t(
        error instanceof PresentationApiError && error.isConflict
          ? "presentations.review.conflict"
          : "presentations.errors.generic",
      ),
    });
  }

  if (state.status === "forbidden") {
    return <p className="m-0">{t("presentations.review.forbidden")}</p>;
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="m-0">{t("presentations.review.title")}</h2>
        <p className="text-muted-foreground m-0 text-sm">
          {t("presentations.review.intro")}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {PRESENTATION_STATUSES.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={filter === status ? "default" : "outline"}
            onClick={() => setFilter(status)}
          >
            {t(`presentations.status.${status}`)}
          </Button>
        ))}
      </div>

      {state.status === "loading" && (
        <p className="text-muted-foreground m-0">{t("common.loading")}</p>
      )}

      {state.status === "error" && (
        <p className="text-destructive m-0">{t("presentations.errors.list")}</p>
      )}

      {state.status === "ready" && state.queue.length === 0 && (
        <p className="m-0">{t("presentations.review.empty")}</p>
      )}

      {state.status === "ready" &&
        state.queue.map((entry) => {
          const open = openId === entry.id;

          return (
            <article
              key={entry.id}
              className="border-border flex flex-col gap-3 rounded-md border px-3 py-3"
            >
              <header className="flex flex-wrap items-baseline gap-2">
                <h3 className="m-0 min-w-0 flex-1 truncate text-base">{entry.title}</h3>
                {/* Already live: approving replaces what readers see now. */}
                {entry.status === "pending" && entry.publishedSlug !== null && (
                  <Badge variant="secondary">{t("presentations.review.editBadge")}</Badge>
                )}
                <span className="text-muted-foreground text-xs">
                  {t("presentations.review.meta", {
                    author: entry.authorName,
                    topic: t(`presentations.topics.${entry.topic}`),
                    count: entry.document.slides.length,
                  })}
                </span>
              </header>

              {entry.submittedAt && (
                <p className="text-muted-foreground m-0 text-xs">
                  {t("presentations.review.submittedAt", {
                    date: new Date(entry.submittedAt).toLocaleString(),
                  })}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpenId(open ? null : entry.id)}>
                  {t(open ? "presentations.review.hide" : "presentations.review.read")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={entry.document.slides.length === 0}
                  onClick={() => setPresentingId(entry.id)}
                >
                  <MonitorPlay />
                  {t("presentations.review.present")}
                </Button>
              </div>

              {open && (
                <div className="flex flex-col gap-4">
                  {entry.document.markdown.trim() !== "" && (
                    <Markdown source={entry.document.markdown} />
                  )}

                  {entry.document.slides.map((slide, index) => (
                    <div key={slide.id} className="flex flex-col gap-1">
                      <span className="text-muted-foreground font-mono text-xs">
                        {index + 1}/{entry.document.slides.length}
                        {slide.title ? ` · ${slide.title}` : ""}
                      </span>
                      <PresentationStage
                        slide={slide}
                        canvas={entry.document.canvas}
                        className="border-border rounded-lg border"
                      />
                      {slide.notes && (
                        <p className="text-muted-foreground m-0 text-xs whitespace-pre-wrap">
                          {t("presentations.review.notes")}: {slide.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {entry.status === "pending" && (
                <>
                  <Field>
                    <FieldLabel htmlFor={`note-${entry.id}`}>
                      {t("presentations.review.note")}
                    </FieldLabel>
                    <Textarea
                      id={`note-${entry.id}`}
                      rows={2}
                      maxLength={MAX_REVIEW_NOTE_LENGTH}
                      value={notes[entry.id] ?? ""}
                      placeholder={t("presentations.review.notePlaceholder")}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [entry.id]: event.target.value,
                        }))
                      }
                    />
                    <p className="text-muted-foreground m-0 text-xs">
                      {t("presentations.review.noteHint")}
                    </p>
                  </Field>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busyId === entry.id}
                      onClick={() => void requestApproval(entry)}
                    >
                      <Check />
                      {t("presentations.review.approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busyId === entry.id}
                      onClick={() => void reject(entry)}
                    >
                      <X />
                      {t("presentations.review.reject")}
                    </Button>
                  </div>
                </>
              )}

              {entry.status !== "pending" && (
                <p
                  className={cn(
                    "m-0 text-sm",
                    entry.status === "published" ? "text-tertiary-ink" : "text-muted-foreground",
                  )}
                >
                  {t(`presentations.status.${entry.status}`)}
                  {entry.reviewNote ? ` · ${entry.reviewNote}` : ""}
                </p>
              )}

              {presentingId === entry.id && (
                <PresentationPlayer
                  document={entry.document}
                  onClose={() => setPresentingId(null)}
                />
              )}
            </article>
          );
        })}

      <ApproveDialog
        open={placing !== null}
        title={placing?.entry.title ?? ""}
        sections={placing?.sections ?? []}
        busy={placing !== null && busyId === placing.entry.id}
        onCancel={() => setPlacing(null)}
        onConfirm={(placement) => placing && void approve(placing.entry, placement)}
      />
    </section>
  );
}
