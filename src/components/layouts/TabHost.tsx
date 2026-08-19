import type { ComponentType } from "react";

import { tabButtonId, tabPanelId } from "@/components/layouts/TabBar";
import { TabScopeProvider, useTabs } from "@/components/TabsProvider";
import { NumberBaseConverter } from "@/components/tools/NumberBaseConverter";
import { findPage } from "@/config/pages";
import { cn } from "@/lib/utils";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

/**
 * Registered pages that already have a component. A page listed in
 * `src/config/pages.ts` without an entry here renders the placeholder, so the
 * sidebar never opens a blank tab.
 */
const PAGE_COMPONENTS: Record<string, ComponentType> = {
  "/tools/converters/number-bases": NumberBaseConverter,
};

export function TabHost() {
  const { tabs, activeTabId } = useTabs();

  return (
    <>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;

        return (
          <TabScopeProvider key={tab.id} tabId={tab.id} isActive={isActive}>
            {/* Inactive tabs stay mounted — that is what preserves their state.
                Anything global inside them must gate on `useIsTabActive()`. */}
            <div
              id={tabPanelId(tab.id)}
              role="tabpanel"
              aria-labelledby={tabButtonId(tab.id)}
              className={cn("w-full", !isActive && "hidden")}
            >
              <TabContent path={tab.rootPath} />
            </div>
          </TabScopeProvider>
        );
      })}

      {activeTabId === null && <HomePage />}
    </>
  );
}

function TabContent({ path }: { path: string }) {
  const Page = PAGE_COMPONENTS[path];
  if (Page) return <Page />;

  const page = findPage(path);
  if (page) return <PlaceholderPage titleKey={page.titleKey} />;

  return <NotFoundPage path={path} />;
}
