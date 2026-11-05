import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Binary,
  CaseSensitive,
  Hammer,
  Network,
  Puzzle,
  Sigma,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  findPage,
  isVisibleTo,
  type PageDefinition,
  type PagePath,
} from "@/config/navigation";

/**
 * The tools the home page suggests. Curated on purpose: only built pages a
 * student can use on their own — no teacher or admin page, and no placeholder.
 * The title comes from the nav node, so a card and its tab share one label.
 */
const FEATURED: readonly {
  path: PagePath;
  icon: LucideIcon;
  /** i18n key of the group the card is filed under. */
  categoryKey: string;
  /** i18n key of the one-line description. */
  descriptionKey: string;
}[] = [
  {
    path: "/tools/converters/number-bases",
    icon: Binary,
    categoryKey: "sidebar.tools.converters",
    descriptionKey: "home.featured.numberBases",
  },
  {
    path: "/tools/converters/ascii",
    icon: CaseSensitive,
    categoryKey: "sidebar.tools.converters",
    descriptionKey: "home.featured.ascii",
  },
  {
    path: "/tools/calculators/ipv4",
    icon: Network,
    categoryKey: "sidebar.tools.calculators",
    descriptionKey: "home.featured.ipv4",
  },
  {
    path: "/tools/calculators/fragmentation",
    icon: Puzzle,
    categoryKey: "sidebar.tools.calculators",
    descriptionKey: "home.featured.fragmentation",
  },
  {
    path: "/tools/calculators/checksum",
    icon: Sigma,
    categoryKey: "sidebar.tools.calculators",
    descriptionKey: "home.featured.checksum",
  },
  {
    path: "/generic-protocol/new",
    icon: Hammer,
    categoryKey: "sidebar.groups.protocol",
    descriptionKey: "home.featured.protocolBuilder",
  },
];

type FeaturedCard = (typeof FEATURED)[number] & { page: PageDefinition };

// A page that later gains a role stops being suggested instead of advertising
// a tab the student cannot use.
const STUDENT_CARDS: FeaturedCard[] = FEATURED.flatMap((item) => {
  const page = findPage(item.path);
  return page && isVisibleTo(page, "student") ? [{ ...item, page }] : [];
});

/** Shown when no tab is active — the app's "new tab page". */
export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="m-0">{t("home.title")}</h1>
        <p className="m-0 text-muted-foreground">{t("home.subtitle")}</p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="home-featured">
        <h2 id="home-featured" className="m-0 text-lg">
          {t("home.featured.title")}
        </h2>

        <ul className="m-0 grid list-none gap-4 pl-0 sm:grid-cols-2 lg:grid-cols-3">
          {STUDENT_CARDS.map(({ page, icon: Icon, categoryKey, descriptionKey }) => (
            <li key={page.path} className="m-0 p-0">
              <Link
                to={page.path}
                className="group block h-full rounded-xl no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-colors group-hover:bg-muted/50">
                  <CardHeader className="gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(categoryKey)}
                      </span>
                    </div>
                    <CardTitle className="flex items-center gap-1">
                      {t(page.titleKey)}
                      <ArrowRight
                        className="size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        aria-hidden
                      />
                    </CardTitle>
                    <CardDescription>{t(descriptionKey)}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="m-0 text-sm text-muted-foreground">{t("home.hint")}</p>
    </div>
  );
}
