import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { Presentation } from "lucide-react";

import { PublishedPresentationView } from "@/features/theory-presentations/components/PublishedPresentationView";
import { PUBLISHED_PRESENTATION_PREFIX } from "@/lib/presentations/contract";

/** The slug the URL points at, or `null` when the tab is at its own root. */
export function publishedSlugFromPath(pathname: string): string | null {
  if (!pathname.startsWith(PUBLISHED_PRESENTATION_PREFIX)) return null;

  const slug = pathname.slice(PUBLISHED_PRESENTATION_PREFIX.length);
  return slug === "" ? null : decodeURIComponent(slug);
}

/**
 * The Theory reader: whichever published presentation the URL names.
 *
 * There is deliberately **no index here**. The Theory section's listing is the
 * sidebar itself — an administrator groups the approved presentations into
 * sections (`src/features/admin-theory`), so the navigation follows the course
 * instead of a generated list of everything that happens to be published.
 *
 * Opening one is navigation *inside this tab*: `/theory/presentations/<slug>`
 * is not a registered page, so the tab reducer pushes it onto this tab's own
 * history. The URL is a real link a teacher can hand out, and the toolbar's
 * back button walks the presentations the student has just read.
 */
export function TheoryPresentationPage() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const slug = publishedSlugFromPath(pathname);
  if (slug !== null) return <PublishedPresentationView slug={slug} />;

  return (
    <section className="flex flex-col items-start gap-3 py-8">
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
        <Presentation className="size-5" />
      </span>
      <h1 className="m-0">{t("presentations.read.emptyTitle")}</h1>
      <p className="text-muted-foreground m-0">{t("presentations.read.emptyHint")}</p>
    </section>
  );
}
