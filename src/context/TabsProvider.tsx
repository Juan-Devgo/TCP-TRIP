import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { useLocation, useNavigate } from "react-router";

import { canGoBack, canGoForward } from "@/lib/tabHistory";
import {
  findTab,
  INITIAL_TABS_STATE,
  tabsReducer,
  urlRealignTarget,
  type Tab,
} from "@/lib/tabs";

export type { Tab } from "@/lib/tabs";

type TabsContextValue = {
  tabs: Tab[];
  activeTabId: string | null;
  activeTab: Tab | undefined;
  canGoBack: boolean;
  canGoForward: boolean;
  openPage: (path: string) => void;
  activateTab: (id: string) => void;
  closeTab: (id: string) => void;
  moveTab: (from: number, to: number) => void;
  goBack: () => void;
  goForward: () => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(tabsReducer, INITIAL_TABS_STATE);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // URL → tabs. The id is minted here rather than in the reducer so the
  // reducer stays pure under StrictMode's double invocation.
  useEffect(() => {
    dispatch({ type: "sync", path: pathname, newTabId: crypto.randomUUID() });
  }, [pathname]);

  // Tabs → URL. Activating, closing and going back/forward only move tab
  // state; this realigns the address bar with whatever is now on screen.
  // Both effects run against the same render, so the target is `null` while
  // the sync above is still pending — see `urlRealignTarget`.
  const realignTo = urlRealignTarget(state, pathname);
  useEffect(() => {
    if (realignTo !== null) navigate(realignTo, { replace: true });
  }, [realignTo, navigate]);

  const openPage = useCallback((path: string) => navigate(path), [navigate]);
  const activateTab = useCallback(
    (id: string) => dispatch({ type: "activate", id }),
    [],
  );
  const closeTab = useCallback((id: string) => dispatch({ type: "close", id }), []);
  const moveTab = useCallback(
    (from: number, to: number) => dispatch({ type: "move", from, to }),
    [],
  );
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const forward = useCallback(() => dispatch({ type: "forward" }), []);

  const activeTab = findTab(state, state.activeTabId);

  const value = useMemo<TabsContextValue>(
    () => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      activeTab,
      canGoBack: activeTab ? canGoBack(activeTab.history) : false,
      canGoForward: activeTab ? canGoForward(activeTab.history) : false,
      openPage,
      activateTab,
      closeTab,
      moveTab,
      goBack: back,
      goForward: forward,
    }),
    [state, activeTab, openPage, activateTab, closeTab, moveTab, back, forward],
  );

  return <TabsContext value={value}>{children}</TabsContext>;
}

export function useTabs(): TabsContextValue {
  const value = useContext(TabsContext);
  if (!value) throw new Error("useTabs must be used inside <TabsProvider>");
  return value;
}

type TabScope = { tabId: string; isActive: boolean };

const TabScopeContext = createContext<TabScope | null>(null);

/** Wraps one tab's content so anything inside knows which tab it belongs to. */
export function TabScopeProvider({
  tabId,
  isActive,
  children,
}: TabScope & { children: React.ReactNode }) {
  const value = useMemo(() => ({ tabId, isActive }), [tabId, isActive]);
  return <TabScopeContext value={value}>{children}</TabScopeContext>;
}

/** `null` outside a tab, so a tool can still be rendered on its own. */
export function useTabId(): string | null {
  return useContext(TabScopeContext)?.tabId ?? null;
}

/**
 * Inactive tabs stay mounted to keep their state, so anything global — a
 * `document` key listener, a timer, a title update — must be gated on this.
 * Defaults to `true` outside a tab.
 */
export function useIsTabActive(): boolean {
  return useContext(TabScopeContext)?.isActive ?? true;
}
