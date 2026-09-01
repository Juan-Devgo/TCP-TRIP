import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, Redo2, Undo2 } from "lucide-react";

import { shortcutKeys } from "@/context/ToolActionsProvider";
import type { ActionShortcut } from "@/context/ToolActionsProvider";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldTypePalette } from "@/features/protocol-builder/components/FieldTypePalette";
import {
  FieldFormDialog,
  editorTargetKey,
  type EditorTarget,
} from "@/features/protocol-builder/components/FieldFormDialog";
import {
  ProtocolBuilderActions,
  REDO_SHORTCUT,
  UNDO_SHORTCUT,
} from "@/features/protocol-builder/components/ProtocolBuilderActions";
import { ProtocolDiagram } from "@/features/protocol-builder/components/ProtocolDiagram";
import {
  ProtocolClearDialog,
  ProtocolExportDialog,
  ProtocolShareDialog,
  type ExportFormat,
} from "@/features/protocol-builder/components/ProtocolDialogs";
import {
  buildExampleProtocol,
  PROTOCOL_EXAMPLES,
} from "@/features/protocol-builder/lib/examples";
import {
  addGroup,
  addGroupChild,
  addSingleField,
  applyMove,
  createProtocol,
  draftToPatch,
  fieldToDraft,
  findFieldEntry,
  findGroup,
  isFreeField,
  isRulerWidth,
  layoutProtocol,
  lengthForType,
  listFields,
  nudgeField,
  nudgeNode,
  removeField,
  removeNode,
  RULER_WIDTHS,
  setFieldLength,
  setProtocolName,
  setRulerWidth,
  totalBits,
  updateField,
  updateGroup,
  validateProtocol,
  type Protocol,
} from "@/features/protocol-builder/lib/protocol";
import {
  protocolFilename,
  protocolJsonBlob,
  protocolPngBlob,
  protocolSvgBlob,
  toProtocolDocument,
  type DiagramLabels,
} from "@/features/protocol-builder/lib/protocolExport";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { downloadBlob } from "@/lib/pdf/exercisePdf";
import {
  PROTOCOLS_PERSISTED,
  protocolShareUrl,
  saveProtocol,
  shareProtocol,
} from "@/services/protocols";
import { cn } from "@/lib/utils";

type Status = { tone: "ok" | "error"; text: string };

/**
 * The protocol builder: an RFC-style diagram the student edits. Fields are
 * added as free cells, given a type by dragging one out of the palette, and
 * resized against the ruler — the schema only, no wire values.
 *
 * The protocol under construction is a draft and lives here in component
 * state; only `Guardar` hands it to `src/services/protocols.ts`.
 */
