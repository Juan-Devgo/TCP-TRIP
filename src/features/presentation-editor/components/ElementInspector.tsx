import { useTranslation } from "react-i18next";
import { ArrowDownToLine, ArrowUpToLine, Lock, LockOpen, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_FONT_SIZE,
  MAX_SHAPE_STROKE_WIDTH,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  MIN_FONT_SIZE,
  NO_FILL,
  SHAPE_COLOR_TOKENS,
  SHAPE_FILL_VALUES,
  SHAPE_KINDS,
  TEXT_ALIGNMENTS,
  TEXT_COLOR_TOKENS,
  TEXT_WEIGHTS,
  type ImageElementProps,
  type PresentationElement,
  type ShapeElementProps,
  type TableElementProps,
  type TextElementProps,
} from "@/lib/presentations/contract";

/** `<Select>` here is Base UI: it takes `items` as well as its children. */
function items(values: readonly (string | number)[], label: (value: string) => string) {
  return values.map((value) => ({ value: String(value), label: label(String(value)) }));
}

/**
 * The right-hand panel: the properties of the selected element, and nothing
 * else. The board size and the slide background live in the View menu, and the
 * notes have their own panel under the editor.
 *
 * Colours and backgrounds are pickers over **theme tokens**, not colour wheels.
 * That is a deliberate limitation: a slide is projected in whatever theme the
 * classroom machine is in, and a hex value a teacher liked in light mode is the
 * one thing that can make text invisible on the projector.
 */
