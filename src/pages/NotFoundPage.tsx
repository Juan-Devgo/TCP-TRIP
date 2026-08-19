import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { HOME_PATH } from "@/config/pages";

export function NotFoundPage({ path }: { path: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 py-8">
      <h1 className="m-0">{t("page.notFound.title")}</h1>
      <p className="m-0 text-muted-foreground">
        {t("page.notFound.description", { path })}
      </p>
      <Link to={HOME_PATH} className="text-primary-ink">
        {t("breadcrumb.home")}
      </Link>
    </div>
  );
}
