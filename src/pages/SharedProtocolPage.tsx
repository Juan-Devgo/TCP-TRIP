import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { LanguageToggle } from "@/components/common/LanguageToggle";
import { ModeToggle } from "@/components/common/ModeToggle";
import { HOME_PATH } from "@/config/navigation";
import { SharedProtocolView } from "@/features/protocol-builder";
import type { ProtocolDocument } from "@/features/protocol-builder";
import { SHARED_PROTOCOL_PREFIX } from "@/lib/protocols/contract";
import { getSharedProtocol } from "@/services/protocols";

type State =
  | { status: "loading" }
  | { status: "found"; document: ProtocolDocument }
  | { status: "missing" }
  | { status: "error" };

/**
 * What a share link opens: one protocol, read-only, **signed out**. It is
 * rendered outside the app shell (see `src/app.tsx`) — no sidebar, no tabs and
 * no sign-in wall, because the person following the link may have none of it.
 */
export function SharedProtocolPage({ shareId }: { shareId: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    getSharedProtocol(shareId)
      .then((shared) => {
        if (cancelled) return;
        setState(
          shared ? { status: "found", document: shared.document } : { status: "missing" },
        );
      })
      .catch((error: unknown) => {
        console.error("Could not load the shared protocol", error);
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [shareId]);

  return (
    <div className="min-h-svh bg-background">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
        <Link to={HOME_PATH} className="font-semibold">
          TCP-TRIP
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">{t("page.shared.badge")}</span>
          <LanguageToggle />
          <ModeToggle />
        </div>
      </header>

      <main className="typeset typeset-docs mx-auto w-full max-w-[52em] px-6 py-8">
        {state.status === "loading" && (
          <p className="text-muted-foreground">{t("page.shared.loading")}</p>
        )}

        {state.status === "found" && <SharedProtocolView document={state.document} />}

        {state.status !== "loading" && state.status !== "found" && (
          <div className="flex flex-col gap-2">
            <h1 className="m-0">
              {t(
                state.status === "missing"
                  ? "page.shared.notFound.title"
                  : "page.shared.error.title",
              )}
            </h1>
            <p className="m-0 text-muted-foreground">
              {t(
                state.status === "missing"
                  ? "page.shared.notFound.description"
                  : "page.shared.error.description",
              )}
            </p>
            <Link to={HOME_PATH} className="text-primary-ink">
              {t("page.shared.openApp")}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

/** The share id in a pathname, or `null` when the path is not a share link. */
export function sharedProtocolId(pathname: string): string | null {
  if (!pathname.startsWith(SHARED_PROTOCOL_PREFIX)) return null;

  const shareId = pathname.slice(SHARED_PROTOCOL_PREFIX.length).replace(/\/+$/, "");
  return shareId === "" ? null : decodeURIComponent(shareId);
}