export function ElementInspector({
  element,
  groupCount,
  onTextProps,
  onImageProps,
  onTableProps,
  onTableSize,
  onShapeProps,
  onBox,
  onRotate,
  onToggleLock,
  onRestack,
  onDelete,
}: {
  element: PresentationElement | undefined;
  /** How many elements are selected together on the canvas; 0 for none. */
  groupCount: number;
  onTextProps: (id: string, props: Partial<TextElementProps>) => void;
  onImageProps: (id: string, props: Partial<ImageElementProps>) => void;
  onTableProps: (id: string, props: Partial<Omit<TableElementProps, "rows">>) => void;
  onTableSize: (id: string, rows: number, columns: number) => void;
  onShapeProps: (id: string, props: Partial<ShapeElementProps>) => void;
  onBox: (id: string, box: { x?: number; y?: number; width?: number; height?: number }) => void;
  onRotate: (id: string, rotation: number) => void;
  onToggleLock: (id: string) => void;
  onRestack: (id: string, where: "front" | "back") => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    // Beside the canvas the panel is exactly as tall as the board and scrolls
    // inside it: the inner column is taken out of flow, so a long form never
    // stretches the row. Wrapped under the canvas, a max height does the same.
    <aside className="relative w-72 shrink-0 xl:self-stretch">
      <div className="flex max-h-96 flex-col gap-6 overflow-y-auto pr-2 xl:absolute xl:inset-0 xl:max-h-none">
        <section>
          <h3 className="mt-0 mb-2 text-sm font-semibold">
            {t("presentations.editor.elementSection")}
          </h3>

          {groupCount > 0 ? (
            // A group has no shared properties to edit — it is only moved.
            <div className="flex flex-col gap-1">
              <p className="m-0 text-sm">
              {t("presentations.editor.group", { count: groupCount })}
            </p>
              <p className="text-muted-foreground m-0 text-xs">
                {t("presentations.editor.groupHint")}
              </p>
            </div>
          ) : !element ? (
            <p className="text-muted-foreground m-0 text-sm">
              {t("presentations.editor.noSelection")}
            </p>
          ) : (
            <FieldGroup>
              {element.type === "text" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="text-content">
                      {t("presentations.editor.text")}
                    </FieldLabel>
                    <Textarea
                      id="text-content"
                      rows={4}
                      value={element.props.text}
                      onChange={(event) =>
                        onTextProps(element.id, { text: event.target.value })
                      }
                    />
                  </Field>

                  <div className="flex gap-2">
                    <Field className="flex-1">
                      <FieldLabel htmlFor="text-size">
                        {t("presentations.editor.fontSize")}
                      </FieldLabel>
                      <Input
                        id="text-size"
                        type="number"
                        min={MIN_FONT_SIZE}
                        max={MAX_FONT_SIZE}
                        value={element.props.size}
                        onChange={(event) =>
                          onTextProps(element.id, {
                            size: clamp(event.target.valueAsNumber, MIN_FONT_SIZE, MAX_FONT_SIZE),
                          })
                        }
                      />
                    </Field>

                    <Field className="flex-1">
                      <FieldLabel htmlFor="text-weight">
                        {t("presentations.editor.weight")}
                      </FieldLabel>
                      <Select
                        items={items(TEXT_WEIGHTS, (value) =>
                          t(`presentations.editor.weights.${value}`),
                        )}
                        value={String(element.props.weight)}
                        onValueChange={(next) =>
                          onTextProps(element.id, {
                            weight: Number(next) as TextElementProps["weight"],
                          })
                        }
                      >
                        <SelectTrigger id="text-weight" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEXT_WEIGHTS.map((weight) => (
                            <SelectItem key={weight} value={String(weight)}>
                              {t(`presentations.editor.weights.${weight}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="flex gap-2">
                    <Field className="flex-1">
                      <FieldLabel htmlFor="text-align">
                        {t("presentations.editor.align")}
                      </FieldLabel>
                      <Select
                        items={items(TEXT_ALIGNMENTS, (value) =>
                          t(`presentations.editor.alignments.${value}`),
                        )}
                        value={element.props.align}
                        onValueChange={(next) =>
                          onTextProps(element.id, {
                            align: String(next) as TextElementProps["align"],
                          })
                        }
                      >
                        <SelectTrigger id="text-align" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEXT_ALIGNMENTS.map((align) => (
                            <SelectItem key={align} value={align}>
                              {t(`presentations.editor.alignments.${align}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field className="flex-1">
                      <FieldLabel htmlFor="text-color">
                        {t("presentations.editor.color")}
                      </FieldLabel>
                      <Select
                        items={items(TEXT_COLOR_TOKENS, (value) =>
                          t(`presentations.tokens.${value}`),
                        )}
                        value={element.props.color}
                        onValueChange={(next) =>
                          onTextProps(element.id, { color: String(next) })
                        }
                      >
                        <SelectTrigger id="text-color" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEXT_COLOR_TOKENS.map((token) => (
                            <SelectItem key={token} value={token}>
                              {t(`presentations.tokens.${token}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="text-mono">
                      {t("presentations.editor.mono")}
                    </FieldLabel>
                    <Switch
                      id="text-mono"
                      checked={element.props.mono ?? false}
                      onCheckedChange={(checked) =>
                        onTextProps(element.id, { mono: checked })
                      }
                    />
                  </Field>
                </>
              ) : element.type === "image" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="image-alt">
                      {t("presentations.editor.alt")}
                    </FieldLabel>
                    <Input
                      id="image-alt"
                      value={element.props.alt}
                      placeholder={t("presentations.editor.altPlaceholder")}
                      onChange={(event) =>
                        onImageProps(element.id, { alt: event.target.value })
                      }
                    />
                    <p className="text-muted-foreground m-0 text-xs">
                      {t("presentations.editor.altHint")}
                    </p>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="image-fit">
                      {t("presentations.editor.fit")}
                    </FieldLabel>
                    <Select
                      items={[
                        { value: "contain", label: t("presentations.editor.fits.contain") },
                        { value: "cover", label: t("presentations.editor.fits.cover") },
                      ]}
                      value={element.props.fit}
                      onValueChange={(next) =>
                        onImageProps(element.id, {
                          fit: String(next) as ImageElementProps["fit"],
                        })
                      }
                    >
                      <SelectTrigger id="image-fit" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contain">
                          {t("presentations.editor.fits.contain")}
                        </SelectItem>
                        <SelectItem value="cover">
                          {t("presentations.editor.fits.cover")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              ) : element.type === "table" ? (
                <>
                  <p className="text-muted-foreground m-0 text-xs">
                    {t("presentations.editor.tableHint")}
                  </p>

                  <div className="flex gap-2">
                    <Field className="flex-1">
                      <FieldLabel htmlFor="table-rows">
                        {t("presentations.editor.tableRows")}
                      </FieldLabel>
                      <Input
                        id="table-rows"
                        type="number"
                        min={1}
                        max={MAX_TABLE_ROWS}
                        value={element.props.rows.length}
                        onChange={(event) =>
                          onTableSize(
                            element.id,
                            clamp(event.target.valueAsNumber, 1, MAX_TABLE_ROWS),
                            element.props.rows[0]?.length ?? 1,
                          )
                        }
                      />
                    </Field>

                    <Field className="flex-1">
                      <FieldLabel htmlFor="table-columns">
                        {t("presentations.editor.tableColumns")}
                      </FieldLabel>
                      <Input
                        id="table-columns"
                        type="number"
                        min={1}
                        max={MAX_TABLE_COLUMNS}
                        value={element.props.rows[0]?.length ?? 1}
                        onChange={(event) =>
                          onTableSize(
                            element.id,
                            element.props.rows.length,
                            clamp(event.target.valueAsNumber, 1, MAX_TABLE_COLUMNS),
                          )
                        }
                      />
                    </Field>
                  </div>

                  <div className="flex gap-2">
                    <Field className="flex-1">
                      <FieldLabel htmlFor="table-size">
                        {t("presentations.editor.fontSize")}
                      </FieldLabel>
                      <Input
                        id="table-size"
                        type="number"
                        min={MIN_FONT_SIZE}
                        max={MAX_FONT_SIZE}
                        value={element.props.size}
                        onChange={(event) =>
                          onTableProps(element.id, {
                            size: clamp(
                              event.target.valueAsNumber,
                              MIN_FONT_SIZE,
                              MAX_FONT_SIZE,
                            ),
                          })
                        }
                      />
                    </Field>

                    <Field className="flex-1">
                      <FieldLabel htmlFor="table-color">
                        {t("presentations.editor.color")}
                      </FieldLabel>
                      <Select
                        items={items(TEXT_COLOR_TOKENS, (value) =>
                          t(`presentations.tokens.${value}`),
                        )}
                        value={element.props.color}
                        onValueChange={(next) =>
                          onTableProps(element.id, { color: String(next) })
                        }
                      >
                        <SelectTrigger id="table-color" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEXT_COLOR_TOKENS.map((token) => (
                            <SelectItem key={token} value={token}>
                              {t(`presentations.tokens.${token}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="table-header">
                      {t("presentations.editor.tableHeader")}
                    </FieldLabel>
                    <Switch
                      id="table-header"
                      checked={element.props.header}
                      onCheckedChange={(checked) =>
                        onTableProps(element.id, { header: checked })
                      }
                    />
                  </Field>

                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="table-mono">
                      {t("presentations.editor.mono")}
                    </FieldLabel>
                    <Switch
                      id="table-mono"
                      checked={element.props.mono ?? false}
                      onCheckedChange={(checked) =>
                        onTableProps(element.id, { mono: checked })
                      }
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field>
                    <FieldLabel htmlFor="shape-kind">
                      {t("presentations.editor.shapeKind")}
                    </FieldLabel>
                    <Select
                      items={items(SHAPE_KINDS, (value) =>
                        t(`presentations.editor.shapes.${value}`),
                      )}
                      value={element.props.kind}
                      onValueChange={(next) =>
                        onShapeProps(element.id, {
                          kind: String(next) as ShapeElementProps["kind"],
                        })
                      }
                    >
                      <SelectTrigger id="shape-kind" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHAPE_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {t(`presentations.editor.shapes.${kind}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="shape-fill">
                      {t("presentations.editor.fill")}
                    </FieldLabel>
                    <Select
                      items={items(SHAPE_FILL_VALUES, (value) =>
                        value === NO_FILL
                          ? t("presentations.editor.noFill")
                          : t(`presentations.tokens.${value}`),
                      )}
                      value={element.props.fill}
                      onValueChange={(next) =>
                        onShapeProps(element.id, { fill: String(next) })
                      }
                    >
                      <SelectTrigger id="shape-fill" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHAPE_FILL_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value === NO_FILL
                              ? t("presentations.editor.noFill")
                              : t(`presentations.tokens.${value}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="flex gap-2">
                    <Field className="flex-1">
                      <FieldLabel htmlFor="shape-stroke">
                        {t("presentations.editor.stroke")}
                      </FieldLabel>
                      <Select
                        items={items(SHAPE_COLOR_TOKENS, (value) =>
                          t(`presentations.tokens.${value}`),
                        )}
                        value={element.props.stroke}
                        onValueChange={(next) =>
                          onShapeProps(element.id, { stroke: String(next) })
                        }
                      >
                        <SelectTrigger id="shape-stroke" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SHAPE_COLOR_TOKENS.map((token) => (
                            <SelectItem key={token} value={token}>
                              {t(`presentations.tokens.${token}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field className="w-24">
                      <FieldLabel htmlFor="shape-stroke-width">
                        {t("presentations.editor.strokeWidth")}
                      </FieldLabel>
                      <Input
                        id="shape-stroke-width"
                        type="number"
                        min={0}
                        max={MAX_SHAPE_STROKE_WIDTH}
                        value={element.props.strokeWidth}
                        onChange={(event) =>
                          onShapeProps(element.id, {
                            strokeWidth: clamp(
                              event.target.valueAsNumber,
                              0,
                              MAX_SHAPE_STROKE_WIDTH,
                            ),
                          })
                        }
                      />
                    </Field>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "width", "height"] as const).map((axis) => (
                  <Field key={axis}>
                    <FieldLabel htmlFor={`box-${axis}`}>
                      {t(`presentations.editor.box.${axis}`)}
                    </FieldLabel>
                    <Input
                      id={`box-${axis}`}
                      type="number"
                      value={element[axis]}
                      onChange={(event) =>
                        onBox(element.id, { [axis]: event.target.valueAsNumber })
                      }
                    />
                  </Field>
                ))}
              </div>

              {/* A table stays upright — the reducer holds it at 0 as well. */}
              {element.type !== "table" && (
                <Field>
                  <FieldLabel htmlFor="box-rotation">
                    {t("presentations.editor.rotation")}
                  </FieldLabel>
                  <Input
                    id="box-rotation"
                    type="number"
                    min={-360}
                    max={360}
                    value={element.rotation}
                    onChange={(event) => onRotate(element.id, event.target.valueAsNumber || 0)}
                  />
                </Field>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRestack(element.id, "front")}
                >
                  <ArrowUpToLine />
                  {t("presentations.editor.bringToFront")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRestack(element.id, "back")}
                >
                  <ArrowDownToLine />
                  {t("presentations.editor.sendToBack")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleLock(element.id)}
                >
                  {element.locked ? <Lock /> : <LockOpen />}
                  {t(element.locked ? "presentations.editor.unlock" : "presentations.editor.lock")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(element.id)}
                >
                  <Trash2 />
                  {t("presentations.editor.deleteElement")}
                </Button>
              </div>
            </FieldGroup>
          )}
        </section>
      </div>
    </aside>
  );
}

/** A number input can produce `NaN` (empty) — the box must survive that. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
