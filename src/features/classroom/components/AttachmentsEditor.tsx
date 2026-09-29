import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FileText, Link2, Library, Paperclip, Presentation, Search, Upload, Video, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  attachmentName,
  FILE_ACCEPT,
  MAX_FILE_BYTES,
  type DraftAttachment,
} from "@/features/classroom/lib/attachments";
import { MAX_ATTACHMENTS, youtubeId } from "@/lib/classroom";
import { countExercises } from "@/lib/exercises/sets";
import { cn } from "@/lib/utils";
import { useExerciseSets } from "@/services/exercises";
import { listPublishedPresentations } from "@/services/presentations";

const ICONS = {
  link: Link2,
  youtube: Video,
  file: FileText,
  exercise: Library,
  presentation: Presentation,
} as const;

/**
 * The "Adjuntos" section: local files, YouTube videos, links, saved exercise
 * sets and published theory presentations — the kinds the Classroom API can
 * create. Files and sets are uploaded to the teacher's Drive when the item is
 * sent; a presentation travels as a link to its TCP-TRIP reader.
 */
export function AttachmentsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: DraftAttachment[];
  onChange: (next: DraftAttachment[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<"link" | "youtube" | "exercise" | "presentation" | null>(null);
  const [tooLarge, setTooLarge] = useState<string[]>([]);

  const full = value.length >= MAX_ATTACHMENTS;

  function add(items: DraftAttachment[]) {
    onChange([...value, ...items].slice(0, MAX_ATTACHMENTS));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const files = [...list];
    const rejected = files.filter((file) => file.size > MAX_FILE_BYTES).map((file) => file.name);
    setTooLarge(rejected);
    add(
      files
        .filter((file) => file.size <= MAX_FILE_BYTES)
        .map((file) => ({ kind: "file", clientId: crypto.randomUUID(), file })),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <ul className="m-0 flex flex-col gap-2 p-0">
          {value.map((attachment) => {
            const Icon = ICONS[attachment.kind];
            return (
              <li
                key={attachment.clientId}
                className="flex list-none items-center gap-3 rounded-lg border px-3 py-2"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{attachmentName(attachment)}</span>
                <Badge variant="outline">{t(`teacher.attachments.kinds.${attachment.kind}`)}</Badge>
                {attachment.kind === "exercise" && attachment.includeAnswers && (
                  <Badge variant="secondary">{t("teacher.attachments.withAnswers")}</Badge>
                )}
                {!disabled && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t("teacher.attachments.remove", { name: attachmentName(attachment) })}
                    onClick={() =>
                      onChange(value.filter((item) => item.clientId !== attachment.clientId))
                    }
                  >
                    <X />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {value.length === 0 && (
        <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
          <Paperclip className="size-4" />
          {t("teacher.attachments.empty")}
        </p>
      )}

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={full} onClick={() => fileInput.current?.click()}>
            <Upload />
            {t("teacher.attachments.addFile")}
          </Button>
          <Button variant="outline" size="sm" disabled={full} onClick={() => setDialog("youtube")}>
            <Video />
            {t("teacher.attachments.addYoutube")}
          </Button>
          <Button variant="outline" size="sm" disabled={full} onClick={() => setDialog("link")}>
            <Link2 />
            {t("teacher.attachments.addLink")}
          </Button>
          <Button variant="outline" size="sm" disabled={full} onClick={() => setDialog("exercise")}>
            <Library />
            {t("teacher.attachments.addExercise")}
          </Button>
          <Button variant="outline" size="sm" disabled={full} onClick={() => setDialog("presentation")}>
            <Presentation />
            {t("teacher.attachments.addPresentation")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={FILE_ACCEPT}
            className="hidden"
            onChange={(event) => {
              addFiles(event.target.files);
              // Picking the same file twice must still fire `change`.
              event.target.value = "";
            }}
          />
        </div>
      )}

      <p className={cn("m-0 text-xs", full ? "text-destructive" : "text-muted-foreground")}>
        {t("teacher.attachments.limit", { count: value.length, max: MAX_ATTACHMENTS })}
      </p>
      {tooLarge.length > 0 && (
        <p className="m-0 text-sm text-destructive">
          {t("teacher.attachments.tooLarge", { names: tooLarge.join(", "), max: 25 })}
        </p>
      )}

      <UrlDialog
        kind="youtube"
        open={dialog === "youtube"}
        onOpenChange={(open) => setDialog(open ? "youtube" : null)}
        onAdd={(url) => add([{ kind: "youtube", clientId: crypto.randomUUID(), url }])}
      />
      <UrlDialog
        kind="link"
        open={dialog === "link"}
        onOpenChange={(open) => setDialog(open ? "link" : null)}
        onAdd={(url, title) => add([{ kind: "link", clientId: crypto.randomUUID(), url, title }])}
      />
      <ExercisePickerDialog
        open={dialog === "exercise"}
        onOpenChange={(open) => setDialog(open ? "exercise" : null)}
        attachedIds={value.flatMap((item) => (item.kind === "exercise" ? [item.exerciseSetId] : []))}
        onAdd={(set, includeAnswers) =>
          add([
            {
              kind: "exercise",
              clientId: crypto.randomUUID(),
              exerciseSetId: set.id,
              title: set.title,
              includeAnswers,
            },
          ])
        }
      />
      <PresentationPickerDialog
        open={dialog === "presentation"}
        onOpenChange={(open) => setDialog(open ? "presentation" : null)}
        attachedSlugs={value.flatMap((item) => (item.kind === "presentation" ? [item.slug] : []))}
        onAdd={(presentation) =>
          add([
            {
              kind: "presentation",
              clientId: crypto.randomUUID(),
              slug: presentation.slug,
              title: presentation.title,
            },
          ])
        }
      />
    </div>
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function UrlDialog({
  kind,
  open,
  onOpenChange,
  onAdd,
}: {
  kind: "link" | "youtube";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (url: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const urlId = useId();
  const titleId = useId();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = url.trim();
  const valid = kind === "youtube" ? youtubeId(trimmed) !== null : isHttpUrl(trimmed);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setUrl("");
      setTitle("");
      setTouched(false);
    }
  }

  function submit() {
    setTouched(true);
    if (!valid) return;
    onAdd(trimmed, title.trim());
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`teacher.attachments.${kind}Dialog.title`)}</DialogTitle>
          <DialogDescription>{t(`teacher.attachments.${kind}Dialog.description`)}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FieldGroup>
            <Field data-invalid={touched && !valid}>
              <FieldLabel htmlFor={urlId}>{t("teacher.attachments.url")}</FieldLabel>
              <Input
                id={urlId}
                type="url"
                value={url}
                placeholder={kind === "youtube" ? "https://youtu.be/…" : "https://…"}
                aria-invalid={touched && !valid}
                onChange={(event) => setUrl(event.target.value)}
              />
              {touched && !valid && (
                <FieldError>{t(`teacher.attachments.${kind}Dialog.invalid`)}</FieldError>
              )}
            </Field>
            {kind === "link" && (
              <Field>
                <FieldLabel htmlFor={titleId}>{t("teacher.attachments.linkTitle")}</FieldLabel>
                <Input id={titleId} value={title} onChange={(event) => setTitle(event.target.value)} />
                <FieldDescription>{t("teacher.attachments.linkTitleHint")}</FieldDescription>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t("exercises.dialog.cancel")}
            </DialogClose>
            <Button type="submit">{t("teacher.attachments.add")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExercisePickerDialog({
  open,
  onOpenChange,
  attachedIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachedIds: string[];
  onAdd: (set: { id: string; title: string }, includeAnswers: boolean) => void;
}) {
  const { t } = useTranslation();
  const answersId = useId();
  const sets = useExerciseSets(open);
  const [includeAnswers, setIncludeAnswers] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("teacher.attachments.exerciseDialog.title")}</DialogTitle>
          <DialogDescription>{t("teacher.attachments.exerciseDialog.description")}</DialogDescription>
        </DialogHeader>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={answersId}>{t("exercises.dialog.includeAnswers")}</FieldLabel>
            <FieldDescription>{t("teacher.attachments.exerciseDialog.answersHint")}</FieldDescription>
          </FieldContent>
          <Switch id={answersId} checked={includeAnswers} onCheckedChange={setIncludeAnswers} />
        </Field>

        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {sets.isPending && <Skeleton className="h-16 w-full" />}
          {sets.isError && <p className="m-0 text-sm text-destructive">{t("teacher.mine.errors.load")}</p>}
          {sets.data?.length === 0 && (
            <p className="m-0 text-sm text-muted-foreground">{t("teacher.mine.empty.description")}</p>
          )}
          {sets.data?.map((set) => {
            const attached = attachedIds.includes(set.id);
            return (
              <button
                key={set.id}
                type="button"
                disabled={attached}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted disabled:cursor-default disabled:opacity-50"
                onClick={() => {
                  onAdd(set, includeAnswers);
                  onOpenChange(false);
                }}
              >
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{set.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("teacher.mine.exerciseCount", { count: countExercises(set.blocks) })}
                  </span>
                </span>
                {attached && <Badge variant="outline">{t("teacher.attachments.attached")}</Badge>}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Published presentations only: a student opening the link must land on what
 * an administrator approved, never on a draft. Any published deck can be
 * attached — Theory is the course's shared material, not one teacher's.
 */
function PresentationPickerDialog({
  open,
  onOpenChange,
  attachedSlugs,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachedSlugs: string[];
  onAdd: (presentation: { slug: string; title: string }) => void;
}) {
  const { t } = useTranslation();
  const searchId = useId();
  const [search, setSearch] = useState("");
  const published = useQuery({
    queryKey: ["presentations", "published"],
    queryFn: () => listPublishedPresentations(),
    enabled: open,
  });

  const needle = search.trim().toLocaleLowerCase();
  const matches = (published.data ?? []).filter(
    (item) =>
      needle === "" ||
      item.title.toLocaleLowerCase().includes(needle) ||
      item.authorName.toLocaleLowerCase().includes(needle),
  );

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) setSearch("");
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("teacher.attachments.presentationDialog.title")}</DialogTitle>
          <DialogDescription>{t("teacher.attachments.presentationDialog.description")}</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor={searchId} className="sr-only">
            {t("teacher.attachments.presentationDialog.search")}
          </FieldLabel>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchId}
              className="pl-8"
              value={search}
              placeholder={t("teacher.attachments.presentationDialog.search")}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </Field>

        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {published.isPending && <Skeleton className="h-16 w-full" />}
          {published.isError && (
            <p className="m-0 text-sm text-destructive">{t("teacher.attachments.presentationDialog.error")}</p>
          )}
          {published.isSuccess && matches.length === 0 && (
            <p className="m-0 text-sm text-muted-foreground">
              {published.data.length === 0
                ? t("teacher.attachments.presentationDialog.empty")
                : t("teacher.attachments.presentationDialog.noMatch")}
            </p>
          )}
          {matches.map((item) => {
            const attached = attachedSlugs.includes(item.slug);
            return (
              <button
                key={item.slug}
                type="button"
                disabled={attached}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted disabled:cursor-default disabled:opacity-50"
                onClick={() => {
                  onAdd(item);
                  close(false);
                }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("teacher.attachments.presentationDialog.byline", {
                      author: item.authorName,
                      count: item.slideCount,
                    })}
                  </span>
                </span>
                {attached && <Badge variant="outline">{t("teacher.attachments.attached")}</Badge>}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
