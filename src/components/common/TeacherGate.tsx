import { SignInButton, useAuth } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppRole } from "@/hooks/useAppRole";

/**
 * Renders its children only for a signed-in teacher. Reaching a teacher page
 * by URL as anyone else shows a notice instead — and the API refuses the data
 * anyway (`authorOnly` in `src/api/guards.ts`), so this is a courtesy, not the
 * lock.
 */
export function TeacherGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { isSignedIn } = useAuth();
  const { role, isLoaded } = useAppRole();

  if (!isLoaded) {
    return (
      <div className="flex flex-col gap-3 py-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isSignedIn && role === "teacher") return <>{children}</>;

  return (
    <Empty className="my-8 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlert />
        </EmptyMedia>
        <EmptyTitle>{t("teacher.gate.title")}</EmptyTitle>
        <EmptyDescription>
          {isSignedIn ? t("teacher.gate.notTeacher") : t("teacher.gate.signedOut")}
        </EmptyDescription>
      </EmptyHeader>
      {!isSignedIn && (
        <EmptyContent>
          <SignInButton mode="modal">
            <Button>{t("sidebar.account.signIn")}</Button>
          </SignInButton>
        </EmptyContent>
      )}
    </Empty>
  );
}
