import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
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
import { Textarea } from "@/components/ui/textarea";
import {
  FIELD_TYPES,
  findFieldType,
  type FieldType,
} from "@/features/protocol-builder/lib/fieldTypes";
import {
  lengthForType,
  MAX_FIELD_LENGTH,
  MIN_FIELD_LENGTH,
  validateFieldDraft,
  validateGroupDraft,
  type DraftIssue,
  type FieldDraft,
  type GroupDraft,
} from "@/features/protocol-builder/lib/protocol";

/** What the dialog is editing: one cell, or the band a composite draws. */
export type EditorTarget =
  | { kind: "field"; fieldId: string; isNew: boolean; draft: FieldDraft }
  | { kind: "group"; groupId: string; draft: GroupDraft };

export function editorTargetKey(target: EditorTarget): string {
  return target.kind === "field" ? `field:${target.fieldId}` : `group:${target.groupId}`;
}

/**
 * The one form every field goes through — dropping a type on a free cell opens
 * it to create, clicking a defined cell opens the same form to update. The
 * composite band reuses it with the type and the length taken out, since a
 * group has a name and a meaning but no bits of its own.
 */
export function FieldFormDialog({
  target,
  onSubmitField,
  onSubmitGroup,
  onRemove,
  onClose,
}: {
  target: EditorTarget;
  onSubmitField: (fieldId: string, draft: FieldDraft) => void;
  onSubmitGroup: (groupId: string, draft: GroupDraft) => void;
  /** Deletes the field or the whole group; absent while creating. */
  onRemove: (target: EditorTarget) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [showErrors, setShowErrors] = useState(false);

  const isField = target.kind === "field";
  const [fieldDraft, setFieldDraft] = useState<FieldDraft>(() =>
    isField ? target.draft : emptyFieldDraft(),
  );
  const [groupDraft, setGroupDraft] = useState<GroupDraft>(() =>
    isField ? { name: "", meaning: "", documentation: "" } : target.draft,
  );

  const issues = isField
    ? validateFieldDraft(fieldDraft)
    : validateGroupDraft(groupDraft);
  const type = findFieldType(fieldDraft.typeId);

  function close() {
    setOpen(false);
    onClose();
  }

  function submit() {
    if (Object.keys(issues).length > 0) {
      setShowErrors(true);
      return;
    }
    if (target.kind === "field") onSubmitField(target.fieldId, fieldDraft);
    else onSubmitGroup(target.groupId, groupDraft);
    close();
  }

  function error(key: string): DraftIssue | undefined {
    return showErrors ? issues[key] : undefined;
  }

  const canDelete = target.kind === "group" || !target.isNew;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(
              target.kind === "group"
                ? "tools.protocolBuilder.form.groupTitle"
                : target.isNew
                  ? "tools.protocolBuilder.form.createTitle"
                  : "tools.protocolBuilder.form.editTitle",
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              target.kind === "group"
                ? "tools.protocolBuilder.form.groupDescription"
                : "tools.protocolBuilder.form.description",
            )}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="max-h-[60vh] -mx-1 overflow-x-hidden overflow-y-auto px-1">
          {target.kind === "field" ? (
            <FieldInputs
              draft={fieldDraft}
              type={type}
              onChange={setFieldDraft}
              error={error}
            />
          ) : (
            <GroupInputs draft={groupDraft} onChange={setGroupDraft} error={error} />
          )}
        </FieldGroup>

        <DialogFooter className="sm:justify-between">
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onRemove(target);
                close();
              }}
            >
              <Trash2 />
              {t("tools.protocolBuilder.form.delete")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {t("tools.protocolBuilder.form.cancel")}
            </Button>
            <Button type="button" onClick={submit}>
              {t("tools.protocolBuilder.form.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyFieldDraft(): FieldDraft {
  return {
    typeId: null,
    name: "",
    meaning: "",
    length: String(MIN_FIELD_LENGTH),
    documentation: "",
    options: {},
  };
}

function FieldInputs({
  draft,
  type,
  onChange,
  error,
}: {
  draft: FieldDraft;
  type: FieldType | undefined;
  onChange: (draft: FieldDraft) => void;
  error: (key: string) => DraftIssue | undefined;
}) {
  const { t } = useTranslation();
  const typeId = useId();
  const nameId = useId();
  const meaningId = useId();
  const lengthId = useId();
  const docsId = useId();

  const typeItems = FIELD_TYPES.map((item) => ({
    value: item.id,
    label: t(`tools.protocolBuilder.types.${item.id}.label`),
  }));

  const fixed = type?.fixedLength ?? null;
  const max = type?.maxLength ?? MAX_FIELD_LENGTH;

  return (
    <>
      <Field data-invalid={Boolean(error("typeId"))}>
        <FieldLabel htmlFor={typeId}>
          {t("tools.protocolBuilder.form.type")}
        </FieldLabel>
        <Select
          items={typeItems}
          value={draft.typeId}
          onValueChange={(next) => {
            const nextId = typeof next === "string" ? next : null;
            // A new type brings its own length and its own extra questions.
            onChange({
              ...draft,
              typeId: nextId,
              length: String(lengthForType(nextId, Number(draft.length))),
              options: {},
            });
          }}
        >
          <SelectTrigger id={typeId} className="h-9 w-full">
            <SelectValue
              placeholder={t("tools.protocolBuilder.form.typePlaceholder")}
            />
          </SelectTrigger>
          <SelectContent>
            {typeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {type ? (
          <FieldDescription>
            {t(`tools.protocolBuilder.types.${type.id}.description`)}
          </FieldDescription>
        ) : (
          <IssueText issue={error("typeId")} />
        )}
      </Field>

      <Field data-invalid={Boolean(error("name"))}>
        <FieldLabel htmlFor={nameId}>
          {t("tools.protocolBuilder.form.name")}
        </FieldLabel>
        <Input
          id={nameId}
          value={draft.name}
          autoComplete="off"
          placeholder={t("tools.protocolBuilder.form.namePlaceholder")}
          aria-invalid={Boolean(error("name"))}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
        <IssueText issue={error("name")} />
      </Field>

      <Field data-invalid={Boolean(error("meaning"))}>
        <FieldLabel htmlFor={meaningId}>
          {t("tools.protocolBuilder.form.meaning")}
        </FieldLabel>
        <Textarea
          id={meaningId}
          rows={2}
          value={draft.meaning}
          placeholder={t("tools.protocolBuilder.form.meaningPlaceholder")}
          aria-invalid={Boolean(error("meaning"))}
          onChange={(event) => onChange({ ...draft, meaning: event.target.value })}
        />
        <IssueText issue={error("meaning")} />
      </Field>

      <Field data-invalid={Boolean(error("length"))}>
        <FieldLabel htmlFor={lengthId}>
          {t("tools.protocolBuilder.form.length")}
        </FieldLabel>
        {fixed === null ? (
          <NumberInput
            id={lengthId}
            min={MIN_FIELD_LENGTH}
            max={max}
            value={draft.length}
            onValueChange={(length) => onChange({ ...draft, length })}
            aria-invalid={Boolean(error("length"))}
            className="h-9"
            inputClassName="font-mono"
          />
        ) : (
          <Input
            id={lengthId}
            readOnly
            value={String(fixed)}
            className="font-mono"
            aria-describedby={`${lengthId}-fixed`}
          />
        )}
        {fixed === null ? (
          error("length") ? (
            <IssueText issue={error("length")} />
          ) : (
            <FieldDescription>
              {t("tools.protocolBuilder.form.lengthHint", {
                min: MIN_FIELD_LENGTH,
                max,
              })}
            </FieldDescription>
          )
        ) : (
          <FieldDescription id={`${lengthId}-fixed`}>
            {t("tools.protocolBuilder.form.lengthFixed", { count: fixed })}
          </FieldDescription>
        )}
      </Field>

      {type?.options.map((option) => {
        const value = draft.options[option.id] ?? "";
        const issue = error(`option:${option.id}`);
        const setValue = (next: string) =>
          onChange({ ...draft, options: { ...draft.options, [option.id]: next } });

        return (
          <Field key={option.id} data-invalid={Boolean(issue)}>
            <FieldLabel htmlFor={`${typeId}-${option.id}`}>
              {t(`tools.protocolBuilder.options.${option.id}.label`)}
            </FieldLabel>
            {option.kind === "textarea" ? (
              <Textarea
                id={`${typeId}-${option.id}`}
                rows={3}
                value={value}
                aria-invalid={Boolean(issue)}
                placeholder={t(`tools.protocolBuilder.options.${option.id}.placeholder`)}
                onChange={(event) => setValue(event.target.value)}
              />
            ) : (
              <Input
                id={`${typeId}-${option.id}`}
                value={value}
                autoComplete="off"
                aria-invalid={Boolean(issue)}
                placeholder={t(`tools.protocolBuilder.options.${option.id}.placeholder`)}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
            {issue ? (
              <IssueText issue={issue} />
            ) : (
              <FieldDescription>
                {t(`tools.protocolBuilder.options.${option.id}.hint`)}
              </FieldDescription>
            )}
          </Field>
        );
      })}

      <Field>
        <FieldLabel htmlFor={docsId}>
          {t("tools.protocolBuilder.form.documentation")}
        </FieldLabel>
        <Textarea
          id={docsId}
          rows={2}
          value={draft.documentation}
          placeholder={t("tools.protocolBuilder.form.documentationPlaceholder")}
          onChange={(event) =>
            onChange({ ...draft, documentation: event.target.value })
          }
        />
        <FieldDescription>
          {t("tools.protocolBuilder.form.documentationHint")}
        </FieldDescription>
      </Field>
    </>
  );
}

function GroupInputs({
  draft,
  onChange,
  error,
}: {
  draft: GroupDraft;
  onChange: (draft: GroupDraft) => void;
  error: (key: string) => DraftIssue | undefined;
}) {
  const { t } = useTranslation();
  const nameId = useId();
  const meaningId = useId();
  const docsId = useId();

  return (
    <>
      <Field data-invalid={Boolean(error("name"))}>
        <FieldLabel htmlFor={nameId}>
          {t("tools.protocolBuilder.form.groupName")}
        </FieldLabel>
        <Input
          id={nameId}
          value={draft.name}
          autoComplete="off"
          placeholder={t("tools.protocolBuilder.form.groupNamePlaceholder")}
          aria-invalid={Boolean(error("name"))}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
        <IssueText issue={error("name")} />
      </Field>

      <Field data-invalid={Boolean(error("meaning"))}>
        <FieldLabel htmlFor={meaningId}>
          {t("tools.protocolBuilder.form.meaning")}
        </FieldLabel>
        <Textarea
          id={meaningId}
          rows={2}
          value={draft.meaning}
          placeholder={t("tools.protocolBuilder.form.groupMeaningPlaceholder")}
          aria-invalid={Boolean(error("meaning"))}
          onChange={(event) => onChange({ ...draft, meaning: event.target.value })}
        />
        <IssueText issue={error("meaning")} />
      </Field>

      <Field>
        <FieldLabel htmlFor={docsId}>
          {t("tools.protocolBuilder.form.documentation")}
        </FieldLabel>
        <Textarea
          id={docsId}
          rows={2}
          value={draft.documentation}
          placeholder={t("tools.protocolBuilder.form.documentationPlaceholder")}
          onChange={(event) =>
            onChange({ ...draft, documentation: event.target.value })
          }
        />
      </Field>
    </>
  );
}

/** Turns a validation code into the sentence the reader sees. */
function IssueText({ issue }: { issue: DraftIssue | undefined }) {
  const { t } = useTranslation();
  if (!issue) return null;

  const message =
    issue.code === "required"
      ? t("tools.protocolBuilder.form.errors.required")
      : issue.code === "range"
        ? t("tools.protocolBuilder.form.errors.range", {
            min: issue.min,
            max: issue.max,
          })
        : t("tools.protocolBuilder.form.errors.fixed", { count: issue.length });

  return <FieldError>{message}</FieldError>;
}
