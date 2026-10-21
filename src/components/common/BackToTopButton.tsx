import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsTabActive } from "@/context/TabsProvider";
import { cn } from "@/lib/utils";

/** How far down the page has to be scrolled before the button shows. */
const SHOW_AFTER = 400;

/**
 * Floating button in the bottom-right corner that scrolls the page back to the
 * top, shown once a long tool has been scrolled past its inputs. Render it last
 * in the page so it paints over the content.
 */
export function BackToTopButton() {
  const { t } = useTranslation();
  const isActive = useIsTabActive();
  const [visible, setVisible] = useState(false);

  // Inactive tabs stay mounted: only the tab on screen listens to the scroll.
  useEffect(() => {
    if (!isActive) return;
    const update = () => setVisible(window.scrollY > SHOW_AFTER);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [isActive]);

  return (
    <Button
      type="button"
      size="icon-lg"
      aria-label={t("common.backToTop")}
      title={t("common.backToTop")}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        "fixed right-6 bottom-6 rounded-full shadow-lg transition-opacity",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ArrowUp />
    </Button>
  );
}
