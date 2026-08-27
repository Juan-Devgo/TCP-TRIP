import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isPagePath } from "@/config/pages";
import { cn } from "@/lib/utils";

/** Path segment → i18n label key. Reuses the sidebar labels so a nav entry
 *  and its breadcrumb can never drift apart. Unknown segments fall back to
 *  the raw segment text. */
const SEGMENT_LABEL_KEYS: Record<string, string> = {
  tools: "sidebar.groups.tools",
  converters: "sidebar.tools.converters",
  calculators: "sidebar.tools.calculators",
  "number-bases": "sidebar.converters.numberBases",
  ascii: "sidebar.converters.ascii",
  ipv4: "sidebar.calculators.ipv4",
  theory: "sidebar.groups.theory",
  "tcp-ip-model": "sidebar.theory.tcpIpModel",
  protocol: "sidebar.groups.protocol",
  new: "sidebar.protocol.builder",
  mine: "sidebar.protocol.mine",
  messages: "sidebar.protocol.messages",
};

type Crumb = {
  /** Path this crumb stands for; also the React key. */
  path: string;
  label: string;
  /** Grouping segments (`/tools`) are not pages — nothing to navigate to. */
  navigable: boolean;
};

export function AppBreadcrumb({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const segments = pathname.split("/").filter(Boolean);

  const crumbs: Crumb[] = [
    { path: "/", label: t("breadcrumb.home"), navigable: segments.length > 0 },
    ...segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join("/")}`;
      const labelKey = SEGMENT_LABEL_KEYS[segment];
      return {
        path,
        label: labelKey ? t(labelKey) : segment,
        navigable: isPagePath(path),
      };
    }),
  ];

  const last = crumbs[crumbs.length - 1] as Crumb;
  const head = crumbs.length > 1 ? (crumbs[0] as Crumb) : null;
  const middle = crumbs.slice(1, -1);

  const { containerRef, measureRef, collapsed } = useOverflowCollapse(
    // A new signature forces a re-measure when the labels themselves change.
    crumbs.map((crumb) => crumb.label).join("/"),
  );
  const collapse = collapsed && middle.length > 0;

  return (
    <Breadcrumb className={cn("relative", className)} ref={containerRef}>
      <BreadcrumbList className="flex-nowrap whitespace-nowrap">
        {head && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/" className="no-underline" />}>
                {head.label}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}

        {collapse ? (
          <>
            <BreadcrumbItem>
              <CollapsedCrumbs crumbs={middle} label={t("breadcrumb.more")} />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : (
          middle.map((crumb) => (
            <Fragment key={crumb.path}>
              <BreadcrumbItem>
                {crumb.navigable ? (
                  <BreadcrumbLink
                    render={<Link to={crumb.path} className="no-underline" />}
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </Fragment>
          ))
        )}

        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">{last.label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>

      {/* Off-flow copy of the *uncollapsed* trail. Measuring it instead of the
          visible list keeps the decision stable: collapsing never shrinks what
          is being measured, so the two states cannot oscillate. */}
      <BreadcrumbList
        ref={measureRef}
        aria-hidden
        inert
        className="pointer-events-none invisible absolute top-0 left-0 w-max flex-nowrap whitespace-nowrap"
      >
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.path}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>{crumb.label}</BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** The crumbs the trail dropped, reachable from the `…` menu. */
function CollapsedCrumbs({ crumbs, label }: { crumbs: Crumb[]; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon-sm" variant="ghost">
            <BreadcrumbEllipsis />
            <span className="sr-only">{label}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          {crumbs.map((crumb) =>
            crumb.navigable ? (
              <DropdownMenuItem
                key={crumb.path}
                render={<Link to={crumb.path} className="no-underline" />}
              >
                {crumb.label}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={crumb.path} disabled>
                {crumb.label}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Collapses the trail as soon as its full width no longer fits the toolbar.
 * `signature` re-runs the measurement when the rendered text changes (route or
 * language), the observers handle every other resize.
 */
function useOverflowCollapse(signature: string) {
  const containerRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLOListElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const check = () => {
      // 1px of slack: sub-pixel layout must not toggle the menu on its own.
      setCollapsed(measure.scrollWidth > container.clientWidth + 1);
    };

    check();

    const observer = new ResizeObserver(check);
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [signature]);

  return useMemo(
    () => ({ containerRef, measureRef, collapsed }),
    [collapsed],
  );
}