export function ProtocolBuilder() {
  const { t } = useTranslation();
  const nameId = useId();
  const rulerId = useId();
  const exampleIndex = useRef(0);

  // Every edit goes through the undo stack, so `Ctrl+Z` takes back whatever
  // the last one was — a field added, a bit dragged, a letter typed.
  const {
    state: protocol,
    set: editProtocol,
    undo: undoEdit,
    redo: redoEdit,
    canUndo,
    canRedo,
  } = useUndoHistory<Protocol>(createProtocol);
  const [armedTypeId, setArmedTypeId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  // A dialog owns the keyboard while it is open: `Ctrl+Z` in one of its text
  // fields has to undo the text, not the protocol behind it.
  const dialogOpen =
    editing !== null || exportOpen || clearOpen || shareUrl !== null;
  const fields = listFields(protocol);
  const issues = validateProtocol(protocol);
  const rowCount = layoutProtocol(protocol).length;
  const untouched = fields.length === 0 && protocol.name.trim() === "";

  const diagramLabels: DiagramLabels = {
    free: t("tools.protocolBuilder.field.free"),
    untitled: t("tools.protocolBuilder.untitled"),
    bits: (count) => t("tools.protocolBuilder.field.bits", { count }),
  };

  // --- editing ------------------------------------------------------------

  function addSingle() {
    editProtocol((current) => addSingleField(current, crypto.randomUUID()));
  }

  function addComposite() {
    editProtocol((current) =>
      addGroup(current, crypto.randomUUID(), [crypto.randomUUID(), crypto.randomUUID()]),
    );
  }

  function addChild(groupId: string) {
    editProtocol((current) => addGroupChild(current, groupId, crypto.randomUUID()));
  }

  /** A type landed on a free cell: open the form already carrying it. */
  function assign(fieldId: string, typeId: string) {
    const entry = findFieldEntry(protocol, fieldId);
    if (!entry) return;

    setArmedTypeId(null);
    setEditing({
      kind: "field",
      fieldId,
      isNew: isFreeField(entry.field),
      draft: {
        ...fieldToDraft(entry.field),
        typeId,
        length: String(lengthForType(typeId, entry.field.length)),
      },
    });
  }

  function editField(fieldId: string) {
    const entry = findFieldEntry(protocol, fieldId);
    if (!entry) return;

    setEditing({
      kind: "field",
      fieldId,
      isNew: isFreeField(entry.field),
      draft: fieldToDraft(entry.field),
    });
  }

  function editGroup(groupId: string) {
    const group = findGroup(protocol, groupId);
    if (!group) return;

    setEditing({
      kind: "group",
      groupId,
      draft: {
        name: group.name,
        meaning: group.meaning,
        documentation: group.documentation,
      },
    });
  }

  function removeEditorTarget(target: EditorTarget) {
    editProtocol((current) =>
      target.kind === "field"
        ? removeField(current, target.fieldId)
        : removeNode(current, target.groupId),
    );
  }

  // --- actions ------------------------------------------------------------

  async function save() {
    if (issues.length > 0) {
      setStatus({
        tone: "error",
        text: t("tools.protocolBuilder.save.blocked", {
          problems: issues
            .map((issue) =>
              t(`tools.protocolBuilder.validation.${issue.code}`, {
                count: issue.count,
              }),
            )
            .join(" · "),
        }),
      });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveProtocol(
        toProtocolDocument(protocol),
        savedId ?? undefined,
      );
      setSavedId(saved.id);
      setStatus({
        tone: "ok",
        text: PROTOCOLS_PERSISTED
          ? t("tools.protocolBuilder.save.saved")
          : t("tools.protocolBuilder.save.savedSession"),
      });
    } catch (error) {
      console.error("Could not save the protocol", error);
      setStatus({ tone: "error", text: t("tools.protocolBuilder.save.error") });
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    // There is nothing behind a link to a protocol that was never saved.
    if (!savedId) {
      setStatus({ tone: "error", text: t("tools.protocolBuilder.share.needsSave") });
      return;
    }

    try {
      const shareId = await shareProtocol(savedId);
      setShareUrl(protocolShareUrl(shareId));
    } catch (error) {
      console.error("Could not share the protocol", error);
      setStatus({ tone: "error", text: t("tools.protocolBuilder.share.error") });
    }
  }

  async function exportAs(format: ExportFormat) {
    try {
      const blob =
        format === "json"
          ? protocolJsonBlob(protocol)
          : format === "svg"
            ? protocolSvgBlob(protocol, diagramLabels)
            : await protocolPngBlob(protocol, diagramLabels);

      downloadBlob(blob, protocolFilename(protocol, format));
      setExportError(null);
      setExportOpen(false);
    } catch (error) {
      console.error("Could not export the protocol", error);
      setExportError(t("tools.protocolBuilder.export.error"));
    }
  }

  function loadExample() {
    const example = PROTOCOL_EXAMPLES[exampleIndex.current % PROTOCOL_EXAMPLES.length];
    exampleIndex.current += 1;
    if (!example) return;

    editProtocol(buildExampleProtocol(example, t));
    // A loaded example is a new draft, not an update to whatever was saved.
    setSavedId(null);
    setStatus(null);
    setArmedTypeId(null);
  }

  function clearAll() {
    editProtocol(createProtocol());
    setSavedId(null);
    setStatus(null);
    setArmedTypeId(null);
    setClearOpen(false);
    exampleIndex.current = 0;
  }

  return (
    <div className="flex w-full flex-col gap-4 pt-6 pb-16">
      <ProtocolBuilderActions
        onUndo={undoEdit}
        onRedo={redoEdit}
        canUndo={canUndo && !dialogOpen}
        canRedo={canRedo && !dialogOpen}
        onSave={() => void save()}
        onShare={() => void share()}
        onExport={() => {
          setExportError(null);
          setExportOpen(true);
        }}
        onLoadExample={loadExample}
        onClear={() => setClearOpen(true)}
        saving={saving}
        isEmpty={untouched}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        <Card className="min-w-0 flex-1 bg-sidebar">
          <CardHeader>
            <CardTitle>{t("tools.protocolBuilder.title")}</CardTitle>
            <CardDescription>{t("tools.protocolBuilder.subtitle")}</CardDescription>
            <CardAction className="flex items-center gap-1">
              <HistoryButton
                label={t("tools.protocolBuilder.actions.undo")}
                shortcut={UNDO_SHORTCUT}
                disabled={!canUndo || dialogOpen}
                onClick={undoEdit}
              >
                <Undo2 />
              </HistoryButton>
              <HistoryButton
                label={t("tools.protocolBuilder.actions.redo")}
                shortcut={REDO_SHORTCUT}
                disabled={!canRedo || dialogOpen}
                onClick={redoEdit}
              >
                <Redo2 />
              </HistoryButton>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("tools.protocolBuilder.intro")}
                    />
                  }
                >
                  <Info />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs text-left">
                  <p>{t("tools.protocolBuilder.intro")}</p>
                </TooltipContent>
              </Tooltip>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <Field className="min-w-48 flex-1">
                <FieldLabel htmlFor={nameId}>
                  {t("tools.protocolBuilder.protocolName")}
                </FieldLabel>
                <Input
                  id={nameId}
                  value={protocol.name}
                  autoComplete="off"
                  placeholder={t("tools.protocolBuilder.protocolNamePlaceholder")}
                  onChange={(event) =>
                    // One undo step per name, not one per keystroke.
                    editProtocol(
                      (current) => setProtocolName(current, event.target.value),
                      "protocolName",
                    )
                  }
                />
              </Field>

              <Field className="w-40">
                <FieldLabel htmlFor={rulerId}>
                  {t("tools.protocolBuilder.rulerWidth")}
                </FieldLabel>
                <Select
                  items={RULER_WIDTHS.map((width) => ({
                    value: String(width),
                    label: t("tools.protocolBuilder.rulerWidthOption", { count: width }),
                  }))}
                  value={String(protocol.rulerWidth)}
                  onValueChange={(next) => {
                    const width = Number(next);
                    if (isRulerWidth(width)) {
                      editProtocol((current) => setRulerWidth(current, width));
                    }
                  }}
                >
                  <SelectTrigger id={rulerId} className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULER_WIDTHS.map((width) => (
                      <SelectItem key={width} value={String(width)}>
                        {t("tools.protocolBuilder.rulerWidthOption", { count: width })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <ProtocolDiagram
              protocol={protocol}
              armedTypeId={armedTypeId}
              onAssign={assign}
              onEditField={editField}
              onEditGroup={editGroup}
              onAddSingle={addSingle}
              onAddComposite={addComposite}
              onAddGroupChild={addChild}
              onRenameGroup={(groupId, name) =>
                editProtocol((current) => updateGroup(current, groupId, { name }))
              }
              onRemoveField={(fieldId) =>
                editProtocol((current) => removeField(current, fieldId))
              }
              onRemoveGroup={(groupId) =>
                editProtocol((current) => removeNode(current, groupId))
              }
              onResizeField={(fieldId, length) =>
                // A drag arrives one bit at a time; it undoes as one resize.
                editProtocol(
                  (current) => setFieldLength(current, fieldId, length),
                  `resize:${fieldId}`,
                )
              }
              onMove={(source, targetFieldId) =>
                editProtocol((current) => applyMove(current, source, targetFieldId))
              }
              onNudge={(source, direction) =>
                editProtocol((current) =>
                  source.kind === "field"
                    ? nudgeField(current, source.id, direction)
                    : nudgeNode(current, source.id, direction),
                )
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 font-mono text-xs text-muted-foreground">
              <span>
                {t("tools.protocolBuilder.summary.fields", { count: fields.length })} ·{" "}
                {t("tools.protocolBuilder.summary.bits", { count: totalBits(protocol) })} ·{" "}
                {t("tools.protocolBuilder.summary.rows", { count: rowCount })}
              </span>
              {armedTypeId && (
                <span className="text-secondary-ink">
                  {t("tools.protocolBuilder.palette.armed", {
                    type: t(`tools.protocolBuilder.types.${armedTypeId}.label`),
                  })}
                </span>
              )}
            </div>

            {status && (
              <p
                role={status.tone === "error" ? "alert" : "status"}
                className={cn(
                  "text-xs",
                  status.tone === "error" ? "text-destructive" : "text-tertiary-ink",
                )}
              >
                {status.text}
              </p>
            )}
          </CardContent>
        </Card>

        <FieldTypePalette
          armedTypeId={armedTypeId}
          onArm={setArmedTypeId}
          className="lg:sticky lg:top-4 lg:w-60 lg:shrink-0"
        />
      </div>

      {editing && (
        <FieldFormDialog
          key={editorTargetKey(editing)}
          target={editing}
          onSubmitField={(fieldId, draft) =>
            editProtocol((current) => updateField(current, fieldId, draftToPatch(draft)))
          }
          onSubmitGroup={(groupId, draft) =>
            editProtocol((current) =>
              updateGroup(current, groupId, {
                name: draft.name.trim(),
                meaning: draft.meaning.trim(),
                documentation: draft.documentation.trim(),
              }),
            )
          }
          onRemove={removeEditorTarget}
          onClose={() => setEditing(null)}
        />
      )}

      <ProtocolExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        onExport={(format) => void exportAs(format)}
        error={exportError}
      />

      <ProtocolShareDialog
        open={shareUrl !== null}
        onOpenChange={(open) => {
          if (!open) setShareUrl(null);
        }}
        url={shareUrl ?? ""}
        live={PROTOCOLS_PERSISTED}
      />

      <ProtocolClearDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        onConfirm={clearAll}
      />
    </div>
  );
}

/**
 * Undo/redo where the diagram is, not only in the toolbar: the same edit is a
 * click away from the field the user is looking at.
 */
function HistoryButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut: ActionShortcut;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-2">
        <span>{label}</span>
        <KbdGroup>
          {shortcutKeys(shortcut).map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}
