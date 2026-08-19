import { useTranslation } from "react-i18next";
import { Copy, Delete } from "lucide-react";

import { useToolActions } from "@/components/ToolActionsProvider";

/**
 * Publishes the converter's actions to the content toolbar. Renders nothing:
 * the layout decides whether they show as a button or a dropdown.
 */
export function NumberBaseConverterActions({
  onCopyResult,
  onClear,
}: {
  onCopyResult: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();

  useToolActions([
    {
      id: "copy-result",
      label: t("tools.numberBaseConverter.actions.copyResult"),
      icon: <Copy />,
      onSelect: onCopyResult,
    },
    {
      id: "clear",
      label: t("tools.numberBaseConverter.actions.clear"),
      icon: <Delete />,
      onSelect: onClear,
    },
  ]);

  return null;
}
