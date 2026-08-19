import { useTranslation } from "react-i18next";

import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { ArrowLeft } from "@/components/icons/ArrowLeft";
import { ArrowRight } from "@/components/icons/ArrowRight";
import { ChevronDown } from "@/components/icons/ChevronDown";
import { useTabs } from "@/components/TabsProvider";
import { useTabActions } from "@/components/ToolActionsProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

/**
 * The bar above the page content: per-tab history buttons, the breadcrumb of
 * the tab on screen, and — pinned to the right — whatever actions the active
 * tool published.
 */
export function ContentToolbar() {
  const { t } = useTranslation();
  const { activeTabId, canGoBack, canGoForward, goBack, goForward } = useTabs();

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        disabled={!canGoBack}
        onClick={goBack}
        aria-label={t("nav.back")}
        title={t("nav.back")}
      >
        <ArrowLeft className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        disabled={!canGoForward}
        onClick={goForward}
        aria-label={t("nav.forward")}
        title={t("nav.forward")}
      >
        <ArrowRight className="size-5" />
      </Button>

      <Separator
        orientation="vertical"
        className="h-4! data-vertical:self-center bg-border"
      />

      <AppBreadcrumb />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ToolActions tabId={activeTabId} />
      </div>
    </div>
  );
}

function ToolActions({ tabId }: { tabId: string | null }) {
  const { t } = useTranslation();
  const actions = useTabActions(tabId);

  if (actions.length === 0) return null;

  const [only] = actions;
  if (actions.length === 1 && only) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={only.disabled ?? false}
        onClick={only.onSelect}
      >
        {only.icon}
        {only.label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            {t("actions.label")}
            <ChevronDown className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            disabled={action.disabled ?? false}
            onClick={action.onSelect}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
