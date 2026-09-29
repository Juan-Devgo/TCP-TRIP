import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useTabId, useTabs } from "@/context/TabsProvider";

/**
 * A page that can be projected. The page owns *what* it projects — it opens
 * the shared `PresentationPlayer` itself — and the header owns the button that
 * asks it to.
 */
export type Presentable = {
  /** Opens the page's presentation mode. Looked up at click time, never stale. */
  open: () => void;
};

type PresentableStore = {
  byTab: Record<string, true>;
  handlers: React.RefObject<Record<string, () => void>>;
  publish: (tabId: string, open: (() => void) | null) => void;
};

const PresentableContext = createContext<PresentableStore | null>(null);

/**
 * Which tabs are presentable right now. Kept per tab for the same reason as the
 * tool actions: inactive tabs stay mounted, so a hidden page must not light up
 * the header button of the page on screen.
 */
export function PresentableProvider({ children }: { children: React.ReactNode }) {
  const [byTab, setByTab] = useState<Record<string, true>>({});
  const handlers = useRef<Record<string, () => void>>({});

  const publish = useCallback((tabId: string, open: (() => void) | null) => {
    if (open === null) {
      delete handlers.current[tabId];
    } else {
      handlers.current[tabId] = open;
    }

    setByTab((current) => {
      if ((open !== null) === (tabId in current)) return current;
      if (open !== null) return { ...current, [tabId]: true };

      const next = { ...current };
      delete next[tabId];
      return next;
    });
  }, []);

  const value = useMemo(() => ({ byTab, handlers, publish }), [byTab, publish]);

  return <PresentableContext value={value}>{children}</PresentableContext>;
}

function useStore(): PresentableStore {
  const store = useContext(PresentableContext);
  if (!store) {
    throw new Error("Presentable pages must be used inside <PresentableProvider>");
  }
  return store;
}

/**
 * Declares the calling page presentable — or not, with `null` (a deck with no
 * slides, a page still loading). Outside a tab it is a no-op, so a page can
 * still be mounted on its own.
 */
export function usePresentable(presentable: Presentable | null): void {
  const tabId = useTabId();
  const { publish } = useStore();

  const latest = useRef(presentable);
  latest.current = presentable;

  const available = presentable !== null;

  useEffect(() => {
    if (!tabId || !available) return;

    publish(tabId, () => latest.current?.open());
    return () => publish(tabId, null);
  }, [tabId, available, publish]);
}

/** The tab on screen's presentation mode, or `null` when it has none. */
export function useActivePresentable(): Presentable | null {
  const { activeTabId } = useTabs();
  const { byTab, handlers } = useStore();

  if (!activeTabId || !byTab[activeTabId]) return null;

  return {
    open: () => handlers.current[activeTabId]?.(),
  };
}
