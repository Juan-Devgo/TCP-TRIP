import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  Megaphone,
  Pencil,
  School,
  Search,
  Users,
} from "lucide-react";

import { TeacherGate } from "@/components/common/TeacherGate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCrumbLabel } from "@/context/PageChromeProvider";
import { useTabPath } from "@/context/TabsProvider";
import { AttachmentsEditor } from "@/features/classroom/components/AttachmentsEditor";
import {
  ClassroomAccount,
  ClassroomErrorNotice,
  ClassroomGate,
} from "@/features/classroom/components/ClassroomGate";
import {
  ALL_STUDENTS,
  matchesStudent,
  recipientsValid,
  StudentPicker,
  type Recipients,
} from "@/features/classroom/components/StudentPicker";
import { prepareUpload, type DraftAttachment } from "@/features/classroom/lib/attachments";
import { summarizeSubmissions } from "@/features/classroom/lib/progress";
import { fromDateTimeLocal, validateSchedule } from "@/features/classroom/lib/schedule";
import type { Course, CourseWorkSummary, Submission } from "@/lib/classroom";
import {
  useAnnouncements,
  useCourse,
  useCourses,
  useCourseWork,
  useCreateAnnouncement,
  useStudents,
  useSubmissions,
} from "@/services/classroom";
import { useExerciseSets } from "@/services/exercises";

const ROOT = "/teacher/courses/mine";

export function MyCourses() {
  return (
    <TeacherGate>
      <ClassroomGate needs={["courses"]}>
        {(status) => <CoursesRouter account={<ClassroomAccount status={status} />} />}
      </ClassroomGate>
    </TeacherGate>
  );
}

/** The course list lives at the page root; `/<courseId>` inside the tab is one course. */
function CoursesRouter({ account }: { account: React.ReactNode }) {
  const path = useTabPath();
  const courseId = path.startsWith(`${ROOT}/`) ? decodeURIComponent(path.slice(ROOT.length + 1)) : null;
  return courseId ? <CourseDetail courseId={courseId} /> : <CourseList account={account} />;
}

