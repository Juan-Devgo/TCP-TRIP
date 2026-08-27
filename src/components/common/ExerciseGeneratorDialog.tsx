import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

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
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_EXERCISE_COUNT,
  DIFFICULTIES,
  isDifficulty,
  MAX_EXERCISE_COUNT,
  MIN_EXERCISE_COUNT,
  type Difficulty,
  type ExerciseGenerator,
} from "@/lib/exercises/utils";
import { buildExercisePdf, downloadBlob, exercisePdfFilename } from "@/lib/pdf/exercisePdf";

/**
 * Shared exercise generator: a tool supplies its title and its generator, and
 * gets the same configuration dialog and the same institutional PDF as every
 * other tool.
 */
export function ExerciseGeneratorDialog({
  open,
  onOpenChange,
  toolTitle,
  generator,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already translated: the tool owns its copy. */
  toolTitle: string;
  generator: ExerciseGenerator;
}) {
  const { t } = useTranslation();
  const difficultyId = useId();
  const countId = useId();
  const answersId = useId();

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [count, setCount] = useState(String(DEFAULT_EXERCISE_COUNT));
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [failed, setFailed] = useState(false);

  const parsedCount = Number(count);
  const countIsValid =
    count.trim() !== "" &&
    Number.isInteger(parsedCount) &&
    parsedCount >= MIN_EXERCISE_COUNT &&
    parsedCount <= MAX_EXERCISE_COUNT;

  const difficultyItems = DIFFICULTIES.map((value) => ({
    value,
    label: t(`exercises.difficulty.${value}`),
  }));

  async function generate() {
    if (!countIsValid || generating) return;

    setGenerating(true);
    setFailed(false);
    try {
      const exercises = generator({ difficulty, count: parsedCount, t });
      const blob = await buildExercisePdf({
        exercises,
        toolTitle,
        difficulty,
        includeAnswers,
        t,
      });
      downloadBlob(blob, exercisePdfFilename(toolTitle, difficulty));
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to generate the exercise sheet", error);
      setFailed(true);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("exercises.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("exercises.dialog.description", { tool: toolTitle })}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={difficultyId}>
              {t("exercises.dialog.difficulty")}
            </FieldLabel>
            <Select
              items={difficultyItems}
              value={difficulty}
              onValueChange={(next) => {
                if (isDifficulty(next)) setDifficulty(next);
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

          <Field data-invalid={!countIsValid}>
            <FieldLabel htmlFor={countId}>
              {t("exercises.dialog.count")}
            </FieldLabel>
            <NumberInput
              id={countId}
              min={MIN_EXERCISE_COUNT}
              max={MAX_EXERCISE_COUNT}
              value={count}
              onValueChange={setCount}
              aria-invalid={!countIsValid}
              className="h-9"
            />
            {countIsValid ? (
              <FieldDescription>
                {t("exercises.dialog.countHint", {
                  min: MIN_EXERCISE_COUNT,
                  max: MAX_EXERCISE_COUNT,
                })}
              </FieldDescription>
            ) : (
              <FieldError>
                {t("exercises.dialog.countError", {
                  min: MIN_EXERCISE_COUNT,
                  max: MAX_EXERCISE_COUNT,
                })}
              </FieldError>
            )}
          </Field>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={answersId}>
                {t("exercises.dialog.includeAnswers")}
              </FieldLabel>
              <FieldDescription>
                {t("exercises.dialog.includeAnswersHint")}
              </FieldDescription>
            </FieldContent>
            <Switch
              id={answersId}
              checked={includeAnswers}
              onCheckedChange={setIncludeAnswers}
            />
          </Field>

          {failed && <FieldError>{t("exercises.dialog.error")}</FieldError>}
        </FieldGroup>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={generating} />}>
            {t("exercises.dialog.cancel")}
          </DialogClose>
          <Button
            type="button"
            disabled={!countIsValid || generating}
            onClick={() => void generate()}
          >
            {generating && <Loader2 className="animate-spin" />}
            {generating
              ? t("exercises.dialog.generating")
              : t("exercises.dialog.generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
