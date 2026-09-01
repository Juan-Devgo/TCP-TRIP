import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CornerDownRight, Pencil, Plus, Trash2 } from "lucide-react";

import { BitRuler } from "@/features/protocol-builder/components/BitRuler";
import {
  ACCENT_CELL,
  FIELD_MOVE_MIME,
  FIELD_TYPE_MIME,
} from "@/features/protocol-builder/components/accent";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { findFieldType, isFieldTypeId } from "@/features/protocol-builder/lib/fieldTypes";
import {
  isFreeField,
  layoutProtocol,
  listFields,
  MIN_FIELD_LENGTH,
  resolveMove,
  type FieldEntry,
  type FieldSegment,
  type GroupNode,
  type LayoutRow,
  type MoveSource,
  type Protocol,
} from "@/features/protocol-builder/lib/protocol";
import { useIsTabActive } from "@/context/TabsProvider";
import { cn } from "@/lib/utils";

/**
 * Overlays leave the diagram in the DOM: a click inside one is not a click
 * away from the selection, so it must not drop it.
 */
const OVERLAY = '[role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"]';

/**
 * The app's provider opens tooltips instantly, which turns a pointer crossing
 * the diagram into a strobe of popups: here they wait for it to settle. The
 * delay is a provider's, not a tooltip's, so the diagram brings its own.
 */
const HOVER_DELAY = 400;

/** A key aimed at text is never a diagram shortcut — `Backspace` least of all. */
function isTyping(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
}

/**
 * A group's run of cells inside one row, drawn as a single strip above them.
 * A band that wraps is cut like the fields under it: one strip per row.
 */
type Band = { group: GroupNode; column: number; span: number };

/** The bands of one row, merging the members of a group into one strip. */
function groupBands(row: LayoutRow, groups: Map<string, GroupNode>): Band[] {
  const bands: Band[] = [];

  for (const segment of row.segments) {
    if (segment.groupId === null) continue;

    const column = segment.offset - row.startBit;
    const open = bands.at(-1);
    if (open && open.group.id === segment.groupId && open.column + open.span === column) {
      open.span += segment.length;
      continue;
    }

    const group = groups.get(segment.groupId);
    if (group) bands.push({ group, column, span: segment.length });
  }

  return bands;
}

/** Whether a source — dragged or selected — is the one this cell belongs to. */
function marks(source: MoveSource | null, fieldId: string, nodeId: string): boolean {
  if (source === null) return false;
  return source.kind === "field" ? source.id === fieldId : source.id === nodeId;
}

/**
 * The editable RFC diagram: the ruler, then the fields flowed across rows of
 * `rulerWidth` bits. A field wider than what is left in a row is cut and
 * continued on the next one, which is what an RFC header looks like.
 */
