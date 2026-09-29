import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Shuffle,
  Trash2,
} from "lucide-react";

import { TeacherGate } from "@/components/common/TeacherGate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EXERCISE_TOOLS, findExerciseTool, renderExerciseSetPdf } from "@/config/exerciseTools";
import {
  fromSet,
  generateBlock,
  isDraftValid,
  isGenerated,
  moveBlock,
  newBlock,
  requestedTotal,
  toSetInput,
  validateDraft,
  type Draft,
  type DraftBlock,
} from "@/features/teacher-exercises/lib/draft";
import { usePageIntent } from "@/hooks/usePageIntent";
import { MAX_SET_EXERCISES } from "@/lib/exercises/sets";
import {
  DIFFICULTIES,
  isDifficulty,
  MAX_EXERCISE_COUNT,
  MIN_EXERCISE_COUNT,
} from "@/lib/exercises/utils";
import { downloadBlob } from "@/lib/pdf/exercisePdf";
import { ApiError } from "@/services/client";
import { useExerciseSet, useSaveExerciseSet } from "@/services/exercises";

const FIRST_TOOL = EXERCISE_TOOLS[0]?.id ?? "";

function emptyDraft(): Draft {
  return { title: "", blocks: [newBlock(FIRST_TOOL)] };
}

export function CreateExercises() {
  return (
    <TeacherGate>
      <ExerciseComposer />
    </TeacherGate>
  );
}

/**
 * `Crear ejercicios`: combine blocks from several tools into one sheet. Same
 * controls as the per-tool generator dialog, one row per block.
 */
