/**
 * The pages that open as tabs. A pathname listed here is a tab-openable page:
 * navigating to it focuses its tab or creates one. Any other pathname is
 * treated as navigation *inside* the active tab and lands on its history stack.
 *
 * Metadata only — no JSX — so the tab state layer can import it without pulling
 * in the page components. `TabHost` maps these paths to the components.
 */
export type PageDefinition = {
  /** Exact pathname that opens this page as a tab. */
  path: string;
  /** i18n key shared with the sidebar entry, so tab and nav labels can't drift. */
  titleKey: string;
};

/** Home is deliberately absent: it is the empty state, not a tab. */
export const HOME_PATH = "/";

export const PAGES: PageDefinition[] = [
  {
    path: "/tools/converters/number-bases",
    titleKey: "sidebar.converters.numberBases",
  },
  { path: "/protocol/new", titleKey: "sidebar.protocol.builder" },
  { path: "/protocol/mine", titleKey: "sidebar.protocol.mine" },
  { path: "/messages", titleKey: "sidebar.protocol.messages" },
];

const PAGES_BY_PATH = new Map(PAGES.map((page) => [page.path, page]));

export function findPage(path: string): PageDefinition | undefined {
  return PAGES_BY_PATH.get(path);
}

export function isPagePath(path: string): boolean {
  return PAGES_BY_PATH.has(path);
}
