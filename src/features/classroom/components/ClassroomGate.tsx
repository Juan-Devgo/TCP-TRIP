import { useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, PlugZap, RefreshCw, School, Unplug } from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ALL_CLASSROOM_SCOPES,
  disabledFeatures,
  type ClassroomFeature,
  type ClassroomStatus,
} from "@/lib/classroom";
import {
  isConnectionError,
  useClassroomStatus,
  useDisconnectClassroom,
} from "@/services/classroom";

/**
 * Starts Google's consent screen for the Classroom scopes, on top of the
 * teacher's existing Clerk account: a Google account already linked is
 * reauthorized with the extra scopes, otherwise one is linked. Google sends
 * the browser back to the page it left.
 */
export function useConnectClassroom() {
  const { user } = useUser();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function connect() {
    if (!user) return;
    setPending(true);
    setFailed(false);
    try {
      const redirectUrl = window.location.href;
      const google = user.externalAccounts.find((account) => account.provider === "google");
      const account = google
        ? await google.reauthorize({
            additionalScopes: ALL_CLASSROOM_SCOPES,
            redirectUrl,
            // Forces the consent screen, so Google issues a fresh refresh token
            // even when a previous grant was revoked.
            oidcPrompt: "consent",
          })
        : await user.createExternalAccount({
            strategy: "oauth_google",
            redirectUrl,
            additionalScopes: ALL_CLASSROOM_SCOPES,
            oidcPrompt: "consent",
          });
      const target = account.verification?.externalVerificationRedirectURL;
      if (!target) throw new Error("Clerk returned no Google redirect URL");
      window.location.assign(target.toString());
    } catch (error) {
      console.error("Failed to start the Google connection", error);
      setFailed(true);
      setPending(false);
    }
  }

  return { connect, pending, failed };
}

function FeatureList({ features }: { features: ClassroomFeature[] }) {
  const { t } = useTranslation();
  return (
    <ul className="m-0 mt-1 pl-5">
      {features.map((feature) => (
        <li key={feature}>{t(`teacher.connection.features.${feature}`)}</li>
      ))}
    </ul>
  );
}

/**
 * Renders its children only once Classroom is connected. Before that it
 * explains what TCP-TRIP will do with the account and offers the connect
 * button; after a partial consent it names the features left disabled.
 */
export function ClassroomGate({
  children,
  needs,
}: {
  children: (status: ClassroomStatus) => React.ReactNode;
  /** The features this page cannot work without. */
  needs: ClassroomFeature[];
}) {
  const { t } = useTranslation();
  const status = useClassroomStatus();
  const { connect, pending, failed } = useConnectClassroom();

  if (status.isPending) {
    return (
      <div className="flex flex-col gap-3 py-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (status.isError) {
    return (
      <Alert variant="destructive" className="my-6">
        <AlertDescription>{t("teacher.connection.statusError")}</AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline" onClick={() => void status.refetch()}>
            {t("teacher.common.retry")}
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  const disabled = disabledFeatures(status.data.grantedScopes);
  const blocking = needs.filter((feature) => disabled.includes(feature));

  if (!status.data.connected || status.data.needsReconnect || blocking.length > 0) {
    const reconnect = status.data.needsReconnect;
    const partial = status.data.connected && !reconnect;
    return (
      <Empty className="my-6 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <School />
          </EmptyMedia>
          <EmptyTitle>
            {reconnect
              ? t("teacher.connection.reconnectTitle")
              : partial
                ? t("teacher.connection.partialTitle")
                : t("teacher.connection.title")}
          </EmptyTitle>
          <EmptyDescription>
            {reconnect
              ? t("teacher.connection.reconnectDescription")
              : partial
                ? t("teacher.connection.partialDescription")
                : t("teacher.connection.description")}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {!reconnect && !partial && (
            <ul className="m-0 pl-5 text-left text-sm text-muted-foreground">
              <li>{t("teacher.connection.will.courses")}</li>
              <li>{t("teacher.connection.will.assign")}</li>
              <li>{t("teacher.connection.will.drive")}</li>
              <li>{t("teacher.connection.will.never")}</li>
            </ul>
          )}
          {partial && (
            <div className="text-left text-sm text-muted-foreground">
              <FeatureList features={disabled} />
            </div>
          )}
          <Button disabled={pending} onClick={() => void connect()}>
            {pending ? <Loader2 className="animate-spin" /> : <PlugZap />}
            {reconnect || partial ? t("teacher.connection.retry") : t("teacher.connection.connect")}
          </Button>
          {failed && <p className="m-0 text-sm text-destructive">{t("teacher.connection.connectFailed")}</p>}
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <>
      {disabled.length > 0 && (
        <Alert className="mt-6">
          <AlertTitle>{t("teacher.connection.partialTitle")}</AlertTitle>
          <AlertDescription>
            <FeatureList features={disabled} />
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => void connect()}>
              {t("teacher.connection.retry")}
            </Button>
          </AlertAction>
        </Alert>
      )}
      {children(status.data)}
    </>
  );
}

/**
 * A Google failure mid-action (token revoked, consent withdrawn): say so and
 * offer to reconnect instead of failing silently. Other errors get a retry.
 */
export function ClassroomErrorNotice({
  error,
  fallback,
  onRetry,
}: {
  error: unknown;
  /** Already translated message for non-connection failures. */
  fallback: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const { connect, pending } = useConnectClassroom();

  if (isConnectionError(error)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("teacher.connection.reconnectTitle")}</AlertTitle>
        <AlertDescription>{t("teacher.connection.reconnectAction")}</AlertDescription>
        <AlertAction>
          <Button size="sm" disabled={pending} onClick={() => void connect()}>
            <PlugZap />
            {t("teacher.connection.retry")}
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertDescription>{fallback}</AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw />
            {t("teacher.common.retry")}
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

/** Which Google account is connected, with the way out. */
export function ClassroomAccount({ status }: { status: ClassroomStatus }) {
  const { t } = useTranslation();
  const disconnect = useDisconnectClassroom();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>
        {status.email
          ? t("teacher.connection.connectedAs", { email: status.email })
          : t("teacher.connection.connected")}
      </span>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Unplug />
        {t("teacher.connection.disconnect")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("teacher.connection.disconnectTitle")}</DialogTitle>
            <DialogDescription>{t("teacher.connection.disconnectDescription")}</DialogDescription>
          </DialogHeader>
          {disconnect.isError && (
            <p className="m-0 text-sm text-destructive">{t("teacher.connection.disconnectFailed")}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={disconnect.isPending} />}>
              {t("exercises.dialog.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(undefined, { onSuccess: () => setOpen(false) })}
            >
              {disconnect.isPending && <Loader2 className="animate-spin" />}
              {t("teacher.connection.disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