export function ProtocolDiagram({
  protocol,
  armedTypeId,
  onAssign,
  onEditField,
  onEditGroup,
  onRenameGroup,
  onAddSingle,
  onAddComposite,
  onAddGroupChild,
  onRemoveField,
  onRemoveGroup,
  onResizeField,
  onMove,
  onNudge,
}: {
  protocol: Protocol;
  /** Type picked in the palette; the next free cell clicked takes it. */
  armedTypeId: string | null;
  onAssign: (fieldId: string, typeId: string) => void;
  onEditField: (fieldId: string) => void;
  onEditGroup: (groupId: string) => void;
  /** The band's inline rename: the name only, without opening the form. */
  onRenameGroup: (groupId: string, name: string) => void;
  onAddSingle: () => void;
  onAddComposite: () => void;
  onAddGroupChild: (groupId: string) => void;
  onRemoveField: (fieldId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onResizeField: (fieldId: string, length: number) => void;
  /** The dragged source takes the place of the field it was dropped on. */
  onMove: (source: MoveSource, targetFieldId: string) => void;
  onNudge: (source: MoveSource, direction: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const isTabActive = useIsTabActive();
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [drag, setDrag] = useState<MoveSource | null>(null);
  const [target, setTarget] = useState<MoveSource | null>(null);
  // Clicking a field picks it up for the keyboard instead of opening the form.
  const [selection, setSelection] = useState<MoveSource | null>(null);
  // A band only shows its name and its pencil while the pointer is on it or
  // on one of its members; otherwise the composite is just its border.
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  // A reorder remounts the cells (their key carries the bit offset), so the
  // keyboard path has to put the focus back on the field it just moved.
  const refocus = useRef<string | null>(null);

  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-move-focus="${CSS.escape(id)}"]`)
      ?.focus();
  });

  // Escape and Ctrl+Arrow only reach the cell while it holds the focus, so a
  // click anywhere else would leave a selection the keyboard can no longer
  // reach. Drop it — and the focus with it, since a click on something that
  // takes no focus would otherwise keep the ring on the cell.
  useEffect(() => {
    if (!selection || !isTabActive) return;

    const clear = (event: PointerEvent) => {
      const root = rootRef.current;
      const clicked = event.target as Element | null;
      if (!root || !clicked) return;
      if (root.contains(clicked) || clicked.closest(OVERLAY)) return;

      const focused = document.activeElement;
      if (focused instanceof HTMLElement && root.contains(focused)) focused.blur();
      setSelection(null);
    };

    document.addEventListener("pointerdown", clear);
    return () => document.removeEventListener("pointerdown", clear);
  }, [selection, isTabActive]);

  // A drop leaves the thing picked up but not focused — the cell it lived in
  // is gone (its key carries the bit offset, so a move remounts it) and a band
  // collapses the moment the pointer leaves it — so the cell's own Escape and
  // Supr have nothing to fire on. Answer for the whole document instead: as
  // long as something is selected, Escape drops it and Supr/Backspace deletes
  // it, wherever the focus happens to be. Anything with its own handling (the
  // rename input, a dialog) stops the event before it reaches here, and a cell
  // that acted on the key first marks the event handled.
  useEffect(() => {
    if (!selection || !isTabActive) return;

    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const from = event.target as Element | null;
      if (from?.closest(OVERLAY) || isTyping(from)) return;

      const escape = event.key === "Escape";
      const erase = event.key === "Delete" || event.key === "Backspace";
      if (!escape && !erase) return;
      // Backspace outside a text field still means «back» to the browser.
      if (erase) event.preventDefault();

      const focused = document.activeElement;
      const root = rootRef.current;
      if (focused instanceof HTMLElement && root?.contains(focused)) focused.blur();

      if (erase) {
        if (selection.kind === "field") onRemoveField(selection.id);
        else onRemoveGroup(selection.id);
      }
      setSelection(null);
    };

    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, [selection, isTabActive, onRemoveField, onRemoveGroup]);

  const rows = layoutProtocol(protocol);
  const entries = new Map(
    listFields(protocol).map((entry) => [entry.field.id, entry] as const),
  );
  const groups = new Map<string, GroupNode>();
  for (const node of protocol.nodes) {
    if (node.kind === "group") groups.set(node.id, node);
  }

  /** Bits per pixel, read from the live grid so a resize follows the ruler. */
  function bitWidth(): number {
    const width = gridRef.current?.getBoundingClientRect().width ?? 0;
    return width > 0 ? width / protocol.rulerWidth : 0;
  }

  function startResize(
    event: React.PointerEvent<HTMLElement>,
    fieldId: string,
    startLength: number,
  ) {
    const perBit = bitWidth();
    if (perBit === 0) return;

    const startX = event.clientX;
    event.preventDefault();

    // Tracked so dragging back to where the drag began restores the original
    // length: skipping `delta === 0` would leave the field at the last
    // non-zero delta and make the resize impossible to take back.
    let applied = startLength;

    const move = (moveEvent: PointerEvent) => {
      const length = startLength + Math.round((moveEvent.clientX - startX) / perBit);
      if (length === applied) return;
      applied = length;
      onResizeField(fieldId, length);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  /** Answers whether the hovered cell accepts the drag, and rings the place. */
  function moveOver(targetFieldId: string): boolean {
    if (!drag) return false;
    const next = resolveMove(protocol, drag, targetFieldId);
    setTarget(next);
    return next !== null;
  }

  function startMove(source: MoveSource) {
    setDrag(source);
    // Dropping leaves the thing picked up, so the keyboard can carry on.
    setSelection(source);
  }

  function endMove() {
    setDrag(null);
    setTarget(null);
  }

  /** `focusId` is the cell the keystroke came from: where the focus returns. */
  function nudge(source: MoveSource, direction: -1 | 1, focusId: string) {
    refocus.current = focusId;
    onNudge(source, direction);
  }

  /** What `Supr`/`Backspace` and the Delete button both do. */
  function remove() {
    if (!selection) return;
    if (selection.kind === "field") onRemoveField(selection.id);
    else onRemoveGroup(selection.id);
    setSelection(null);
  }

  const columns = { gridTemplateColumns: `repeat(${protocol.rulerWidth}, minmax(0, 1fr))` };

  return (
    <TooltipProvider delay={HOVER_DELAY}>
      <div ref={rootRef} className="flex flex-col gap-3">
        {/* Below this the columns stop being readable, so the diagram scrolls
            instead of squeezing thirty-two bits into a phone. */}
        <div className="overflow-x-auto pb-1">
          <div className="min-w-136 m-2">
            <BitRuler width={protocol.rulerWidth} className="mb-1" />

            <div
              ref={gridRef}
              className="flex flex-col gap-1"
              // One handler for the whole grid: crossing from a member to its
              // band and back never flickers, since both answer with the same
              // group and the state simply does not change.
              onPointerOver={(event) => {
                const from = event.target as Element;
                const over = from.closest("[data-group]");
                if (over) {
                  setHoveredGroup(over.getAttribute("data-group"));
                  return;
                }
                // Nothing under the pointer but the grid itself: it is crossing
                // a gap between cells, not leaving the composite. Only landing
                // on another cell — or leaving the diagram — puts the band away.
                if (from.closest("[data-cell]")) setHoveredGroup(null);
              }}
              onPointerLeave={() => setHoveredGroup(null)}
            >
              {rows.map((row) => {
                const bands = groupBands(row, groups);

                return (
                  <div key={row.index} className="flex flex-col">
                    {bands.length > 0 && (
                      // `items-end` so a collapsed band stays flush on its
                      // cells while a sibling band in the same row is open.
                      <div className="grid items-end gap-1" style={columns}>
                        {bands.map((band) => (
                          <GroupBand
                            key={`${band.group.id}-${band.column}`}
                            band={band}
                            hovered={hoveredGroup === band.group.id}
                            selected={
                              selection?.kind === "node" && selection.id === band.group.id
                            }
                            onSelect={setSelection}
                            onRename={onRenameGroup}
                            onEdit={onEditGroup}
                            onMoveStart={startMove}
                            onMoveEnd={endMove}
                            onNudge={nudge}
                            onRemove={remove}
                          />
                        ))}
                      </div>
                    )}

                    <div className="grid gap-1" style={columns}>
                      {row.segments.map((segment, index) => {
                        const entry = entries.get(segment.fieldId);
                        if (!entry) return null;

                        // Where the group's run starts and ends in this row:
                        // the two cells that carry the outer edges of its ring.
                        const previous = row.segments[index - 1];
                        const next = row.segments[index + 1];

                        return (
                          <DiagramCell
                            key={`${segment.fieldId}-${segment.offset}`}
                            segment={segment}
                            entry={entry}
                            runStart={previous?.groupId !== segment.groupId}
                            runEnd={next?.groupId !== segment.groupId}
                            armedTypeId={armedTypeId}
                            isDropTarget={dropTarget === segment.fieldId}
                            drag={drag}
                            target={target}
                            selection={selection}
                            onDropTargetChange={setDropTarget}
                            onAssign={onAssign}
                            onEditField={onEditField}
                            onAddGroupChild={onAddGroupChild}
                            onResizeField={onResizeField}
                            onStartResize={startResize}
                            onSelect={setSelection}
                            onMoveStart={startMove}
                            onMoveOver={moveOver}
                            onMoveDrop={onMove}
                            onMoveEnd={endMove}
                            onNudge={nudge}
                            onRemove={remove}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {rows.length === 0 && (
                <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-4 py-10 text-center">
                  <p className="font-medium">
                    {t("tools.protocolBuilder.empty.title")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("tools.protocolBuilder.empty.hint")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AddFieldButton onAddSingle={onAddSingle} onAddComposite={onAddComposite} />

          <SelectionButtons
            selection={selection}
            onEdit={() => {
              if (!selection) return;
              if (selection.kind === "field") onEditField(selection.id);
              else onEditGroup(selection.id);
            }}
            onRemove={remove}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

/**
 * The strip above a composite's cells. At rest it has no height at all: only
 * the top edge of the border that closes around the group's members, so rows
 * of a diagram full of composites stay as tight as ungrouped ones. Put the
 * pointer anywhere on the composite and it opens, pushing the rows apart to
 * make room for the name and the pencil.
 *
 * It is also where the band is renamed: click to select, double-click (or
 * `F2`) to rename in place, pencil for the full form.
 */
function GroupBand({
  band,
  hovered,
  selected,
  onSelect,
  onRename,
  onEdit,
  onMoveStart,
  onMoveEnd,
  onNudge,
  onRemove,
}: {
  band: Band;
  /** The pointer is on the band or on one of its members. */
  hovered: boolean;
  selected: boolean;
  onSelect: (source: MoveSource | null) => void;
  onRename: (groupId: string, name: string) => void;
  onEdit: (groupId: string) => void;
  onMoveStart: (source: MoveSource) => void;
  onMoveEnd: () => void;
  onNudge: (source: MoveSource, direction: -1 | 1, focusId: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { group } = band;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(group.name);

  const name = group.name.trim() || t("tools.protocolBuilder.group.untitled");
  const source: MoveSource = { kind: "node", id: group.id };
  // A selected band keeps its name in view: it is what the buttons act on.
  const shown = hovered || selected || renaming;

  function startRenaming() {
    setDraft(group.name);
    setRenaming(true);
  }

  function commit() {
    setRenaming(false);
    if (draft.trim() !== group.name.trim()) onRename(group.id, draft.trim());
  }

  return (
    <div
      data-group={group.id}
      data-selected={selected || undefined}
      data-shown={shown || undefined}
      style={{ gridColumn: `${band.column + 1} / span ${band.span}` }}
      className={cn(
        "group/band flex h-0 min-w-0 items-center gap-1 overflow-hidden rounded-t-md border border-b-0 border-secondary/60 px-1",
        "transition-[height,background-color] duration-200",
        // The strip only takes room while it is being read; the rest of the
        // time it is the 1px lid of the border ringing the members, and the
        // rows below sit as close together as ungrouped ones.
        "focus-within:h-6 data-shown:h-6",
        "data-shown:overflow-visible focus-within:overflow-visible",
        "data-shown:bg-secondary/15",
        "data-selected:ring-2 data-selected:ring-primary",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1 opacity-0 transition-opacity",
          // Hidden it must not be clickable, but it stays in the tab order:
          // reaching it with the keyboard is what brings it back.
          "pointer-events-none group-focus-within/band:pointer-events-auto group-focus-within/band:opacity-100",
          shown && "pointer-events-auto opacity-100",
        )}
      >
        {renaming ? (
          <Input
            autoFocus
            value={draft}
            aria-label={t("tools.protocolBuilder.group.renameLabel", { name })}
            placeholder={t("tools.protocolBuilder.form.groupNamePlaceholder")}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") commit();
              if (event.key === "Escape") setRenaming(false);
            }}
            className="h-5 min-w-0 flex-1 px-1 py-0 text-[11px]"
          />
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(FIELD_MOVE_MIME, group.id);
                      event.dataTransfer.effectAllowed = "move";
                      onMoveStart(source);
                    }}
                    onDragEnd={onMoveEnd}
                    onClick={() => onSelect(source)}
                    onDoubleClick={startRenaming}
                    onKeyDown={(event) => {
                      if (event.key === "F2" || event.key === "Enter") {
                        event.preventDefault();
                        startRenaming();
                        return;
                      }
                      if (event.key === "Escape") {
                        onSelect(null);
                        return;
                      }
                      if (event.key === "Delete" || event.key === "Backspace") {
                        event.preventDefault();
                        onRemove();
                        return;
                      }
                      if (!event.ctrlKey && !event.metaKey) return;
                      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                      event.preventDefault();
                      onNudge(source, event.key === "ArrowRight" ? 1 : -1, group.id);
                    }}
                    aria-pressed={selected}
                    aria-label={t("tools.protocolBuilder.group.selectLabel", { name })}
                    aria-keyshortcuts="F2 Delete Control+ArrowLeft Control+ArrowRight"
                    data-move-focus={group.id}
                    className="min-w-0 flex-1 cursor-grab truncate text-left text-[11px] font-semibold text-secondary-ink active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  />
                }
              >
                {group.name.trim() === "" ? (
                  <span className="italic opacity-80">{name}</span>
                ) : (
                  name
                )}
              </TooltipTrigger>
              <TooltipContent side="top" className="flex-col items-start gap-1 text-left">
                <p className="font-medium">{name}</p>
                <p className="opacity-80">
                  {group.meaning.trim() || t("tools.protocolBuilder.group.noMeaning")}
                </p>
              </TooltipContent>
            </Tooltip>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              draggable={false}
              onClick={() => onEdit(group.id)}
              aria-label={t("tools.protocolBuilder.group.editLabel", { name })}
              className="size-4 shrink-0 text-secondary-ink"
            >
              <Pencil className="size-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * What a selected field or band can do besides move. They sit next to «Add
 * field» rather than in a bar that appears with the selection: a control that
 * comes and goes is a control nobody counts on being there.
 */
function SelectionButtons({
  selection,
  onEdit,
  onRemove,
}: {
  selection: MoveSource | null;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const idle = selection === null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button type="button" variant="secondary" disabled={idle} onClick={onEdit} />
          }
        >
          <Pencil />
          {t("tools.protocolBuilder.select.edit")}
        </TooltipTrigger>
        <TooltipContent>
          <KbdGroup>
            <Kbd>{t("tools.protocolBuilder.select.doubleClick")}</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="destructive"
              disabled={idle}
              onClick={onRemove}
            />
          }
        >
          <Trash2 />
          {t("tools.protocolBuilder.select.delete")}
        </TooltipTrigger>
        <TooltipContent>
          <KbdGroup>
            <Kbd>{t("tools.protocolBuilder.keys.delete")}</Kbd>
            <Kbd>{t("tools.protocolBuilder.keys.backspace")}</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
    </>
  );
}

function DiagramCell({
  segment,
  entry,
  runStart,
  runEnd,
  armedTypeId,
  isDropTarget,
  drag,
  target,
  selection,
  onDropTargetChange,
  onAssign,
  onEditField,
  onAddGroupChild,
  onResizeField,
  onStartResize,
  onSelect,
  onMoveStart,
  onMoveOver,
  onMoveDrop,
  onMoveEnd,
  onNudge,
  onRemove,
}: {
  segment: FieldSegment;
  entry: FieldEntry;
  /** First cell of its group's run in this row: the ring's left edge. */
  runStart: boolean;
  /** Last cell of its group's run in this row: the ring's right edge. */
  runEnd: boolean;
  armedTypeId: string | null;
  isDropTarget: boolean;
  /** The field or band travelling in the current diagram drag, if any. */
  drag: MoveSource | null;
  /** The place that drag would take — the ringed cell. */
  target: MoveSource | null;
  selection: MoveSource | null;
  onDropTargetChange: (fieldId: string | null) => void;
  onAssign: (fieldId: string, typeId: string) => void;
  onEditField: (fieldId: string) => void;
  onAddGroupChild: (groupId: string) => void;
  onResizeField: (fieldId: string, length: number) => void;
  onStartResize: (
    event: React.PointerEvent<HTMLElement>,
    fieldId: string,
    startLength: number,
  ) => void;
  onSelect: (source: MoveSource | null) => void;
  onMoveStart: (source: MoveSource) => void;
  onMoveOver: (targetFieldId: string) => boolean;
  onMoveDrop: (source: MoveSource, targetFieldId: string) => void;
  onMoveEnd: () => void;
  onNudge: (source: MoveSource, direction: -1 | 1, focusId: string) => void;
  /** What `Supr`/`Backspace` does to whatever is selected. */
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { field, group } = entry;
  const free = isFreeField(field);
  const type = findFieldType(field.typeId);
  const resizable = type != null && type.fixedLength === null && !segment.continues;

  // A loose field is its own node, so one id answers for both shapes.
  const nodeId = group?.id ?? field.id;
  const travelling = marks(drag, field.id, nodeId);
  const isMoveTarget = marks(target, field.id, nodeId);
  const isSelected = marks(selection, field.id, nodeId);

  const label = free ? t("tools.protocolBuilder.field.free") : field.name;
  const bits = t("tools.protocolBuilder.field.bits", { count: segment.fieldLength });
  const meaning = free
    ? t("tools.protocolBuilder.field.freeHint")
    : field.meaning.trim() || t("tools.protocolBuilder.field.noMeaning");

  /** What a keystroke on this cell moves: the whole band when it is picked. */
  const source: MoveSource =
    isSelected && selection ? selection : { kind: "field", id: field.id };

  function assignDrop(event: React.DragEvent) {
    event.preventDefault();
    onDropTargetChange(null);
    const typeId =
      event.dataTransfer.getData(FIELD_TYPE_MIME) ||
      event.dataTransfer.getData("text/plain");
    if (isFieldTypeId(typeId)) onAssign(field.id, typeId);
  }

  function startMove(event: React.DragEvent, moved: MoveSource) {
    event.dataTransfer.setData(FIELD_MOVE_MIME, moved.id);
    event.dataTransfer.effectAllowed = "move";
    onMoveStart(moved);
  }

  function moveKeys(event: React.KeyboardEvent): boolean {
    if (event.key === "Escape") {
      onSelect(null);
      return true;
    }
    if (isSelected && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      onRemove();
      return true;
    }
    if (!event.ctrlKey && !event.metaKey) return false;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return false;
    event.preventDefault();
    onNudge(source, event.key === "ArrowRight" ? 1 : -1, field.id);
    return true;
  }

  return (
    <div
      data-cell=""
      {...(group ? { "data-group": group.id } : {})}
      style={{ gridColumn: `span ${segment.length} / span ${segment.length}` }}
      onDragOver={(event) => {
        // A diagram drag reorders; a palette drag still only lands on a free
        // cell, so the two never compete for the same drop.
        if (drag) {
          const allowed = onMoveOver(field.id);
          event.dataTransfer.dropEffect = allowed ? "move" : "none";
          if (allowed) event.preventDefault();
          return;
        }
        if (!free) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        onDropTargetChange(field.id);
      }}
      onDragLeave={() => {
        if (!drag) onDropTargetChange(null);
      }}
      onDrop={(event) => {
        if (drag) {
          event.preventDefault();
          onMoveDrop(drag, field.id);
          onMoveEnd();
          return;
        }
        if (free) assignDrop(event);
      }}
      data-dragging={travelling || undefined}
      data-over={isMoveTarget || undefined}
      data-selected={isSelected || undefined}
      className={cn(
        "group/cell relative flex h-16 min-w-0 rounded-md border transition-opacity",
        free
          ? "border-dashed border-muted-foreground/50 bg-background text-muted-foreground"
          : ACCENT_CELL[type?.accent ?? "muted"],
        // The band above closes the top of the border that rings the whole
        // composite — even collapsed, it is still that edge — so the member
        // drops its own top line rather than doubling it.
        group && "rounded-t-none border-t-0 border-secondary/60",
        // One border for the whole run, not one per member: every cell after
        // the first swallows the gap the grid leaves on its left, so the ring
        // closes around the composite as if it were a single field — and the
        // pointer never falls between two members. What is left of that edge
        // is the divider between them, drawn fainter than the ring.
        group && !runStart && "-ml-1 rounded-l-none border-l-secondary/25",
        group && !runEnd && "rounded-r-none",
        // A wrapped field is left open on the side it travels through, the way
        // an RFC diagram cuts a field between rows.
        segment.continued && "rounded-l-none border-l-0",
        segment.continues && "rounded-r-none border-r-0",
        isDropTarget && "ring-2 ring-ring",
        free && armedTypeId && "border-ring",
        "data-selected:ring-2 data-selected:ring-primary",
        "data-dragging:opacity-50",
        "data-over:ring-2 data-over:ring-tertiary",
      )}
    >
      {/* The whole cell is the pick-up surface and the drag handle; the small
          controls sit above it, which is why this is an absolute button and
          not a wrapping one. */}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              draggable
              onDragStart={(event) => startMove(event, { kind: "field", id: field.id })}
              onDragEnd={onMoveEnd}
              onClick={() =>
                free && armedTypeId
                  ? onAssign(field.id, armedTypeId)
                  : onSelect({ kind: "field", id: field.id })
              }
              onDoubleClick={() => onEditField(field.id)}
              onKeyDown={(event) => {
                if (moveKeys(event)) return;
                if (!resizable) return;
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                event.preventDefault();
                onResizeField(
                  field.id,
                  field.length + (event.key === "ArrowRight" ? 1 : -1),
                );
              }}
              aria-pressed={isSelected}
              aria-label={
                free
                  ? t("tools.protocolBuilder.field.assignLabel")
                  : t("tools.protocolBuilder.field.selectLabel", {
                      name: field.name,
                      count: field.length,
                    })
              }
              aria-keyshortcuts="Delete Control+ArrowLeft Control+ArrowRight"
              {...(segment.continued ? {} : { "data-move-focus": field.id })}
              className="absolute inset-0 cursor-grab rounded-md active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          }
        />
        {/* A cell only has room for the name and the bit count; what the field
            means is why it is there, so the hover carries it. A member of a
            composite reads it below instead: the same hover opens the band
            above, and a tooltip on top would sit right on the name it just
            revealed. */}
        <TooltipContent
          side={group ? "bottom" : "top"}
          className="flex-col items-start gap-1 text-left"
        >
          <p className="font-mono font-medium">
            {label} · {bits}
          </p>
          <p className="opacity-80">{meaning}</p>
        </TooltipContent>
      </Tooltip>

      {/* The cut edges dissolve instead of stopping: the piece that keeps
          going fades out on its right, the piece that resumes fades in on its
          left, once per row until the field ends. */}
      {segment.continued && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 max-w-10 bg-linear-to-r from-background/60 to-transparent"
        />
      )}
      {segment.continues && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-1/3 max-w-10 bg-linear-to-l from-background/60 to-transparent"
        />
      )}

      <div className="pointer-events-none flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center">
        <span className="flex min-w-0 max-w-full items-center gap-1 font-mono text-xs">
          {segment.continued && <CornerDownRight className="size-3 shrink-0 opacity-60" />}
          <span className="truncate">{label}</span>
        </span>
        <span className="font-mono text-[10px] opacity-70">{bits}</span>
      </div>

      {group && segment.lastOfGroup && !segment.continues && (
        <button
          type="button"
          draggable={false}
          onClick={() => onAddGroupChild(group.id)}
          aria-label={t("tools.protocolBuilder.add.child")}
          title={t("tools.protocolBuilder.add.child")}
          className="absolute -right-1 -bottom-1 z-10 flex size-4 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Plus className="size-3" />
        </button>
      )}

      {resizable && (
        <button
          type="button"
          draggable={false}
          onPointerDown={(event) => onStartResize(event, field.id, field.length)}
          onKeyDown={(event) => {
            if (moveKeys(event)) return;
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            onResizeField(field.id, field.length + (event.key === "ArrowRight" ? 1 : -1));
          }}
          role="slider"
          aria-label={t("tools.protocolBuilder.field.resizeLabel", { name: field.name })}
          aria-valuenow={field.length}
          aria-valuemin={MIN_FIELD_LENGTH}
          aria-valuemax={type?.maxLength ?? MIN_FIELD_LENGTH}
          className="absolute inset-y-0 -right-0.5 z-10 w-2 cursor-col-resize rounded-r-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span aria-hidden className="mx-auto block h-full w-px bg-current opacity-40" />
        </button>
      )}
    </div>
  );
}

/** The green `+`: a single field, or a composite that starts divided in two. */
function AddFieldButton({
  onAddSingle,
  onAddComposite,
}: {
  onAddSingle: () => void;
  onAddComposite: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            className="self-start bg-tertiary text-tertiary-foreground hover:bg-tertiary/80"
          />
        }
      >
        <Plus />
        {t("tools.protocolBuilder.add.button")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={onAddSingle}>
          <span className="flex flex-col">
            <span>{t("tools.protocolBuilder.add.single")}</span>
            <span className="text-xs text-muted-foreground">
              {t("tools.protocolBuilder.add.singleHint")}
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddComposite}>
          <span className="flex flex-col">
            <span>{t("tools.protocolBuilder.add.composite")}</span>
            <span className="text-xs text-muted-foreground">
              {t("tools.protocolBuilder.add.compositeHint")}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
