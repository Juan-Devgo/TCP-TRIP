import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ChevronDown, CircleAlert, CircleCheck, CircleDashed, Clock, FileEdit } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  publishedPresentationPath,
  type PresentationStatus,
} from "@/lib/presentations/contract";
import type { SavedPresentation } from "@/services/presentations";
import { cn } from "@/lib/utils";

/** Semantic tokens only — status colour is meaning, not decoration. */
const TONE: Record<PresentationStatus | "unsaved", string> = {
  unsaved: "text-muted-foreground",
  draft: "text-muted-foreground",
  pending: "text-primary-ink",
  published: "text-tertiary-ink",
  rejected: "text-destructive",
};

const ICON: Record<
  PresentationStatus | "unsaved",
  React.ComponentType<{ className?: string }>
> = {
  unsaved: CircleDashed,
  draft: FileEdit,
  pending: Clock,
  published: CircleCheck,
  rejected: CircleAlert,
};

/**
 * Whether edits are being written on their own: `off` until the presentation
 * has a name, `paused` while it waits for review.
 */
export type AutosaveState = "on" | "paused" | "off";

/**
 * Where this presentation stands with the administrators, as one compact
 * button that sits next to the title — the title row is where a teacher looks
 * to know what they are editing, so that is where its state goes.
 *
 * The button says the status and whether there are unsaved changes; opening it
 * tells the rest: the autosave state (so a teacher never has to wonder whether
 * the last edit is stored), the link to the published copy, and the
 * **rejection note**, which is the only channel from the reviewer back to the
 * author — a teacher whose presentation was refused has to be able to read why
 * without leaving the editor.
 *
 * A published presentation that is being edited says so, because the two are
 * not the same thing any more — Theory keeps serving the approved snapshot
 * until a new submission is approved.
 */
export function PresentationStatusBadge({
  saved,
  dirty,
  autosave,
}: {
  saved: SavedPresentation | null;
  dirty: boolean;
  autosave: AutosaveState;
}) {
  const { t } = useTranslation();
  const status = saved?.status ?? "unsaved";
  const Icon = ICON[status];
  const label = t(saved ? `presentations.status.${saved.status}` : "presentations.status.new");

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className={cn("shrink-0", TONE[status])}>
            <Icon />
            {label}
            {dirty && (
              <span
                className="bg-primary size-1.5 rounded-full"
                aria-label={t("presentations.status.unsavedChanges")}
              />
            )}
            <ChevronDown className="text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent side="bottom" align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle className={cn("flex items-center gap-2", TONE[status])}>
            <Icon className="size-4" />
            {label}
          </PopoverTitle>
          <PopoverDescription>
            {t(`presentations.status.autosave.${autosave}`)}
            {dirty && ` · ${t("presentations.status.unsavedChanges")}`}
          </PopoverDescription>
        </PopoverHeader>

        {!saved && <p className="m-0 text-sm">{t("presentations.status.unsaved")}</p>}

        {saved?.status === "published" && saved.publishedSlug && (
          <p className="m-0 text-sm">
            <Link to={publishedPresentationPath(saved.publishedSlug)}>
              {t("presentations.status.viewPublished")}
            </Link>
            {dirty && (
              <span className="text-muted-foreground">
                {" "}
                · {t("presentations.status.publishedIsSnapshot")}
              </span>
            )}
          </p>
        )}

        {saved?.status === "rejected" && saved.reviewNote && (
          <p className="m-0 text-sm">
            <span className="font-medium">{t("presentations.status.reason")}:</span>{" "}
            {saved.reviewNote}
          </p>
        )}

        {saved?.status === "pending" && (
          <p className="text-muted-foreground m-0 text-sm">
            {t("presentations.status.pendingHint")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
