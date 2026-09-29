import { useEffect, useId, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { CalendarClock, ExternalLink, Info, Loader2, Save, Send } from "lucide-react";

import { TeacherGate } from "@/components/common/TeacherGate";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachmentsEditor } from "@/features/classroom/components/AttachmentsEditor";
import {
  ClassroomAccount,
  ClassroomErrorNotice,
  ClassroomGate,
} from "@/features/classroom/components/ClassroomGate";
import { RichTextEditor } from "@/features/classroom/components/RichTextEditor";
import {
  ALL_STUDENTS,
  recipientsValid,
  StudentPicker,
  type Recipients,
} from "@/features/classroom/components/StudentPicker";
import { prepareUpload, type DraftAttachment } from "@/features/classroom/lib/attachments";
import {
  fromDateTimeLocal,
  toDateTimeLocal,
  validateSchedule,
} from "@/features/classroom/lib/schedule";
import { sanitizeRichText } from "@/features/classroom/lib/sanitize";
import { usePageIntent } from "@/hooks/usePageIntent";
import type { PublishMode, StoredAssignment } from "@/lib/classroom";
import { richTextToPlain } from "@/lib/richText";
import { ApiError } from "@/services/client";
import {
  useAssignment,
  useCourses,
  useCreateAssignment,
  useUpdateAssignment,
} from "@/services/classroom";
import { useExerciseSets } from "@/services/exercises";

export function AssignExercise() {
  return (
    <TeacherGate>
      <ClassroomGate needs={["assign"]}>
        {(status) => <AssignForm account={<ClassroomAccount status={status} />} />}
      </ClassroomGate>
    </TeacherGate>
  );
}

type FormState = {
  courseId: string | null;
  title: string;
  instructionsHtml: string;
  attachments: DraftAttachment[];
  recipients: Recipients;
  /** Raw input; empty = ungraded. */
  points: string;
  /** `datetime-local` value; empty = no due date. */
  due: string;
  mode: PublishMode;
  scheduled: string;
};

const EMPTY_FORM: FormState = {
  courseId: null,
  title: "",
  instructionsHtml: "",
  attachments: [],
  recipients: ALL_STUDENTS,
  points: "",
  due: "",
  mode: "publish",
  scheduled: "",
};

function fromAssignment(assignment: StoredAssignment): FormState {
  const mode: PublishMode =
    assignment.state === "PUBLISHED" ? "publish" : assignment.scheduledAt ? "schedule" : "draft";
  return {
    courseId: assignment.courseId,
    title: assignment.title,
    instructionsHtml: sanitizeRichText(assignment.instructionsHtml),
    attachments: [],
    recipients:
      assignment.studentIds.length > 0
        ? { all: false, studentIds: assignment.studentIds }
        : ALL_STUDENTS,
    points: assignment.maxPoints ? String(assignment.maxPoints) : "",
    due: assignment.dueAt ? toDateTimeLocal(assignment.dueAt) : "",
    mode,
    scheduled: assignment.scheduledAt ? toDateTimeLocal(assignment.scheduledAt) : "",
  };
}

/**
 * `Asignar`: title and formatted instructions, attachments, and a settings
 * column for course, students, points, due date and publication — the shape
 * of Classroom's own "Create assignment" screen.
 */
