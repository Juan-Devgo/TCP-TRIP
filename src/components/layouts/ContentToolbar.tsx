import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";

import { AppBreadcrumb } from "@/components/common/AppBreadcrumb";
import { useTabs } from "@/context/TabsProvider";
import {
  shortcutKeys,
  shortcutLabel,
  useTabActions,
  useToolActionShortcuts,
} from "@/context/ToolActionsProvider";
import type { ActionShortcut } from "@/context/ToolActionsProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
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
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-2 sm:gap-4 sm:px-4">
      <div className="flex shrink-0 items-center">
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
      </div>
      
      <Separator
        orientation="vertical"
        className="h-4! data-vertical:self-center bg-sidebar-ring"
      />

      <AppBreadcrumb className="min-w-0 flex-1 overflow-hidden" />

      <div className="flex shrink-0 items-center gap-2">
        <ToolActions tabId={activeTabId} />
      </div>
    </div>
  );
}

function ToolActions({ tabId }: { tabId: string | null }) {
  const { t } = useTranslation();
  const actions = useTabActions(tabId);
  useToolActionShortcuts(tabId);

  if (actions.length === 0) return null;

  const [only] = actions;
  if (actions.length === 1 && only) {
    // Without an icon there would be nothing left to click on small screens,
    // so the label only collapses when an icon can stand in for it.
    const labelClassName = only.icon ? "hidden sm:inline" : undefined;
    const title = only.shortcut
      ? `${only.label} (${shortcutLabel(only.shortcut)})`
      : only.label;

    return (
      <Button
        variant={only.destructive ? "destructive" : "default"}
        size="default"
        disabled={only.disabled ?? false}
        onClick={only.onSelect}
        aria-label={title}
        title={title}
      >
        {only.icon}
        <span className={labelClassName}>{only.label}</span>
        {only.shortcut ? (
          <ActionShortcutKeys shortcut={only.shortcut} className="hidden sm:inline-flex" />
        ) : null}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="default"
            size="default"
            aria-label={t("actions.label")}
            title={t("actions.label")}
          >
            <span className="hidden sm:inline">{t("actions.label")}</span>
            <ChevronDown className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            variant={action.destructive ? "destructive" : "default"}
            disabled={action.disabled ?? false}
            onClick={action.onSelect}
          >
            {action.icon}
            {action.label}
            {action.shortcut ? (
              <ActionShortcutKeys shortcut={action.shortcut} className="ml-auto pl-4" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The `<Kbd>` badges for one action's hotkey. */
function ActionShortcutKeys({
  shortcut,
  className,
}: {
  shortcut: ActionShortcut;
  className?: string;
}) {
  return (
    <KbdGroup className={className} aria-hidden="true">
      {shortcutKeys(shortcut).map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </KbdGroup>
  );
}
