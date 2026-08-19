import { Fragment } from "react";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { isPagePath } from "@/config/pages";

/** Path segment → i18n label key. Reuses the sidebar labels so a nav entry
 *  and its breadcrumb can never drift apart. Unknown segments fall back to
 *  the raw segment text. */
const SEGMENT_LABEL_KEYS: Record<string, string> = {
  tools: "sidebar.groups.tools",
  converters: "sidebar.tools.converters",
  calculators: "sidebar.tools.calculators",
  "number-bases": "sidebar.converters.numberBases",
  theory: "sidebar.groups.theory",
  "tcp-ip-model": "sidebar.theory.tcpIpModel",
  protocol: "sidebar.groups.protocol",
  new: "sidebar.protocol.builder",
  mine: "sidebar.protocol.mine",
  messages: "sidebar.protocol.messages",
};

export function AppBreadcrumb() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const segments = pathname.split("/").filter(Boolean);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {segments.length === 0 ? (
            <BreadcrumbPage>{t("breadcrumb.home")}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink render={<Link to="/" className="no-underline" />}>
              {t("breadcrumb.home")}
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {segments.map((segment, index) => {
          const to = `/${segments.slice(0, index + 1).join("/")}`;
          const labelKey = SEGMENT_LABEL_KEYS[segment];
          const label = labelKey ? t(labelKey) : segment;
          const isLast = index === segments.length - 1;

          return (
            <Fragment key={to}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : isPagePath(to) ? (
                  <BreadcrumbLink
                    render={<Link to={to} className="no-underline" />}
                  >
                    {label}
                  </BreadcrumbLink>
                ) : (
                  // Grouping segment, not a page — nothing to navigate to.
                  <span>{label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