function AssignForm({ account }: { account: React.ReactNode }) {
  const { t } = useTranslation();
  const titleId = useId();
  const instructionsId = useId();
  const courseId = useId();
  const pointsId = useId();
  const dueId = useId();
  const modeId = useId();
  const scheduledId = useId();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  /** Minted per draft: a retry after a failure re-sends the same id, so no duplicate task. */
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [editing, setEditing] = useState<StoredAssignment | null>(null);
  const [touched, setTouched] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareFailed, setPrepareFailed] = useState(false);
  const [result, setResult] = useState<{ assignment: StoredAssignment; edited: boolean } | null>(null);

  const courses = useCourses(false);
  const sets = useExerciseSets();
  const create = useCreateAssignment();
  const update = useUpdateAssignment();
  const mutation = editing ? update : create;

  function patch(next: Partial<FormState>) {
    setForm((current) => ({ ...current, ...next }));
    setResult(null);
  }

  // `?exercise=<id>` from `Mis ejercicios` / `Crear ejercicios`: attach that set.
  const exerciseIntent = usePageIntent("exercise");
  useEffect(() => {
    if (!exerciseIntent.value || !sets.data) return;
    const set = sets.data.find((item) => item.id === exerciseIntent.value);
    if (set) {
      setForm((current) =>
        current.attachments.some((a) => a.kind === "exercise" && a.exerciseSetId === set.id)
          ? current
          : {
              ...current,
              title: current.title || set.title,
              attachments: [
                ...current.attachments,
                {
                  kind: "exercise",
                  clientId: crypto.randomUUID(),
                  exerciseSetId: set.id,
                  title: set.title,
                  includeAnswers: false,
                },
              ],
            },
      );
    }
    exerciseIntent.consume();
  }, [exerciseIntent, sets.data]);

  // `?edit=<assignmentId>` from `Mis cursos`: edit a task TCP-TRIP created.
  const editIntent = usePageIntent("edit");
  const editingQuery = useAssignment(editIntent.value);
  useEffect(() => {
    if (!editIntent.value || !editingQuery.data) return;
    setEditing(editingQuery.data);
    setForm(fromAssignment(editingQuery.data));
    setTouched(false);
    setResult(null);
    editIntent.consume();
  }, [editIntent, editingQuery.data]);

  const published = editing?.state === "PUBLISHED";

  // ── Validation ─────────────────────────────────────────────────────────
  const pointsValue = form.points.trim() === "" ? null : Number(form.points);
  const pointsInvalid =
    pointsValue !== null && (!Number.isFinite(pointsValue) || pointsValue < 0);
  const schedule = validateSchedule({
    due: form.due,
    scheduled: form.mode === "schedule" ? form.scheduled : "",
    requireScheduled: form.mode === "schedule",
    now: new Date(),
  });
  const problems = {
    title: form.title.trim() === "",
    course: !editing && form.courseId === null,
    recipients: !editing && !recipientsValid(form.recipients),
    points: pointsInvalid,
    due: schedule.due,
    scheduled: schedule.scheduled,
  };
  const valid = !Object.values(problems).some(Boolean);

  async function submit() {
    setTouched(true);
    if (!valid) return;
    setPrepareFailed(false);

    const common = {
      title: form.title.trim(),
      instructionsHtml: sanitizeRichText(form.instructionsHtml),
      maxPoints: pointsValue && pointsValue > 0 ? pointsValue : null,
      dueAt: form.due ? fromDateTimeLocal(form.due) : null,
      mode: form.mode,
      scheduledAt: form.mode === "schedule" && form.scheduled ? fromDateTimeLocal(form.scheduled) : null,
    };

    if (editing) {
      update.mutate(
        { id: editing.id, patch: common },
        {
          onSuccess: (assignment) => {
            setEditing(assignment);
            setResult({ assignment, edited: true });
          },
        },
      );
      return;
    }

    let upload: Awaited<ReturnType<typeof prepareUpload>>;
    setPreparing(true);
    try {
      upload = await prepareUpload(form.attachments, sets.data ?? [], t);
    } catch (error) {
      console.error("Failed to prepare attachments", error);
      setPrepareFailed(true);
      return;
    } finally {
      setPreparing(false);
    }

    create.mutate(
      {
        input: {
          requestId,
          courseId: form.courseId ?? "",
          studentIds: form.recipients.all ? [] : form.recipients.studentIds,
          attachments: upload.payload,
          ...common,
        },
        files: upload.files,
      },
      {
        onSuccess: (assignment) => {
          setResult({ assignment, edited: false });
          setForm(EMPTY_FORM);
          setRequestId(crypto.randomUUID());
          setTouched(false);
        },
      },
    );
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setTouched(false);
    update.reset();
  }

  const busy = preparing || mutation.isPending;
  const courseItems = (courses.data ?? []).map((course) => ({
    value: course.id,
    label: course.section ? `${course.name} · ${course.section}` : course.name,
  }));
  const modeItems = (["publish", "schedule", "draft"] as const).map((value) => ({
    value,
    label: t(`teacher.assign.modes.${value}`),
  }));
  const plainPreview = richTextToPlain(form.instructionsHtml);

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="m-0">{editing ? t("teacher.assign.editTitle") : t("teacher.assign.title")}</h1>
        <p className="m-0 text-muted-foreground">{t("teacher.assign.description")}</p>
        {account}
      </header>

      {editing && (
        <Alert>
          <Info />
          <AlertTitle>{t("teacher.assign.editingNotice", { title: editing.title })}</AlertTitle>
          <AlertDescription>{t("teacher.assign.editingLimits")}</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={cancelEdit}>
              {t("teacher.assign.cancelEdit")}
            </Button>
          </AlertAction>
        </Alert>
      )}

      {result && (
        <Alert>
          <AlertTitle>
            {result.edited
              ? t("teacher.assign.updated")
              : t(`teacher.assign.created.${result.assignment.state === "PUBLISHED" ? "published" : "draft"}`)}
          </AlertTitle>
          {result.assignment.link && (
            <AlertDescription>
              <a href={result.assignment.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                {t("teacher.common.openInClassroom")}
                <ExternalLink className="size-3.5" />
              </a>
            </AlertDescription>
          )}
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={touched && problems.title}>
                  <FieldLabel htmlFor={titleId}>{t("teacher.assign.fields.title")}</FieldLabel>
                  <Input
                    id={titleId}
                    value={form.title}
                    maxLength={3000}
                    aria-invalid={touched && problems.title}
                    onChange={(event) => patch({ title: event.target.value })}
                  />
                  {touched && problems.title && <FieldError>{t("teacher.assign.errors.title")}</FieldError>}
                </Field>

                <Field>
                  <FieldLabel htmlFor={instructionsId}>
                    {t("teacher.assign.fields.instructions")}
                  </FieldLabel>
                  <RichTextEditor
                    id={instructionsId}
                    value={form.instructionsHtml}
                    placeholder={t("teacher.assign.fields.instructionsPlaceholder")}
                    onChange={(instructionsHtml) => patch({ instructionsHtml })}
                  />
                  <FieldDescription>{t("teacher.assign.plainTextNote")}</FieldDescription>
                  {plainPreview && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">
                        {t("teacher.assign.plainPreview")}
                      </summary>
                      <pre className="mt-2 rounded-md bg-muted p-3 font-sans whitespace-pre-wrap">
                        {plainPreview}
                      </pre>
                    </details>
                  )}
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("teacher.attachments.title")}</CardTitle>
              <CardDescription>
                {editing ? t("teacher.assign.attachmentsLocked") : t("teacher.attachments.description")}
              </CardDescription>
            </CardHeader>
            {!editing && (
              <CardContent>
                <AttachmentsEditor
                  value={form.attachments}
                  onChange={(attachments) => patch({ attachments })}
                  disabled={busy}
                />
              </CardContent>
            )}
          </Card>
        </div>

        <Card className="lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>{t("teacher.assign.settings")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={touched && problems.course}>
                <FieldLabel htmlFor={courseId}>{t("teacher.assign.fields.course")}</FieldLabel>
                {courses.isPending ? (
                  <Skeleton className="h-9 w-full" />
                ) : courses.isError ? (
                  <ClassroomErrorNotice
                    error={courses.error}
                    fallback={t("teacher.courses.errors.load")}
                    onRetry={() => void courses.refetch()}
                  />
                ) : (
                  <Select
                    items={courseItems}
                    value={form.courseId}
                    disabled={Boolean(editing) || busy}
                    onValueChange={(next) => {
                      if (typeof next === "string") patch({ courseId: next, recipients: ALL_STUDENTS });
                    }}
                  >
                    <SelectTrigger id={courseId} className="h-9 w-full" aria-invalid={touched && problems.course}>
                      <SelectValue placeholder={t("teacher.assign.fields.coursePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {courseItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {courses.data?.length === 0 && (
                  <FieldDescription>{t("teacher.courses.empty")}</FieldDescription>
                )}
                {touched && problems.course && <FieldError>{t("teacher.assign.errors.course")}</FieldError>}
              </Field>

              <Field>
                <FieldLabel>{t("teacher.assign.fields.students")}</FieldLabel>
                <StudentPicker
                  courseId={form.courseId}
                  value={form.recipients}
                  disabled={Boolean(editing) || busy}
                  onChange={(recipients) => patch({ recipients })}
                />
              </Field>

              <FieldSeparator />

              <Field data-invalid={touched && problems.points}>
                <FieldLabel htmlFor={pointsId}>{t("teacher.assign.fields.points")}</FieldLabel>
                <Input
                  id={pointsId}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={form.points}
                  placeholder={t("teacher.assign.fields.ungraded")}
                  aria-invalid={touched && problems.points}
                  onChange={(event) => patch({ points: event.target.value })}
                />
                {touched && problems.points ? (
                  <FieldError>{t("teacher.assign.errors.points")}</FieldError>
                ) : (
                  <FieldDescription>{t("teacher.assign.fields.pointsHint")}</FieldDescription>
                )}
              </Field>

              <Field data-invalid={touched && Boolean(problems.due)}>
                <FieldLabel htmlFor={dueId}>{t("teacher.assign.fields.due")}</FieldLabel>
                <Input
                  id={dueId}
                  type="datetime-local"
                  value={form.due}
                  aria-invalid={touched && Boolean(problems.due)}
                  onChange={(event) => patch({ due: event.target.value })}
                />
                {touched && problems.due ? (
                  <FieldError>{t(`teacher.assign.errors.${problems.due}`)}</FieldError>
                ) : (
                  <FieldDescription>{t("teacher.assign.fields.dueHint")}</FieldDescription>
                )}
              </Field>

              <FieldSeparator />

              <Field>
                <FieldLabel htmlFor={modeId}>{t("teacher.assign.fields.mode")}</FieldLabel>
                <Select
                  items={modeItems}
                  value={form.mode}
                  disabled={published || busy}
                  onValueChange={(next) => {
                    if (next === "publish" || next === "schedule" || next === "draft") patch({ mode: next });
                  }}
                >
                  <SelectTrigger id={modeId} className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {published && <FieldDescription>{t("teacher.assign.publishedLocked")}</FieldDescription>}
              </Field>

              {form.mode === "schedule" && (
                <Field data-invalid={touched && Boolean(problems.scheduled)}>
                  <FieldLabel htmlFor={scheduledId}>{t("teacher.assign.fields.scheduled")}</FieldLabel>
                  <Input
                    id={scheduledId}
                    type="datetime-local"
                    value={form.scheduled}
                    aria-invalid={touched && Boolean(problems.scheduled)}
                    onChange={(event) => patch({ scheduled: event.target.value })}
                  />
                  {touched && problems.scheduled && (
                    <FieldError>{t(`teacher.assign.errors.${problems.scheduled}`)}</FieldError>
                  )}
                </Field>
              )}

              <Button disabled={busy || (touched && !valid)} onClick={() => void submit()}>
                {busy ? (
                  <Loader2 className="animate-spin" />
                ) : form.mode === "schedule" ? (
                  <CalendarClock />
                ) : form.mode === "draft" ? (
                  <Save />
                ) : (
                  <Send />
                )}
                {preparing
                  ? t("teacher.assign.preparing")
                  : mutation.isPending
                    ? t("teacher.assign.sending")
                    : editing
                      ? t("teacher.assign.saveChanges")
                      : t(`teacher.assign.submit.${form.mode}`)}
              </Button>

              {prepareFailed && (
                <p className="m-0 text-sm text-destructive">{t("teacher.assign.errors.prepare")}</p>
              )}
              {mutation.isError && (
                <ClassroomErrorNotice error={mutation.error} fallback={submitErrorMessage(mutation.error, t)} />
              )}
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function submitErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    const details = error.details as { name?: string } | undefined;
    if (error.code === "upload_failed") return t("teacher.assign.errors.upload", { name: details?.name ?? "" });
    if (error.code === "presentation_unpublished") {
      return t("teacher.assign.errors.unpublished", { name: details?.name ?? "" });
    }
    if (error.code === "file_too_large") return t("teacher.assign.errors.tooLarge", { name: details?.name ?? "" });
    if (error.code === "google_error") return t("teacher.assign.errors.google", { message: error.message });
    if (error.status === 400) return t("teacher.assign.errors.invalid");
  }
  return t("teacher.assign.errors.generic");
}