function useFormat() {
  const { i18n } = useTranslation();
  return (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
}

function CourseList({ account }: { account: React.ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const archivedId = useId();
  const [archived, setArchived] = useState(false);
  const courses = useCourses(archived);

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="m-0">{t("teacher.courses.title")}</h1>
        <p className="m-0 text-muted-foreground">{t("teacher.courses.description")}</p>
        {account}
      </header>

      <Field orientation="horizontal" className="w-fit">
        <Switch id={archivedId} checked={archived} onCheckedChange={setArchived} />
        <FieldLabel htmlFor={archivedId}>{t("teacher.courses.showArchived")}</FieldLabel>
      </Field>

      {courses.isPending && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}
      {courses.isError && (
        <ClassroomErrorNotice
          error={courses.error}
          fallback={t("teacher.courses.errors.load")}
          onRetry={() => void courses.refetch()}
        />
      )}
      {courses.data?.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <School />
            </EmptyMedia>
            <EmptyTitle>{t("teacher.courses.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("teacher.courses.empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {courses.data && courses.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.data.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onOpen={() => navigate(`${ROOT}/${encodeURIComponent(course.id)}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CourseCard({ course, onOpen }: { course: Course; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <button type="button" className="cursor-pointer text-left hover:underline" onClick={onOpen}>
            {course.name}
          </button>
        </CardTitle>
        {course.section && <CardDescription>{course.section}</CardDescription>}
        {course.state !== "ACTIVE" && (
          <CardAction>
            <Badge variant="outline">{t(`teacher.courses.states.${course.state}`, course.state)}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex items-center gap-2 text-muted-foreground">
        <Users className="size-4" />
        {course.studentCount === null
          ? t("teacher.courses.studentsUnknown")
          : t("teacher.courses.studentCount", { count: course.studentCount })}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button size="sm" onClick={onOpen}>
          {t("teacher.courses.open")}
        </Button>
        {course.link && (
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<a href={course.link} target="_blank" rel="noreferrer" className="no-underline" />}
          >
            {t("teacher.common.openInClassroom")}
            <ExternalLink />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function CourseDetail({ courseId }: { courseId: string }) {
  const { t } = useTranslation();
  const course = useCourse(courseId);
  const [tab, setTab] = useState("students");

  useCrumbLabel(`${ROOT}/${courseId}`, course.data?.name ?? null);

  if (course.isPending) return <Skeleton className="my-6 h-40 w-full" />;
  if (course.isError) {
    return (
      <div className="py-6">
        <ClassroomErrorNotice
          error={course.error}
          fallback={t("teacher.courses.errors.course")}
          onRetry={() => void course.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0">{course.data.name}</h1>
          {course.data.section && <p className="m-0 text-muted-foreground">{course.data.section}</p>}
        </div>
        {course.data.link && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={course.data.link} target="_blank" rel="noreferrer" className="no-underline" />}
          >
            {t("teacher.common.openInClassroom")}
            <ExternalLink />
          </Button>
        )}
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList>
          <TabsTrigger value="students">{t("teacher.courses.tabs.students")}</TabsTrigger>
          <TabsTrigger value="announcements">{t("teacher.courses.tabs.announcements")}</TabsTrigger>
          <TabsTrigger value="work">{t("teacher.courses.tabs.work")}</TabsTrigger>
        </TabsList>
        <TabsContent value="students" className="pt-4">
          <StudentsPanel courseId={courseId} />
        </TabsContent>
        <TabsContent value="announcements" className="pt-4">
          <AnnouncementsPanel courseId={courseId} />
        </TabsContent>
        <TabsContent value="work" className="pt-4">
          <CourseWorkPanel courseId={courseId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function StudentsPanel({ courseId }: { courseId: string }) {
  const { t } = useTranslation();
  const students = useStudents(courseId);
  const [query, setQuery] = useState("");

  if (students.isPending) return <Skeleton className="h-40 w-full" />;
  if (students.isError) {
    return (
      <ClassroomErrorNotice
        error={students.error}
        fallback={t("teacher.students.loadError")}
        onRetry={() => void students.refetch()}
      />
    );
  }

  const visible = students.data.filter((student) => matchesStudent(student, query));

  return (
    <div className="flex flex-col gap-3">
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          placeholder={t("teacher.students.search")}
          aria-label={t("teacher.students.search")}
          onChange={(event) => setQuery(event.target.value)}
        />
      </InputGroup>
      <p className="m-0 text-sm text-muted-foreground">
        {t("teacher.courses.studentCount", { count: students.data.length })}
      </p>
      {students.data.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t("teacher.students.empty")}</p>
      ) : (
        <ul className="m-0 flex flex-col gap-1 p-0">
          {visible.map((student) => (
            <li key={student.userId} className="flex list-none items-center gap-3 rounded-md px-2 py-1.5">
              <Avatar>
                {student.photoUrl && <AvatarImage src={student.photoUrl} alt="" />}
                <AvatarFallback>{initials(student.name)}</AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{student.name}</span>
                {student.email && (
                  <span className="truncate text-xs text-muted-foreground">{student.email}</span>
                )}
              </span>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="list-none text-sm text-muted-foreground">{t("teacher.students.noMatch")}</li>
          )}
        </ul>
      )}
    </div>
  );
}

function AnnouncementsPanel({ courseId }: { courseId: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const announcements = useAnnouncements(courseId);

  return (
    <div className="flex flex-col gap-6">
      <AnnouncementComposer courseId={courseId} />

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-base">{t("teacher.announcements.list")}</h2>
        {announcements.isPending && <Skeleton className="h-24 w-full" />}
        {announcements.isError && (
          <ClassroomErrorNotice
            error={announcements.error}
            fallback={t("teacher.announcements.errors.load")}
            onRetry={() => void announcements.refetch()}
          />
        )}
        {announcements.data?.length === 0 && (
          <p className="m-0 text-sm text-muted-foreground">{t("teacher.announcements.empty")}</p>
        )}
        {announcements.data?.map((announcement) => (
          <Card key={announcement.id} size="sm">
            <CardHeader>
              <CardDescription>
                {announcement.scheduledAt
                  ? t("teacher.announcements.scheduledFor", { date: format(announcement.scheduledAt) })
                  : format(announcement.createdAt)}
              </CardDescription>
              {announcement.state !== "PUBLISHED" && (
                <CardAction>
                  <Badge variant="outline">
                    {t(`teacher.states.${announcement.state}`, announcement.state)}
                  </Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="m-0 whitespace-pre-wrap">{announcement.text}</p>
              {announcement.materials.length > 0 && (
                <ul className="m-0 flex flex-col gap-1 pl-5 text-sm">
                  {announcement.materials.map((material) => (
                    <li key={material.url}>
                      <a href={material.url} target="_blank" rel="noreferrer">
                        {material.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {announcement.link && (
                <a
                  href={announcement.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-sm"
                >
                  {t("teacher.common.openInClassroom")}
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function AnnouncementComposer({ courseId }: { courseId: string }) {
  const { t } = useTranslation();
  const textId = useId();
  const scheduleId = useId();
  const whenId = useId();
  const create = useCreateAnnouncement(courseId);
  const sets = useExerciseSets();

  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [recipients, setRecipients] = useState<Recipients>(ALL_STUDENTS);
  const [scheduled, setScheduled] = useState(false);
  const [when, setWhen] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [touched, setTouched] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareFailed, setPrepareFailed] = useState(false);
  const [sent, setSent] = useState(false);

  const schedule = validateSchedule({
    due: "",
    scheduled: scheduled ? when : "",
    requireScheduled: scheduled,
    now: new Date(),
  });
  const problems = {
    text: text.trim() === "",
    recipients: !recipientsValid(recipients),
    scheduled: schedule.scheduled,
  };
  const valid = !problems.text && !problems.recipients && !problems.scheduled;
  const busy = preparing || create.isPending;

  async function submit() {
    setTouched(true);
    setSent(false);
    if (!valid) return;
    setPrepareFailed(false);

    let upload: Awaited<ReturnType<typeof prepareUpload>>;
    setPreparing(true);
    try {
      upload = await prepareUpload(attachments, sets.data ?? [], t);
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
          text: text.trim(),
          studentIds: recipients.all ? [] : recipients.studentIds,
          scheduledAt: scheduled && when ? fromDateTimeLocal(when) : null,
          attachments: upload.payload,
        },
        files: upload.files,
      },
      {
        onSuccess: () => {
          setText("");
          setAttachments([]);
          setRecipients(ALL_STUDENTS);
          setScheduled(false);
          setWhen("");
          setRequestId(crypto.randomUUID());
          setTouched(false);
          setSent(true);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4" />
          {t("teacher.announcements.new")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field data-invalid={touched && problems.text}>
            <FieldLabel htmlFor={textId}>{t("teacher.announcements.text")}</FieldLabel>
            <Textarea
              id={textId}
              value={text}
              rows={4}
              maxLength={30000}
              aria-invalid={touched && problems.text}
              onChange={(event) => {
                setText(event.target.value);
                setSent(false);
              }}
            />
            {touched && problems.text && <FieldError>{t("teacher.announcements.errors.text")}</FieldError>}
          </Field>

          <Field>
            <FieldLabel>{t("teacher.attachments.title")}</FieldLabel>
            <AttachmentsEditor value={attachments} onChange={setAttachments} disabled={busy} />
          </Field>

          <Field>
            <FieldLabel>{t("teacher.assign.fields.students")}</FieldLabel>
            <StudentPicker courseId={courseId} value={recipients} onChange={setRecipients} disabled={busy} />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor={scheduleId}>{t("teacher.announcements.schedule")}</FieldLabel>
            <Switch id={scheduleId} checked={scheduled} onCheckedChange={setScheduled} disabled={busy} />
          </Field>
          {scheduled && (
            <Field data-invalid={touched && Boolean(problems.scheduled)}>
              <FieldLabel htmlFor={whenId}>{t("teacher.assign.fields.scheduled")}</FieldLabel>
              <Input
                id={whenId}
                type="datetime-local"
                value={when}
                aria-invalid={touched && Boolean(problems.scheduled)}
                onChange={(event) => setWhen(event.target.value)}
              />
              {touched && problems.scheduled && (
                <FieldError>{t(`teacher.assign.errors.${problems.scheduled}`)}</FieldError>
              )}
            </Field>
          )}
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-3">
        <Button className="w-fit" disabled={busy || (touched && !valid)} onClick={() => void submit()}>
          {busy ? <Loader2 className="animate-spin" /> : <Megaphone />}
          {scheduled ? t("teacher.announcements.submitScheduled") : t("teacher.announcements.submit")}
        </Button>
        {prepareFailed && <p className="m-0 text-sm text-destructive">{t("teacher.assign.errors.prepare")}</p>}
        {create.isError && (
          <ClassroomErrorNotice error={create.error} fallback={t("teacher.announcements.errors.create")} />
        )}
        {sent && (
          <Alert>
            <AlertTitle>{t("teacher.announcements.sent")}</AlertTitle>
          </Alert>
        )}
      </CardFooter>
    </Card>
  );
}

function CourseWorkPanel({ courseId }: { courseId: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const work = useCourseWork(courseId);

  if (work.isPending) return <Skeleton className="h-40 w-full" />;
  if (work.isError) {
    return (
      <ClassroomErrorNotice
        error={work.error}
        fallback={t("teacher.work.errors.load")}
        onRetry={() => void work.refetch()}
      />
    );
  }
  if (work.data.length === 0) {
    return <p className="m-0 text-sm text-muted-foreground">{t("teacher.work.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-muted-foreground">{t("teacher.work.hint")}</p>
      {work.data.map((item) => (
        <CourseWorkCard
          key={item.id}
          courseId={courseId}
          work={item}
          format={format}
          onEdit={(assignmentId) => navigate(`/teacher/courses/assign?edit=${encodeURIComponent(assignmentId)}`)}
        />
      ))}
    </div>
  );
}

function CourseWorkCard({
  courseId,
  work,
  format,
  onEdit,
}: {
  courseId: string;
  work: CourseWorkSummary;
  format: (iso: string) => string;
  onEdit: (assignmentId: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{work.title}</CardTitle>
        <CardDescription className="flex flex-wrap gap-x-3">
          <span>{work.dueAt ? t("teacher.mine.dueOn", { date: format(work.dueAt) }) : t("teacher.work.noDue")}</span>
          <span>
            {work.maxPoints ? t("teacher.work.points", { count: work.maxPoints }) : t("teacher.assign.fields.ungraded")}
          </span>
        </CardDescription>
        <CardAction className="flex gap-1">
          {work.state !== "PUBLISHED" && (
            <Badge variant="outline">{t(`teacher.states.${work.state}`, work.state)}</Badge>
          )}
          <Badge variant={work.ownedByApp ? "secondary" : "outline"}>
            {work.ownedByApp ? t("teacher.work.ownedByApp") : t("teacher.work.readOnly")}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex flex-wrap gap-2">
        {work.assignmentId && (
          <Button size="sm" variant="outline" onClick={() => onEdit(work.assignmentId as string)}>
            <Pencil />
            {t("teacher.work.edit")}
          </Button>
        )}
        {work.link && (
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<a href={work.link} target="_blank" rel="noreferrer" className="no-underline" />}
          >
            {t("teacher.common.openInClassroom")}
            <ExternalLink />
          </Button>
        )}
      </CardFooter>
      {work.ownedByApp ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CardContent>
            <CollapsibleTrigger render={<Button size="sm" variant="ghost" />}>
              <ChevronDown className={open ? "rotate-180 transition-transform" : "transition-transform"} />
              {t("teacher.work.progress")}
            </CollapsibleTrigger>
            <CollapsibleContent>
              {open && <SubmissionsTable courseId={courseId} courseWorkId={work.id} maxPoints={work.maxPoints} />}
            </CollapsibleContent>
          </CardContent>
        </Collapsible>
      ) : (
        <CardContent>
          <p className="m-0 text-xs text-muted-foreground">{t("teacher.work.readOnlyHint")}</p>
        </CardContent>
      )}
    </Card>
  );
}

function SubmissionsTable({
  courseId,
  courseWorkId,
  maxPoints,
}: {
  courseId: string;
  courseWorkId: string;
  maxPoints: number | null;
}) {
  const { t } = useTranslation();
  const submissions = useSubmissions(courseId, courseWorkId);

  if (submissions.isPending) return <Skeleton className="mt-3 h-24 w-full" />;
  if (submissions.isError) {
    return (
      <div className="mt-3">
        <ClassroomErrorNotice
          error={submissions.error}
          fallback={t("teacher.work.errors.submissions")}
          onRetry={() => void submissions.refetch()}
        />
      </div>
    );
  }

  const summary = summarizeSubmissions(submissions.data);

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge>{t("teacher.work.summary", { done: summary.turnedIn, total: summary.total })}</Badge>
        {summary.late > 0 && <Badge variant="destructive">{t("teacher.work.lateCount", { count: summary.late })}</Badge>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("teacher.work.columns.student")}</TableHead>
            <TableHead>{t("teacher.work.columns.state")}</TableHead>
            <TableHead className="text-right">{t("teacher.work.columns.grade")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.data.map((submission: Submission) => (
            <TableRow key={submission.userId}>
              <TableCell>{submission.studentName}</TableCell>
              <TableCell className="flex flex-wrap gap-1">
                <Badge variant="outline">{t(`teacher.work.states.${submission.state}`)}</Badge>
                {submission.late && <Badge variant="destructive">{t("teacher.work.late")}</Badge>}
              </TableCell>
              <TableCell className="text-right font-mono">
                {submission.grade === null
                  ? "—"
                  : maxPoints
                    ? `${submission.grade} / ${maxPoints}`
                    : submission.grade}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <FieldDescription>{t("teacher.work.gradingOutOfScope")}</FieldDescription>
    </div>
  );
}
