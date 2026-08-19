import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Close } from "@/components/icons/Close";
import { useTabs, type Tab } from "@/components/TabsProvider";
import { findPage } from "@/config/pages";
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
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:thin]"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const title = titleOf(tab);

        return (
          <div
            key={tab.id}
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
              "group/tab flex h-9 w-44 min-w-24 shrink items-center gap-1 rounded-lg",
              "border border-transparent pr-1 pl-2.5 transition-colors",
              "text-sidebar-foreground/70 hover:bg-sidebar-accent",
              "data-active:border-sidebar-border data-active:bg-background data-active:text-foreground",
              "data-dragging:opacity-50",
              "data-over:border-primary",
            )}
          >
            <button
              type="button"
              role="tab"
              id={tabButtonId(tab.id)}
              aria-selected={isActive}
              aria-controls={tabPanelId(tab.id)}
              title={title}
              onClick={() => activateTab(tab.id)}
              className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm outline-none"
            >
              {title}
            </button>
            <button
              type="button"
              aria-label={t("tabs.close", { title })}
              onClick={() => closeTab(tab.id)}
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-md opacity-0 transition-opacity",
                "hover:bg-sidebar-accent focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
                "group-hover/tab:opacity-100 group-data-active/tab:opacity-100",
              )}
            >
              <Close className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
