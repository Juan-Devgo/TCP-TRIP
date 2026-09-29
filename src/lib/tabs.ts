import { HOME_PATH, isPagePath } from "@/config/navigation";
import {
  createTabHistory,
  goBack,
  goForward,
  pushPath,
  type TabHistory,
} from "@/lib/tabHistory";

export type Tab = {
  id: string;
  /** The registered page this tab was opened at — its identity for dedup. */
  rootPath: string;
  history: TabHistory;
};

export type TabsState = {
  tabs: Tab[];
  /** `null` means the home screen: open tabs stay in the bar, none is active. */
  activeTabId: string | null;
  /**
   * The pathname this state has been reconciled with. React runs both of the
   * provider's effects against the same render, so until this catches up with
   * the URL the tab set still describes the *previous* location.
   */
  syncedPath: string | null;
};

export type TabsAction =
  /** `newTabId` is minted by the caller so the reducer stays pure. */
  | { type: "sync"; path: string; newTabId: string }
  | { type: "activate"; id: string }
  | { type: "close"; id: string }
  | { type: "move"; from: number; to: number }
  | { type: "back" }
  | { type: "forward" };

export const INITIAL_TABS_STATE: TabsState = {
  tabs: [],
  activeTabId: null,
  syncedPath: null,
};

export function findTab(state: TabsState, id: string | null): Tab | undefined {
  return state.tabs.find((tab) => tab.id === id);
}

/** The path the content area is showing — home when no tab is active. */
export function shownPath(state: TabsState): string {
  return findTab(state, state.activeTabId)?.history.current ?? HOME_PATH;
}

/**
 * Where the URL should be moved to, or `null` to leave it alone.
 *
 * Realigning is only safe once the state has been reconciled with the pathname
 * on screen. Before that, `shownPath` still describes the location we are
 * navigating *away from*, and pushing it back would fight the navigation in
 * flight — the two would then take turns undoing each other forever.
 */
export function urlRealignTarget(
  state: TabsState,
  pathname: string,
): string | null {
  if (state.syncedPath !== pathname) return null;
  const target = shownPath(state);
  return target === pathname ? null : target;
}

/** The closest registered page above `path`, or `null` when none is. */
function ownerPage(path: string): string | null {
  for (let end = path.lastIndexOf("/"); end > 0; end = path.lastIndexOf("/", end - 1)) {
    const candidate = path.slice(0, end);
    if (isPagePath(candidate)) return candidate;
  }
  return null;
}

function newTab(id: string, path: string): Tab {
  return { id, rootPath: path, history: createTabHistory(path) };
}

/**
 * Reconciles the tab set with the pathname the router is showing. The URL is
 * the single trigger for opening and focusing tabs, so every entry point —
 * sidebar link, breadcrumb, deep link, Clerk redirect — behaves the same.
 */
function syncToPath(state: TabsState, path: string, newTabId: string): TabsState {
  if (path === HOME_PATH) {
    return state.activeTabId === null ? state : { ...state, activeTabId: null };
  }

  const active = findTab(state, state.activeTabId);
  if (active?.history.current === path) return state;

  const showing = state.tabs.find((tab) => tab.history.current === path);
  if (showing) return { ...state, activeTabId: showing.id };

  if (isPagePath(path)) {
    // A link to the root of the tab on screen (its breadcrumb, a "back to the
    // list" button) is navigation inside that tab, like any other path —
    // focusing it instead would realign the URL right back to where it was.
    if (active?.rootPath === path) {
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === active.id
            ? { ...tab, history: pushPath(tab.history, path) }
            : tab,
        ),
      };
    }

    // One tab per page: reopening a page from elsewhere focuses its tab and
    // leaves it on whatever it had navigated to (the URL is realigned to it).
    const existing = state.tabs.find((tab) => tab.rootPath === path);
    if (existing) return { ...state, activeTabId: existing.id };

    const tab = newTab(newTabId, path);
    return { ...state, tabs: [...state.tabs, tab], activeTabId: tab.id };
  }

  // Not a page: navigation inside the page it sits under
  // (`/teacher/presentations/mine/<id>` belongs to `.../mine`). That page's tab
  // takes it — opened if need be, with the page one step back — so a reload or
  // a pasted link renders the page that knows the path, never a tab rooted at
  // the path itself.
  const owner = ownerPage(path);
  if (owner !== null) {
    const host =
      active?.rootPath === owner
        ? active
        : state.tabs.find((tab) => tab.rootPath === owner);

    if (host) {
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === host.id ? { ...tab, history: pushPath(tab.history, path) } : tab,
        ),
        activeTabId: host.id,
      };
    }

    const tab = { ...newTab(newTabId, owner), history: pushPath(createTabHistory(owner), path) };
    return { ...state, tabs: [...state.tabs, tab], activeTabId: tab.id };
  }

  // Under no page at all: navigation inside the tab currently on screen.
  if (active) {
    return {
      ...state,
      tabs: state.tabs.map((tab) =>
        tab.id === active.id
          ? { ...tab, history: pushPath(tab.history, path) }
          : tab,
      ),
    };
  }

  // Deep link with nothing open — give it a tab so it has somewhere to render.
  const tab = newTab(newTabId, path);
  return { ...state, tabs: [...state.tabs, tab], activeTabId: tab.id };
}

function mapActiveHistory(
  state: TabsState,
  update: (history: TabHistory) => TabHistory,
): TabsState {
  const active = findTab(state, state.activeTabId);
  if (!active) return state;
  const history = update(active.history);
  if (history === active.history) return state;
  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === active.id ? { ...tab, history } : tab,
    ),
  };
}

export function tabsReducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case "sync": {
      const next = syncToPath(state, action.path, action.newTabId);
      // Record the reconciliation even when the tabs themselves did not move —
      // that is what releases `urlRealignTarget`.
      return next.syncedPath === action.path
        ? next
        : { ...next, syncedPath: action.path };
    }

    case "activate":
      return state.activeTabId === action.id
        ? state
        : { ...state, activeTabId: action.id };

    case "close": {
      const index = state.tabs.findIndex((tab) => tab.id === action.id);
      if (index === -1) return state;
      const tabs = state.tabs.filter((tab) => tab.id !== action.id);
      if (state.activeTabId !== action.id) return { ...state, tabs };
      // After the removal, `index` is the former right neighbour.
      const next = tabs[index] ?? tabs[index - 1];
      return { ...state, tabs, activeTabId: next?.id ?? null };
    }

    case "move": {
      const tabs = [...state.tabs];
      const [moved] = tabs.splice(action.from, 1);
      if (!moved) return state;
      tabs.splice(action.to, 0, moved);
      return { ...state, tabs };
    }

    case "back":
      return mapActiveHistory(state, goBack);

    case "forward":
      return mapActiveHistory(state, goForward);
  }
}
