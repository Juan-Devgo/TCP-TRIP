import { useTranslation } from "react-i18next";
import { Download, Redo2, Save, Share2, Trash2, Undo2, Wand2 } from "lucide-react";

import { useToolActions } from "@/context/ToolActionsProvider";
import type { ActionShortcut } from "@/context/ToolActionsProvider";

// The card draws its own undo/redo buttons; both spellings of the hotkey come
// from here so the toolbar and the card can never drift apart.
export const UNDO_SHORTCUT: ActionShortcut = { ctrl: true, key: "z" };
export const REDO_SHORTCUT: ActionShortcut = { ctrl: true, key: "y" };

/**
 * Publishes the builder's actions to the content toolbar. Renders nothing: the
 * layout decides whether they show as a button or a dropdown.
 */
export function ProtocolBuilderActions({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onShare,
  onExport,
  onLoadExample,
  onClear,
  saving,
  isEmpty,
}: {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onShare: () => void;
  onExport: () => void;
  onLoadExample: () => void;
  onClear: () => void;
  saving: boolean;
  /** Nothing to share, export or clear while the canvas is untouched. */
  isEmpty: boolean;
}) {
  const { t } = useTranslation();

  useToolActions([
    {
      id: "save",
      label: t("tools.protocolBuilder.actions.save"),
      icon: <Save />,
      disabled: saving,
      // A bare letter, which the toolbar ignores while the caret is in a field.
      shortcut: { key: "s" },
      onSelect: onSave,
    },
    {
      id: "undo",
      label: t("tools.protocolBuilder.actions.undo"),
      icon: <Undo2 />,
      disabled: !canUndo,
      shortcut: UNDO_SHORTCUT,
      onSelect: onUndo,
    },
    {
      id: "redo",
      label: t("tools.protocolBuilder.actions.redo"),
      icon: <Redo2 />,
      disabled: !canRedo,
      shortcut: REDO_SHORTCUT,
      onSelect: onRedo,
    },
    {
      id: "share",
      label: t("tools.protocolBuilder.actions.share"),
      icon: <Share2 />,
      disabled: isEmpty,
      onSelect: onShare,
    },
    {
      id: "export",
      label: t("tools.protocolBuilder.actions.export"),
      icon: <Download />,
      disabled: isEmpty,
      onSelect: onExport,
    },
    {
      id: "example",
      label: t("tools.protocolBuilder.actions.example"),
      icon: <Wand2 />,
      onSelect: onLoadExample,
    },
    {
      id: "clear",
      label: t("tools.protocolBuilder.actions.clear"),
      icon: <Trash2 />,
      destructive: true,
      disabled: isEmpty,
      onSelect: onClear,
    },
  ]);

  return null;
}
