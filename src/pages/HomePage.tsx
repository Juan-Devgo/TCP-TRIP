import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { PAGES } from "@/config/pages";

/** Shown when no tab is active — the app's "new tab page". */
export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="m-0">{t("home.title")}</h1>
        <p className="m-0 text-muted-foreground">{t("home.subtitle")}</p>
      </div>

      <ul className="grid list-none gap-3 pl-0 sm:grid-cols-2">
        {PAGES.map((page) => (
          <li key={page.path} className="m-0">
            <Link
              to={page.path}
              className="flex h-full items-center rounded-lg border border-border p-4 font-medium no-underline transition-colors hover:bg-muted"
            >
              {t(page.titleKey)}
            </Link>
          </li>
        ))}
      </ul>

      <p className="m-0 text-sm text-muted-foreground">{t("home.hint")}</p>
    </div>
  );
}
