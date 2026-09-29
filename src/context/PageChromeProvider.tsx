import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * What a page tells the shell about the path it is showing, when the nav tree
 * cannot know it: navigation inside a tab (`/teacher/presentations/mine/<id>`)
 * lands on paths that are not nodes, so their crumb label is only known to the
 * page that renders them.
 */
type PageChromeStore = {
  /** Crumb label per pathname. A path belongs to one tab, so no tab key. */
  crumbLabels: Record<string, string>;
  setCrumbLabel: (path: string, label: string | null) => void;
};

const PageChromeContext = createContext<PageChromeStore | null>(null);

export function PageChromeProvider({ children }: { children: React.ReactNode }) {
  const [crumbLabels, setCrumbLabels] = useState<Record<string, string>>({});

  const setCrumbLabel = useCallback((path: string, label: string | null) => {
    setCrumbLabels((current) => {
      if (label === null) {
        if (!(path in current)) return current;
        const next = { ...current };
        delete next[path];
        return next;
      }
      return current[path] === label ? current : { ...current, [path]: label };
    });
  }, []);

  const value = useMemo(
    () => ({ crumbLabels, setCrumbLabel }),
    [crumbLabels, setCrumbLabel],
  );

  return <PageChromeContext value={value}>{children}</PageChromeContext>;
}

function useStore(): PageChromeStore {
  const store = useContext(PageChromeContext);
  if (!store) throw new Error("Page chrome must be used inside <PageChromeProvider>");
  return store;
}

/**
 * Labels the breadcrumb segment for `path` (e.g. a draft's title instead of
 * its id) while the calling component is mounted. `null` label = no override.
 */
export function useCrumbLabel(path: string | null, label: string | null): void {
  const { setCrumbLabel } = useStore();

  useEffect(() => {
    if (path === null || label === null) return;
    setCrumbLabel(path, label);
    return () => setCrumbLabel(path, null);
  }, [path, label, setCrumbLabel]);
}

/** The labels `AppBreadcrumb` prefers over the nav tree's and the raw text. */
export function useCrumbLabels(): Record<string, string> {
  return useStore().crumbLabels;
}