function ExerciseComposer() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const titleId = useId();
  const answersId = useId();

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  /** Set when editing a saved (never assigned) set; `null` for a new one. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pdfFailed, setPdfFailed] = useState(false);

  const save = useSaveExerciseSet();

  // `?edit=<id>` from `Mis ejercicios`: load that set into the form.
  const intent = usePageIntent("edit");
  const editing = useExerciseSet(intent.value);
  useEffect(() => {
    if (!intent.value || !editing.data) return;
    setDraft(fromSet(editing.data));
    setEditingId(editing.data.id);
    setSavedId(null);
    setTouched(false);
    save.reset();
    intent.consume();
  }, [intent, editing.data, save]);

  const problems = validateDraft(draft);
  const valid = isDraftValid(problems);
  const generated = isGenerated(draft);
  const total = requestedTotal(draft.blocks);

  function update(next: Draft) {
    setDraft(next);
    setSavedId(null);
  }

  function updateBlock(key: string, patch: Partial<Omit<DraftBlock, "key">>) {
    update({
      ...draft,
      blocks: draft.blocks.map((block) =>
        // Changing what a block asks for discards what it had generated.
        block.key === key ? { ...block, ...patch, exercises: patch.exercises ?? null } : block,
      ),
    });
  }

  function regenerate(key?: string) {
    setTouched(true);
    if (!valid) return;
    update({
      ...draft,
      blocks: draft.blocks.map((block) => {
        if (key && block.key !== key) return block;
        const tool = findExerciseTool(block.toolId);
        return tool ? generateBlock(block, tool, t) : block;
      }),
    });
  }

  async function download() {
    const input = toSetInput(draft, i18n.language);
    if (!input) return;
    setDownloading(true);
    setPdfFailed(false);
    try {
      const file = await renderExerciseSetPdf(input, includeAnswers, t);
      downloadBlob(file, file.name);
    } catch (error) {
      console.error("Failed to render the exercise set", error);
      setPdfFailed(true);
    } finally {
      setDownloading(false);
    }
  }

  function submit() {
    const input = toSetInput(draft, i18n.language);
    if (!input) return;
    save.mutate(
      { id: editingId, input },
      {
        onSuccess: (set) => {
          setSavedId(set.id);
          setEditingId(set.id);
        },
      },
    );
  }

  function startOver() {
    setDraft(emptyDraft());
    setEditingId(null);
    setSavedId(null);
    setTouched(false);
    save.reset();
  }

  const saveError =
    save.error instanceof ApiError && save.error.code === "exercise_set_used"
      ? t("teacher.create.errors.used")
      : save.error
        ? t("teacher.create.errors.save")
        : null;

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0">{t("teacher.create.title")}</h1>
        <p className="m-0 text-muted-foreground">{t("teacher.create.description")}</p>
      </header>

      {editingId && !savedId && (
        <Alert>
          <AlertTitle>{t("teacher.create.editing")}</AlertTitle>
          <AlertDescription>
            <Button variant="link" className="h-auto p-0" onClick={startOver}>
              {t("teacher.create.startOver")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={touched && problems.title}>
              <FieldLabel htmlFor={titleId}>{t("teacher.create.setTitle")}</FieldLabel>
              <Input
                id={titleId}
                value={draft.title}
                placeholder={t("teacher.create.setTitlePlaceholder")}
                aria-invalid={touched && problems.title}
                onChange={(event) => update({ ...draft, title: event.target.value })}
              />
              {touched && problems.title && (
                <FieldError>{t("teacher.create.errors.title")}</FieldError>
              )}
            </Field>

            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={answersId}>{t("exercises.dialog.includeAnswers")}</FieldLabel>
                <FieldDescription>{t("exercises.dialog.includeAnswersHint")}</FieldDescription>
              </FieldContent>
              <Switch id={answersId} checked={includeAnswers} onCheckedChange={setIncludeAnswers} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby={`${titleId}-blocks`}>
        <div className="flex items-center justify-between gap-2">
          <h2 id={`${titleId}-blocks`} className="m-0 text-lg">
            {t("teacher.create.blocks")}
          </h2>
          <Badge variant={problems.tooMany ? "destructive" : "outline"}>
            {t("teacher.create.total", { count: total, max: MAX_SET_EXERCISES })}
          </Badge>
        </div>

        {draft.blocks.map((block, index) => (
          <BlockEditor
            key={block.key}
            block={block}
            index={index}
            last={index === draft.blocks.length - 1}
            countInvalid={problems.counts.has(block.key)}
            onChange={(patch) => updateBlock(block.key, patch)}
            onMove={(to) => update({ ...draft, blocks: moveBlock(draft.blocks, index, to) })}
            onRemove={() =>
              update({ ...draft, blocks: draft.blocks.filter((item) => item.key !== block.key) })
            }
          />
        ))}

        {problems.noBlocks && (
          <p className="m-0 text-sm text-destructive">{t("teacher.create.errors.noBlocks")}</p>
        )}
        {problems.tooMany && (
          <p className="m-0 text-sm text-destructive">
            {t("teacher.create.errors.tooMany", { max: MAX_SET_EXERCISES })}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => update({ ...draft, blocks: [...draft.blocks, newBlock(FIRST_TOOL)] })}
          >
            <Plus />
            {t("teacher.create.addBlock")}
          </Button>
          <Button disabled={touched && !valid} onClick={() => regenerate()}>
            <Shuffle />
            {generated ? t("teacher.create.regenerateAll") : t("teacher.create.generate")}
          </Button>
        </div>
      </section>

      {draft.blocks.some((block) => block.exercises) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("teacher.create.preview")}</CardTitle>
            <CardDescription>{t("teacher.create.previewHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <PreviewList draft={draft} onRegenerate={(key) => regenerate(key)} />
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!generated || downloading}
              onClick={() => void download()}
            >
              {downloading ? <Loader2 className="animate-spin" /> : <Download />}
              {t("teacher.create.download")}
            </Button>
            <Button disabled={!generated || !valid || save.isPending} onClick={submit}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {editingId ? t("teacher.create.saveChanges") : t("teacher.create.save")}
            </Button>
            {!generated && (
              <span className="text-sm text-muted-foreground">
                {t("teacher.create.needsGeneration")}
              </span>
            )}
          </CardFooter>
        </Card>
      )}

      {pdfFailed && <p className="m-0 text-sm text-destructive">{t("exercises.dialog.error")}</p>}
      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      {savedId && (
        <Alert>
          <AlertTitle>{t("teacher.create.saved")}</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-3">
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => navigate(`/teacher/exercises/mine/${savedId}`)}
            >
              {t("teacher.create.openSaved")}
            </Button>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => navigate(`/teacher/courses/assign?exercise=${savedId}`)}
            >
              {t("teacher.create.assignSaved")}
            </Button>
            <Button variant="link" className="h-auto p-0" onClick={startOver}>
              {t("teacher.create.startOver")}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function BlockEditor({
  block,
  index,
  last,
  countInvalid,
  onChange,
  onMove,
  onRemove,
}: {
  block: DraftBlock;
  index: number;
  last: boolean;
  countInvalid: boolean;
  onChange: (patch: Partial<Omit<DraftBlock, "key">>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const toolId = useId();
  const difficultyId = useId();
  const countId = useId();

  const toolItems = EXERCISE_TOOLS.map((tool) => ({ value: tool.id, label: t(tool.titleKey) }));
  const difficultyItems = DIFFICULTIES.map((value) => ({
    value,
    label: t(`exercises.difficulty.${value}`),
  }));

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("teacher.create.block", { number: index + 1 })}</CardTitle>
        <CardAction className="flex gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={index === 0}
            aria-label={t("teacher.create.moveUp")}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUp />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={last}
            aria-label={t("teacher.create.moveDown")}
            onClick={() => onMove(index + 1)}
          >
            <ArrowDown />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("teacher.create.removeBlock")}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem_9rem]">
          <Field>
            <FieldLabel htmlFor={toolId}>{t("teacher.create.tool")}</FieldLabel>
            <Select
              items={toolItems}
              value={block.toolId}
              onValueChange={(next) => {
                if (typeof next === "string") onChange({ toolId: next });
              }}
            >
              <SelectTrigger id={toolId} className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {toolItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor={difficultyId}>{t("exercises.dialog.difficulty")}</FieldLabel>
            <Select
              items={difficultyItems}
              value={block.difficulty}
              onValueChange={(next) => {
                if (isDifficulty(next)) onChange({ difficulty: next });
              }}
            >
              <SelectTrigger id={difficultyId} className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {difficultyItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field data-invalid={countInvalid}>
            <FieldLabel htmlFor={countId}>{t("exercises.dialog.count")}</FieldLabel>
            <NumberInput
              id={countId}
              min={MIN_EXERCISE_COUNT}
              max={MAX_EXERCISE_COUNT}
              value={block.count}
              onValueChange={(count) => onChange({ count })}
              aria-invalid={countInvalid}
              className="h-9"
            />
          </Field>
        </div>
        {countInvalid && (
          <FieldError className="mt-2">
            {t("exercises.dialog.countError", { min: MIN_EXERCISE_COUNT, max: MAX_EXERCISE_COUNT })}
          </FieldError>
        )}
      </CardContent>
    </Card>
  );
}

/** Statements grouped by block, numbered 1..N across blocks as in the PDF. */
function PreviewList({
  draft,
  onRegenerate,
}: {
  draft: Draft;
  onRegenerate: (key: string) => void;
}) {
  const { t } = useTranslation();
  let number = 0;

  return draft.blocks.map((block) => {
    const tool = findExerciseTool(block.toolId);
    const start = number + 1;
    number += block.exercises?.length ?? 0;

    return (
      <div key={block.key} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 text-base">
            {t("exercises.pdf.section", {
              tool: tool ? t(tool.titleKey) : block.toolId,
              difficulty: t(`exercises.difficulty.${block.difficulty}`),
            })}
          </h3>
          <Button size="sm" variant="ghost" onClick={() => onRegenerate(block.key)}>
            <RefreshCw />
            {t("teacher.create.regenerateBlock")}
          </Button>
        </div>
        {block.exercises ? (
          <ol start={start} className="m-0 flex flex-col gap-1 pl-6 font-mono text-sm">
            {block.exercises.map((exercise, index) => (
              <li key={index}>
                {exercise.prompt}
                <span className="block text-muted-foreground">→ {exercise.answer}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">{t("teacher.create.blockPending")}</p>
        )}
      </div>
    );
  });
}
