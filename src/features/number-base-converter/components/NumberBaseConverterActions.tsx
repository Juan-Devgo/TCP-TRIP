import { useTranslation } from "react-i18next";
import { Dumbbell } from "lucide-react";

import { useToolActions } from "@/context/ToolActionsProvider";

/**
 * Publishes the converter's actions to the content toolbar. Renders nothing:
 * the layout decides whether they show as a button or a dropdown.
 */
export function NumberBaseConverterActions({
  onGenerateExercises,
}: {
  onGenerateExercises: () => void;
}) {
  const { t } = useTranslation();

  useToolActions([
    {
      id: "excercises",
      label: t("tools.numberBaseConverter.actions.generateExercises"),
      icon: <Dumbbell />,
      onSelect: onGenerateExercises,
    },
  ]);

  return null;
}
