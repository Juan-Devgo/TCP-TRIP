import { useTranslation } from "react-i18next";
import { Dumbbell, Trash2, Wand2 } from "lucide-react";

import { useToolActions } from "@/context/ToolActionsProvider";

/**
 * Publishes the ASCII converter's actions to the content toolbar. Renders
 * nothing: the layout decides whether they show as a button or a dropdown.
 */
export function AsciiConverterActions({
  onLoadExample,
  onGenerateExercises,
  onClear,
}: {
  onLoadExample: () => void;
  onGenerateExercises: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();

  useToolActions([
    {
      id: "example",
      label: t("tools.asciiConverter.actions.example"),
      icon: <Wand2 />,
      onSelect: onLoadExample,
    },
    {
      id: "exercises",
      label: t("tools.asciiConverter.actions.generateExercises"),
      icon: <Dumbbell />,
      onSelect: onGenerateExercises,
    },
    {
      id: "clear",
      label: t("tools.asciiConverter.actions.clear"),
      icon: <Trash2 />,
      destructive: true,
      // Modified so it stays live while the user is typing in the text fields.
      shortcut: { key: "Escape" },
      onSelect: onClear,
    },
  ]);

  return null;
}
