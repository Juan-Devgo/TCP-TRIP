import { useTranslation } from "react-i18next";

/** A registered page whose component is not built yet. */
export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 py-8">
      <h1 className="m-0">{t(titleKey)}</h1>
      <p className="m-0 text-muted-foreground">{t("page.pending")}</p>
    </div>
  );
}
