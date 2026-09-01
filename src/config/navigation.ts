import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Calculator,
  FolderOpen,
  Layers,
  MessagesSquare,
  PenLine,
} from "lucide-react";

/**
 * The single source of navigation truth: sidebar, breadcrumb, tab registry and
 * the `TabHost` component map are all derived from this tree.
 *
 * Adding a page = adding one node here (segment + titleKey [+ icon] [+ page])
 * and one entry in `PAGE_COMPONENTS` (`TabHost`). Paths are never written by
 * hand — they are the join of a node's ancestors' segments — so the sidebar
 * link, the tab registry and the breadcrumb label cannot drift apart.
 *
 * Metadata only — no JSX, no feature imports — so the pure tab state layer
 * (`src/lib/tabs.ts`) can import it without pulling in the page components.
 */
export type NavNode = {
  /** One path segment. The full path is the join with its ancestors. */
  readonly segment: string;
  /** i18n key. The same key labels the sidebar entry, the tab and the crumb. */
  readonly titleKey: string;
  /** Sidebar icon. Groups (depth 0) don't take one. */
  readonly icon?: LucideIcon;
  /**
   * Present = this node opens as a tab. `{ wide: true }` opts the page out of
   * the reading-width column (a canvas page, e.g. the protocol diagram).
   */
  readonly page?: true | { readonly wide: true };
  /**
   * Present = a branch: a sidebar group (depth 0) or a collapsible section
   * (depth 1). An empty array is a section that has no pages yet — it renders
   * the "no items" hint. Absent = a leaf link.
   */
  readonly children?: readonly NavNode[];
};

export const NAVIGATION = [
  {
    segment: "tools",
    titleKey: "sidebar.groups.tools",
    children: [
      {
        segment: "converters",
        titleKey: "sidebar.tools.converters",
        icon: ArrowLeftRight,
        children: [
          {
            segment: "number-bases",
            titleKey: "sidebar.converters.numberBases",
            page: true,
          },
          {
            segment: "ascii",
            titleKey: "sidebar.converters.ascii",
            page: true,
          },
        ],
      },
      {
        segment: "calculators",
        titleKey: "sidebar.tools.calculators",
        icon: Calculator,
        children: [
          {
            segment: "ipv4",
            titleKey: "sidebar.calculators.ipv4",
            page: true,
          },
        ],
      },
    ],
  },
  {
    segment: "theory",
    titleKey: "sidebar.groups.theory",
    children: [
      {
        segment: "tcp-ip-model",
        titleKey: "sidebar.theory.tcpIpModel",
        icon: Layers,
        children: [],
      },
    ],
  },
  {
    segment: "generic-protocol",
    titleKey: "sidebar.groups.protocol",
    children: [
      {
        segment: "new",
        titleKey: "sidebar.protocol.builder",
        icon: PenLine,
        page: { wide: true },
      },
      {
        segment: "mine",
        titleKey: "sidebar.protocol.mine",
        icon: FolderOpen,
        page: true,
      },
      {
        segment: "messages",
        titleKey: "sidebar.protocol.messages",
        icon: MessagesSquare,
        page: true,
      },
    ],
  },
] as const satisfies readonly NavNode[];

/** Home is deliberately absent from the tree: it is the empty state, not a tab. */
export const HOME_PATH = "/";

/**
 * Every tab-openable pathname, as a literal union built from the tree above.
 * `TabHost` keys its component map on it, so a stale or misspelled path is a
 * compile error instead of a tab that silently falls back to the placeholder.
 */
export type PagePath = PagePathsOf<typeof NAVIGATION, "">;

type PagePathsOf<Nodes, Prefix extends string> = Nodes extends readonly [
  infer Head,
  ...infer Tail,
]
  ? (Head extends { readonly segment: infer S extends string }
      ?
          | (Head extends { readonly page: unknown } ? `${Prefix}/${S}` : never)
          | (Head extends { readonly children: infer C }
              ? PagePathsOf<C, `${Prefix}/${S}`>
              : never)
      : never)
      | PagePathsOf<Tail, Prefix>
  : never;

/** A node with its resolved absolute path — what the sidebar renders. */
export type NavItem = {
  path: string;
  titleKey: string;
  icon?: LucideIcon;
  /** The tab this item opens, or `null` for a pure grouping node. */
  page: PageDefinition | null;
  /** `true` for a group/section (renders a collapsible), `false` for a link. */
  branch: boolean;
  children: NavItem[];
};

/** What the tab layer needs: the pathname that opens a tab, and its label. */
export type PageDefinition = {
  path: string;
  titleKey: string;
  /** Opts the page out of the reading-width column. `MainLayout` reads it. */
  wide?: true;
};

function build(nodes: readonly NavNode[], prefix: string): NavItem[] {
  return nodes.map((node) => {
    const path = `${prefix}/${node.segment}`;
    return {
      path,
      titleKey: node.titleKey,
      ...(node.icon ? { icon: node.icon } : {}),
      page: node.page
        ? {
            path,
            titleKey: node.titleKey,
            ...(node.page !== true && node.page.wide ? { wide: true as const } : {}),
          }
        : null,
      branch: node.children !== undefined,
      children: build(node.children ?? [], path),
    };
  });
}

/** The tree with absolute paths. Top level = sidebar groups. */
export const NAV_TREE: NavItem[] = build(NAVIGATION, "");

const ITEMS_BY_PATH = new Map<string, NavItem>();
for (const item of flatten(NAV_TREE)) ITEMS_BY_PATH.set(item.path, item);

function* flatten(items: NavItem[]): Generator<NavItem> {
  for (const item of items) {
    yield item;
    yield* flatten(item.children);
  }
}

/** Every page that opens as a tab, in sidebar order. */
export const PAGES: PageDefinition[] = [...ITEMS_BY_PATH.values()]
  .map((item) => item.page)
  .filter((page): page is PageDefinition => page !== null);

/** Any node, page or grouping — the breadcrumb resolves its labels with this. */
export function findNavItem(path: string): NavItem | undefined {
  return ITEMS_BY_PATH.get(path);
}

export function findPage(path: string): PageDefinition | undefined {
  return ITEMS_BY_PATH.get(path)?.page ?? undefined;
}

export function isPagePath(path: string): boolean {
  return findPage(path) !== undefined;
}
