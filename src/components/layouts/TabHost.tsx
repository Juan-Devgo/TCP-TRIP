import type { ComponentType } from "react";

import { tabButtonId, tabPanelId } from "@/components/layouts/TabBar";
import { TabScopeProvider, useTabs } from "@/context/TabsProvider";
import { AsciiConverter } from "@/features/ascii-converter";
import { IPv4Calculator } from "@/features/ipv4-calculator";
import { NumberBaseConverter } from "@/features/number-base-converter";
import { MyPresentations, PresentationEditor } from "@/features/presentation-editor";
import { PresentationReview } from "@/features/presentation-review";
import { ProtocolBuilder } from "@/features/protocol-builder";
import { TheoryMenuManager } from "@/features/admin-theory";
import { TheoryPresentationPage } from "@/features/theory-presentations";
import { findPage, type PagePath } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

/**
 * The component behind each page of `src/config/navigation.ts`. Keys are typed
 * as `PagePath`, the literal union derived from the nav tree: a misspelled or
 * stale path is a compile error, not a tab that silently falls back to the
 * placeholder. A page with no entry here renders the placeholder, so the
 * sidebar never opens a blank tab.
 */
const PAGE_COMPONENTS: Partial<Record<PagePath, ComponentType>> = {
  "/tools/converters/number-bases": NumberBaseConverter,
  "/tools/converters/ascii": AsciiConverter,
  "/tools/calculators/ipv4": IPv4Calculator,
  "/generic-protocol/new": ProtocolBuilder,
  "/theory/presentations": TheoryPresentationPage,
  "/teacher/presentations/new": PresentationEditor,
  "/teacher/presentations/mine": MyPresentations,
  "/admin/presentations": PresentationReview,
  "/admin/theory": TheoryMenuManager,
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
  const Page = PAGE_COMPONENTS[path as PagePath];
  if (Page) return <Page />;

  const page = findPage(path);
  if (page) return <PlaceholderPage titleKey={page.titleKey} />;

  return <NotFoundPage path={path} />;
}
