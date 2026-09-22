import { useTranslation } from "react-i18next";
import { MonitorPlay, Save, Send, Undo2 } from "lucide-react";

import { useToolActions, type ToolAction } from "@/context/ToolActionsProvider";
import type { PresentationStatus } from "@/lib/presentations/contract";

/**
 * Publishes the editor's actions to the content toolbar. Renders nothing: the
 * layout decides whether they show as a button or a dropdown.
 *
 * Which actions exist depends on where the presentation is in the review
 * lifecycle, so the list is built from `status` rather than every action being
 * always present and sometimes disabled — a teacher should not see "Withdraw"
 * on a draft nobody has ever seen.
 */
export function PresentationEditorActions({
  status,
  dirty,
  busy,
  canPresent,
  onSave,
  onSubmit,
  onWithdraw,
  onPresent,
}: {
  /** `null` until the draft has been saved for the first time. */
  status: PresentationStatus | null;
  dirty: boolean;
  busy: boolean;
  canPresent: boolean;
  onSave: () => void;
  onSubmit: () => void;
  onWithdraw: () => void;
  onPresent: () => void;
}) {
  const { t } = useTranslation();

  const actions: ToolAction[] = [
    {
      id: "save",
      label: t(dirty ? "presentations.actions.save" : "presentations.actions.saved"),
      icon: <Save />,
      disabled: busy || !dirty,
      shortcut: { ctrl: true, key: "s" },
      onSelect: onSave,
    },
    {
      id: "present",
      label: t("presentations.actions.present"),
      icon: <MonitorPlay />,
      disabled: !canPresent,
      onSelect: onPresent,
    },
  ];

  // Submitting only makes sense once there is something saved to submit, and
  // only from a state the server will accept (the same guard as the query).
  if (status !== null && status !== "pending") {
    actions.push({
      id: "submit",
      label: t(
        status === "published"
          ? "presentations.actions.submitUpdate"
          : "presentations.actions.submit",
      ),
      icon: <Send />,
      disabled: busy,
      onSelect: onSubmit,
    });
  }

  if (status === "pending" || status === "published") {
    actions.push({
      id: "withdraw",
      label: t(
        status === "pending"
          ? "presentations.actions.cancelSubmission"
          : "presentations.actions.unpublish",
      ),
      icon: <Undo2 />,
      destructive: status === "published",
      disabled: busy,
      onSelect: onWithdraw,
    });
  }

  useToolActions(actions);

  return null;
}
