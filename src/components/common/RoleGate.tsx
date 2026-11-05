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
import type { AppRole } from "@/lib/auth/roles";

/** The roles a page can be reserved for — a student page needs no gate. */
type GatedRole = Exclude<AppRole, "student">;

/** The notice each role's pages show to everyone else. */
const GATE_COPY = {
  teacher: {
    title: "teacher.gate.title",
    wrongRole: "teacher.gate.notTeacher",
    signedOut: "teacher.gate.signedOut",
  },
  admin: {
    title: "admin.gate.title",
    wrongRole: "admin.gate.notAdmin",
    signedOut: "admin.gate.signedOut",
  },
} as const satisfies Record<GatedRole, Record<string, string>>;

/**
 * Renders its children only for a signed-in user with `role`. Reaching such a
 * page by URL as anyone else shows a notice instead — and the API refuses the
 * data anyway (`authorOnly` / `adminOnly` in `src/api/guards.ts`), so this is
 * a courtesy, not the lock.
 */
export function RoleGate({ role: required, children }: { role: GatedRole; children: React.ReactNode }) {
  const { t } = useTranslation();
  const { isSignedIn } = useAuth();
  const { role, isLoaded } = useAppRole();
  const copy = GATE_COPY[required];

  if (!isLoaded) {
    return (
      <div className="flex flex-col gap-3 py-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isSignedIn && role === required) return <>{children}</>;

  return (
    <Empty className="my-8 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlert />
        </EmptyMedia>
        <EmptyTitle>{t(copy.title)}</EmptyTitle>
        <EmptyDescription>
          {isSignedIn ? t(copy.wrongRole) : t(copy.signedOut)}
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

/** A teacher page: the editors, exercise sets and Classroom. */
export function TeacherGate({ children }: { children: React.ReactNode }) {
  return <RoleGate role="teacher">{children}</RoleGate>;
}

/** An administrator page: the review queue and the Theory menu builder. */
export function AdminGate({ children }: { children: React.ReactNode }) {
  return <RoleGate role="admin">{children}</RoleGate>;
}
