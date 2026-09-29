import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  Library,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";

import { TeacherGate } from "@/components/common/TeacherGate";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { findExerciseTool, renderExerciseSetPdf } from "@/config/exerciseTools";
import { useCrumbLabel } from "@/context/PageChromeProvider";
import { useTabPath } from "@/context/TabsProvider";
import {
  groupByCourse,
  groupByMonth,
  UNASSIGNED,
  type SetGroup,
} from "@/features/teacher-exercises/lib/grouping";
import { countExercises, type ExerciseSet } from "@/lib/exercises/sets";
import { downloadBlob } from "@/lib/pdf/exercisePdf";
import {
  useDeleteExerciseSet,
  useDuplicateExerciseSet,
  useExerciseSets,
} from "@/services/exercises";

const ROOT = "/teacher/exercises/mine";

export function MyExercises() {
  return (
    <TeacherGate>
      <MyExercisesRouter />
    </TeacherGate>
  );
}

/** The list lives at the page root; `/<id>` inside the same tab is the detail. */
function MyExercisesRouter() {
  const path = useTabPath();
  const id = path.startsWith(`${ROOT}/`) ? decodeURIComponent(path.slice(ROOT.length + 1)) : null;
  return id ? <ExerciseSetDetail id={id} /> : <ExerciseSetList />;
}

function useDateFormat() {
  const { i18n } = useTranslation();
  return {
    date: (iso: string) =>
      new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(iso)),
    dateTime: (iso: string) =>
      new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(iso),
      ),
    month: (key: string) =>
      new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(
        new Date(`${key}-01T12:00:00Z`),
      ),
  };
}

