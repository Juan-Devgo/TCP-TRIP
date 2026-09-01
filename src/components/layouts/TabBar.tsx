import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { useTabs, type Tab } from "@/context/TabsProvider";
import { findPage } from "@/config/navigation";
import { cn } from "@/lib/utils";

/** Id shared by the tab button and its panel, so screen readers pair them. */
export function tabPanelId(tabId: string): string {
  return `tab-panel-${tabId}`;
}

export function tabButtonId(tabId: string): string {
  return `tab-${tabId}`;
}

export function TabBar() {
  const { t } = useTranslation();
  const { tabs, activeTabId, activateTab, closeTab, moveTab } = useTabs();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function titleOf(tab: Tab): string {
    const page = findPage(tab.rootPath);
    if (page) return t(page.titleKey);
    return tab.rootPath.split("/").filter(Boolean).at(-1) ?? tab.rootPath;
  }

  function endDrag() {
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div
      role="tablist"
      aria-label={t("tabs.label")}
      // `p-1 -m-1` gives rings (drop target, focus-visible) room inside the
      // clipping box without changing where the strip sits or how tall it is.
      className="-m-1 flex min-w-0 flex-1 items-center gap-3 overflow-y-hidden overflow-x-auto scrollbar-thin p-2.5"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const title = titleOf(tab);

        return (
          <ButtonGroup
            key={tab.id}
            // The tablist owns the ARIA roles; this wrapper is only a visual group.
            role="presentation"
            draggable
            onDragStart={(event) => {
              setDragIndex(index);
              event.dataTransfer.effectAllowed = "move";
              // Firefox only starts a drag once some data is set.
              event.dataTransfer.setData("text/plain", tab.id);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOverIndex(index);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex !== null && dragIndex !== index) {
                moveTab(dragIndex, index);
              }
              endDrag();
            }}
            onDragEnd={endDrag}
            data-active={isActive || undefined}
            data-dragging={dragIndex === index || undefined}
            data-over={
              (dragIndex !== null && dragIndex !== index && overIndex === index) ||
              undefined
            }
            className={cn(
              "group/tab w-44 min-w-24 shrink rounded-lg",
              "data-dragging:opacity-50",
              "data-over:ring-2 data-over:ring-tertiary",
            )}
          >
            <Button
              variant="outline"
              size="default"
              role="tab"
              id={tabButtonId(tab.id)}
              aria-selected={isActive}
              aria-controls={tabPanelId(tab.id)}
              title={title}
              onClick={() => activateTab(tab.id)}
              className={cn(
                "min-w-0 flex-1 justify-start overflow-hidden opacity-50 transition-opacity border-r-0!",
                "group-hover/tab:opacity-100 group-focus-within/tab:opacity-100",
                "group-data-active/tab:opacity-100",
                "group-data-active/tab:border-primary! group-data-active/tab:bg-primary/10!",
              )}
            >
              <span className="truncate">{title}</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t("tabs.close", { title })}
              onClick={() => closeTab(tab.id)}
              className={cn(
                "opacity-50 transition-opacity border-l-0!",
                "group-hover/tab:opacity-100 group-focus-within/tab:opacity-100",
                "group-data-active/tab:opacity-100",
                "group-data-active/tab:border-primary! group-data-active/tab:bg-primary/10!",
              )}
            >
              <X className="size-3.5" />
            </Button>
          </ButtonGroup>
        );
      })}
    </div>
  );
}
