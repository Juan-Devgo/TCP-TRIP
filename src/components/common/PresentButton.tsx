import { useTranslation } from "react-i18next";
import { Presentation } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useActivePresentable } from "@/context/PresentableProvider";

/**
 * The header's way into presentation mode. It exists only while the tab on
 * screen is presentable — the page declares that with `usePresentable` — and
 * looks like the theme toggle beside it.
 */
export function PresentButton() {
  const { t } = useTranslation();
  const presentable = useActivePresentable();

  if (!presentable) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={t("presentations.player.open")}
            onClick={presentable.open}
          >
            <Presentation className="size-[1.1rem]" />
          </Button>
        }
      />
      <TooltipContent side="bottom">{t("presentations.player.open")}</TooltipContent>
    </Tooltip>
  );
}