function ExerciseSetList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useDateFormat();
  const [groupBy, setGroupBy] = useState<"date" | "course">("date");
  const sets = useExerciseSets();

  let body: React.ReactNode;
  if (sets.isPending) {
    body = (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  } else if (sets.isError) {
    body = (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center gap-2">
          {t("teacher.mine.errors.load")}
          <Button size="sm" variant="outline" onClick={() => void sets.refetch()}>
            {t("teacher.common.retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  } else if (sets.data.length === 0) {
    body = (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Library />
          </EmptyMedia>
          <EmptyTitle>{t("teacher.mine.empty.title")}</EmptyTitle>
          <EmptyDescription>{t("teacher.mine.empty.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => navigate("/teacher/exercises/new")}>
            <FilePlus2 />
            {t("sidebar.teacher.createExercises")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  } else {
    const groups: SetGroup[] = groupBy === "date" ? groupByMonth(sets.data) : groupByCourse(sets.data);
    body = groups.map((group) => (
      <section key={group.key} className="flex flex-col gap-3">
        <h2 className="m-0 text-base capitalize">
          {groupBy === "date"
            ? format.month(group.label)
            : group.key === UNASSIGNED
              ? t("teacher.mine.unassigned")
              : group.label}
        </h2>
        {group.sets.map((set) => (
          <ExerciseSetCard key={set.id} set={set} />
        ))}
      </section>
    ));
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0">{t("teacher.mine.title")}</h1>
        <p className="m-0 text-muted-foreground">{t("teacher.mine.description")}</p>
      </header>

      <Tabs value={groupBy} onValueChange={(value) => setGroupBy(value === "course" ? "course" : "date")}>
        <TabsList>
          <TabsTrigger value="date">{t("teacher.mine.byDate")}</TabsTrigger>
          <TabsTrigger value="course">{t("teacher.mine.byCourse")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {body}
    </div>
  );
}

function toolNames(set: ExerciseSet, t: (key: string) => string): string[] {
  return [
    ...new Set(
      set.blocks.map((block) => {
        const tool = findExerciseTool(block.toolId);
        return tool ? t(tool.titleKey) : block.toolId;
      }),
    ),
  ];
}

function ExerciseSetCard({ set }: { set: ExerciseSet }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useDateFormat();

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <button
            type="button"
            className="cursor-pointer text-left hover:underline"
            onClick={() => navigate(`${ROOT}/${encodeURIComponent(set.id)}`)}
          >
            {set.title}
          </button>
        </CardTitle>
        <CardDescription>
          {t("teacher.mine.dates", {
            created: format.date(set.createdAt),
            updated: format.date(set.updatedAt),
          })}
        </CardDescription>
        <CardAction>
          <SetActions set={set} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {t("teacher.mine.exerciseCount", { count: countExercises(set.blocks) })}
        </Badge>
        {toolNames(set, t).map((name) => (
          <Badge key={name} variant="outline">
            {name}
          </Badge>
        ))}
        <Badge variant={set.usages.length > 0 ? "default" : "ghost"}>
          {t("teacher.mine.usageCount", { count: set.usages.length })}
        </Badge>
      </CardContent>
    </Card>
  );
}

/** Download, assign, edit (only while never assigned), duplicate and delete. */
function SetActions({ set, onDeleted }: { set: ExerciseSet; onDeleted?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const duplicate = useDuplicateExerciseSet();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function download(includeAnswers: boolean) {
    setBusy(true);
    try {
      const file = await renderExerciseSetPdf(set, includeAnswers, t);
      downloadBlob(file, file.name);
    } catch (error) {
      console.error("Failed to render the exercise set", error);
    } finally {
      setBusy(false);
    }
  }

  const used = set.usages.length > 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="icon-sm" variant="ghost" aria-label={t("teacher.mine.actions.menu")}>
              {busy || duplicate.isPending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => void download(false)}>
              <Download />
              {t("teacher.mine.actions.download")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void download(true)}>
              <Download />
              {t("teacher.mine.actions.downloadAnswers")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(`/teacher/courses/assign?exercise=${encodeURIComponent(set.id)}`)}
            >
              <Send />
              {t("teacher.mine.actions.assign")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={used}
              onClick={() =>
                navigate(`/teacher/exercises/new?edit=${encodeURIComponent(set.id)}`)
              }
            >
              <Pencil />
              {used ? t("teacher.mine.actions.editLocked") : t("teacher.mine.actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                duplicate.mutate(
                  { id: set.id, title: t("teacher.mine.copyTitle", { title: set.title }) },
                  {
                    onSuccess: (copy) =>
                      navigate(`/teacher/exercises/new?edit=${encodeURIComponent(copy.id)}`),
                  },
                )
              }
            >
              <Copy />
              {t("teacher.mine.actions.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
              {t("teacher.mine.actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDialog
        set={set}
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        {...(onDeleted ? { onDeleted } : {})}
      />
    </>
  );
}

function DeleteDialog({
  set,
  open,
  onOpenChange,
  onDeleted,
}: {
  set: ExerciseSet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteExerciseSet();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("teacher.mine.delete.title", { title: set.title })}</DialogTitle>
          <DialogDescription>
            {set.usages.length > 0
              ? t("teacher.mine.delete.used", { count: set.usages.length })
              : t("teacher.mine.delete.description")}
          </DialogDescription>
        </DialogHeader>
        {remove.isError && <p className="m-0 text-sm text-destructive">{t("teacher.mine.errors.delete")}</p>}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={remove.isPending} />}>
            {t("exercises.dialog.cancel")}
          </DialogClose>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(set.id, {
                onSuccess: () => {
                  onOpenChange(false);
                  onDeleted?.();
                },
              })
            }
          >
            {remove.isPending && <Loader2 className="animate-spin" />}
            {t("teacher.mine.actions.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExerciseSetDetail({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useDateFormat();
  const sets = useExerciseSets();
  const set = sets.data?.find((item) => item.id === id);

  useCrumbLabel(`${ROOT}/${id}`, set?.title ?? null);

  if (sets.isPending) return <Skeleton className="my-6 h-40 w-full" />;
  if (!set) {
    return (
      <Empty className="my-6 border">
        <EmptyHeader>
          <EmptyTitle>{t("teacher.mine.notFound")}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => navigate(ROOT)}>
            {t("teacher.mine.backToList")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  let number = 0;

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0">{set.title}</h1>
          <p className="m-0 text-muted-foreground">
            {t("teacher.mine.dates", {
              created: format.dateTime(set.createdAt),
              updated: format.dateTime(set.updatedAt),
            })}
          </p>
        </div>
        <SetActions set={set} onDeleted={() => navigate(ROOT)} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("teacher.mine.usages")}</CardTitle>
          <CardDescription>
            {set.usages.length === 0 ? t("teacher.mine.noUsages") : null}
          </CardDescription>
        </CardHeader>
        {set.usages.length > 0 && (
          <CardContent>
            <ul className="m-0 flex flex-col gap-2 p-0">
              {set.usages.map((usage) => (
                <li key={usage.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 list-none">
                  <span className="font-medium">{usage.courseName}</span>
                  <span>{usage.courseWorkTitle}</span>
                  <span className="text-muted-foreground">
                    {t("teacher.mine.assignedOn", { date: format.dateTime(usage.assignedAt) })}
                    {usage.dueAt ? ` · ${t("teacher.mine.dueOn", { date: format.dateTime(usage.dueAt) })}` : ""}
                  </span>
                  {usage.link && (
                    <a href={usage.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                      {t("teacher.common.openInClassroom")}
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {set.blocks.map((block, index) => {
        const tool = findExerciseTool(block.toolId);
        const start = number + 1;
        number += block.exercises.length;
        return (
          <section key={index} className="flex flex-col gap-2">
            <h2 className="m-0 text-base">
              {t("exercises.pdf.section", {
                tool: tool ? t(tool.titleKey) : block.toolId,
                difficulty: t(`exercises.difficulty.${block.difficulty}`),
              })}
            </h2>
            <ol start={start} className="m-0 flex flex-col gap-1 pl-6 font-mono text-sm">
              {block.exercises.map((exercise, item) => (
                <li key={item}>
                  {exercise.prompt}
                  <span className="block text-muted-foreground">→ {exercise.answer}</span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
