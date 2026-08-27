import { useTranslation } from "react-i18next";
import { Dumbbell, Trash2, Wand2 } from "lucide-react";

import { useToolActions } from "@/context/ToolActionsProvider";

/**
 * Publishes the IPv4 calculator's actions to the content toolbar. Renders
 * nothing: the layout decides whether they show as a button or a dropdown.
 */
export function IPv4CalculatorActions({
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
      label: t("tools.ipv4Calculator.actions.example"),
      icon: <Wand2 />,
      onSelect: onLoadExample,
    },
    {
      id: "exercises",
      label: t("tools.ipv4Calculator.actions.generateExercises"),
      icon: <Dumbbell />,
      onSelect: onGenerateExercises,
    },
    {
      id: "clear",
      label: t("tools.ipv4Calculator.actions.clear"),
      icon: <Trash2 />,
      destructive: true,
      shortcut: { key: "Escape" },
      onSelect: onClear,
    },
  ]);

  return null;
}
