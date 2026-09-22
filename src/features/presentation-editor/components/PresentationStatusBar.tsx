import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { CircleAlert, CircleCheck, Clock, FileEdit } from "lucide-react";

import {
  publishedPresentationPath,
  type PresentationStatus,
} from "@/lib/presentations/contract";
import type { SavedPresentation } from "@/services/presentations";
import { cn } from "@/lib/utils";

/** Semantic tokens only — status colour is meaning, not decoration. */
const TONE: Record<PresentationStatus, string> = {
  draft: "text-muted-foreground",
  pending: "text-primary-ink",
  published: "text-tertiary-ink",
  rejected: "text-destructive",
};

const ICON: Record<PresentationStatus, React.ComponentType<{ className?: string }>> = {
  draft: FileEdit,
  pending: Clock,
  published: CircleCheck,
  rejected: CircleAlert,
};

/**
 * Where this presentation stands with the administrators, in one line.
 *
 * It also carries the **rejection note**, which is the only channel from the
 * reviewer back to the author: a teacher whose presentation was refused has to
 * be able to read why without leaving the editor.
 *
 * A published presentation that is being edited says so, because the two are
 * not the same thing any more — Theory keeps serving the approved snapshot
 * until a new submission is approved.
 */
export function PresentationStatusBar({
  saved,
  dirty,
}: {
  saved: SavedPresentation | null;
  dirty: boolean;
}) {
  const { t } = useTranslation();

  if (!saved) {
    return (
      <p className="text-muted-foreground m-0 text-sm">
        {t("presentations.status.unsaved")}
      </p>
    );
  }

  const Icon = ICON[saved.status];

  return (
    <div className="border-border flex flex-col gap-1 rounded-md border px-3 py-2">
      <p className={cn("m-0 flex items-center gap-2 text-sm font-medium", TONE[saved.status])}>
        <Icon className="size-4" />
        {t(`presentations.status.${saved.status}`)}
        {dirty && (
          <span className="text-muted-foreground font-normal">
            · {t("presentations.status.unsavedChanges")}
          </span>
        )}
      </p>

      {saved.status === "published" && saved.publishedSlug && (
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

      {saved.status === "rejected" && saved.reviewNote && (
        <p className="m-0 text-sm">
          <span className="font-medium">{t("presentations.status.reason")}:</span>{" "}
          {saved.reviewNote}
        </p>
      )}

      {saved.status === "pending" && (
        <p className="text-muted-foreground m-0 text-sm">
          {t("presentations.status.pendingHint")}
        </p>
      )}
    </div>
  );
}
