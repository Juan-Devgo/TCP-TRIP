import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Group, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import { Loader2 } from "lucide-react";

import { ElementArt } from "@/features/presentation-editor/components/SlideArt";
import {
  CanvasRulers,
  RULER_SIZE,
} from "@/features/presentation-editor/components/CanvasRulers";
import {
  GRID,
  intersects,
  marquee,
  ROTATION_SNAPS,
  ROTATION_SNAP_TOLERANCE,
  rotatedBounds,
} from "@/features/presentation-editor/lib/geometry";
import { useThemeColors, type ThemePaint } from "@/features/presentation-editor/lib/themeColors";
import type {
  PresentationCanvas,
  PresentationElement,
  PresentationSlide,
} from "@/lib/presentations/contract";
import { cn } from "@/lib/utils";

/** How far an arrow key nudges, in canvas units. Shift multiplies it. */
const NUDGE = 8;
const NUDGE_FAST = 48;

/** Handles are sized in screen pixels, so zooming does not resize them. */
const ANCHOR = 9;

/** A Ctrl+drag shorter than this, in canvas units, is a Ctrl+click. */
const CLICK_SLOP = 4;

type Point = { x: number; y: number };

/** A Ctrl+drag in progress, in canvas units. */
type Area = {
  from: Point;
  to: Point;
  /** The element the drag started on, for a Ctrl+click that toggles it. */
  origin: string | null;
};

/** The box an element occupies, as the reducer stores it. */
export type CanvasBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

/** Which piece of text a double-click opened: an element, or one table cell. */
type Editing = {
  id: string;
  row?: number;
  column?: number;
  value: string;
  /** Screen pixels, relative to the stage's top-left corner. */
  box: { left: number; top: number; width: number; height: number };
  fontSize: number;
  fontFamily: string;
  align: "left" | "center" | "right";
  color: string;
};

/**
 * The editable slide: a real `<canvas>` (Konva) at the document's own
 * coordinates, with a transformer for scaling and rotating and rulers around
 * it.
 *
 * Two things make this work at any window size:
 *
 * - **The stage is scaled, not reflowed.** Konva's stage gets `scale = screen
 *   width / canvas width`, so every coordinate inside it — and therefore every
 *   coordinate that reaches the reducer — is a canvas unit. A slide laid out on
 *   a laptop is the same document as one laid out on a projector.
 * - **Colours are resolved, not inherited.** A canvas cannot paint
 *   `var(--color-primary)`, so the tokens are read off the theme
 *   (`useThemeColors`) and re-read when it flips. The document still stores
 *   token names, which is why the same slide is readable in both themes.
 *
 * Typing happens in a real `<textarea>` laid over the node, the way every
 * canvas editor does it: a canvas has no caret, no IME and no spellcheck.
 *
 * Holding Ctrl and dragging across the board draws a marquee; whatever it
 * touches becomes a **group**, which the transformer carries as a whole — the
 * group only moves (no resize, no rotation), because scaling several elements
 * of different kinds by one handle has no answer a teacher would expect.
 * Ctrl+click adds or removes one element. The group is not in the reducer:
 * it is a selection, not an edit, and only its move becomes one.
 */
export function SlideCanvas({
  slide,
  canvas,
  selectedElementId,
  group,
  onSelect,
  onGroup,
  onMoveGroup,
  onTransform,
  onCommit,
  onText,
  onCell,
  onDelete,
}: {
  slide: PresentationSlide;
  canvas: PresentationCanvas;
  selectedElementId: string | null;
  /** Elements selected together; empty unless there are two or more. */
  group: readonly string[];
  onSelect: (id: string | null) => void;
  onGroup: (ids: string[]) => void;
  /** A group was dropped: every member's new position, in canvas units. */
  onMoveGroup: (moves: { id: string; x: number; y: number }[]) => void;
  /** Position, size and angle, in canvas units — one gesture, one call. */
  onTransform: (id: string, box: CanvasBox) => void;
  /** The gesture ended: the next edit starts a new undo step. */
  onCommit: () => void;
  onText: (id: string, text: string) => void;
  onCell: (id: string, row: number, column: number, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const paint = useThemeColors();
  const frame = useRef<HTMLDivElement>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Group>());
  const [available, setAvailable] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  /** Read inside Konva handlers, which may run before React re-renders. */
  const selecting = useRef(false);
  selecting.current = area !== null;
  /** Several members end one drag: they must still be one undo step. */
  const settling = useRef(false);

  // One measurement is all the geometry the stage needs: it scales. Taken
  // before the first paint, so the board never shows up empty for a frame;
  // the observer then follows the column as it resizes.
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;

    const style = getComputedStyle(element);
    setAvailable(
      element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    );

    const observer = new ResizeObserver(([entry]) => {
      setAvailable(entry?.contentRect.width ?? 0);
    });
    // Observing fires once straight away, with the content box — the frame's
    // padding already taken out, which `clientWidth` would include.
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // Never over 1:1 — the canvas is a fixed stage, and a blown-up slide would
  // invite laying it out for a screen this size.
  const scale = Math.min(1, Math.max(0, (available - RULER_SIZE) / canvas.width));

  const selected = slide.elements.find((element) => element.id === selectedElementId);
  // What the rulers band: the box the element really covers once it is turned.
  const bounds = selected ? rotatedBounds(selected) : null;
  const grouped = group.length > 0;

  /** Keeps the transformer on whatever is selected, and off what is locked. */
  useEffect(() => {
    const handles = transformer.current;
    if (!handles) return;

    const ids = grouped ? group : selectedElementId !== null ? [selectedElementId] : [];
    const attached = ids.flatMap((id) => {
      const element = slide.elements.find((candidate) => candidate.id === id);
      const node = nodes.current.get(id);
      return element && element.locked !== true && node ? [node] : [];
    });

    handles.nodes(attached);
    handles.getLayer()?.batchDraw();
  }, [grouped, group, selectedElementId, slide.elements]);

  // Only while a marquee is being drawn, and on `window`, so letting go
  // outside the board still ends it.
  useEffect(() => {
    if (!area) return;

    function finish() {
      if (!area) return;
      setArea(null);

      const drawn = marquee(area.from, area.to);
      const click =
        drawn.right - drawn.left < CLICK_SLOP && drawn.bottom - drawn.top < CLICK_SLOP;

      if (!click) {
        choose(
          slide.elements
            .filter((element) => !element.locked && intersects(rotatedBounds(element), drawn))
            .map((element) => element.id),
        );
        return;
      }

      // Ctrl+click: toggles one element in or out of what is selected.
      const origin = slide.elements.find((element) => element.id === area.origin);
      if (!origin || origin.locked) return;

      const current = grouped ? group : selectedElementId !== null ? [selectedElementId] : [];
      choose(
        current.includes(origin.id)
          ? current.filter((id) => id !== origin.id)
          : [...current, origin.id],
      );
    }

    window.addEventListener("mouseup", finish);
    return () => window.removeEventListener("mouseup", finish);
  });

  /** One element is an ordinary selection; two or more are a group. */
  function choose(ids: string[]) {
    if (ids.length > 1) onGroup(ids);
    else onSelect(ids[0] ?? null);
  }

  /** The element a Konva node belongs to, climbing out of its children. */
  function ownerOf(target: Konva.Node): string | null {
    const owner = target.findAncestor(
      (node: Konva.Node) => nodes.current.get(node.id()) === node,
      true,
    );
    return owner ? owner.id() : null;
  }

  /** Clicking a member of the group keeps the group, so it can be dragged. */
  function pick(id: string) {
    if (selecting.current || group.includes(id)) return;
    onSelect(id);
  }

  /** Every dragged member ends the drag; the first one settles all of them. */
  function dropGroup() {
    onMoveGroup(
      group.flatMap((id) => {
        const node = nodes.current.get(id);
        return node ? [{ id, x: node.x(), y: node.y() }] : [];
      }),
    );

    if (settling.current) return;
    settling.current = true;
    queueMicrotask(() => {
      settling.current = false;
      onCommit();
    });
  }

  /** Closing the editor ends the undo step the typing belonged to. */
  function closeEditor() {
    setEditing(null);
    onCommit();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    // The textarea is a child of this node: while it is open, the keys are
    // the author's text, not canvas commands.
    if (editing) return;

    if (event.key === "Escape") {
      onSelect(null);
      return;
    }

    if (!selected || selected.locked) return;

    const step = event.shiftKey ? NUDGE_FAST : NUDGE;
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };

    const delta = nudge[event.key];
    if (delta) {
      event.preventDefault();
      onTransform(selected.id, {
        ...box(selected),
        x: selected.x + delta[0],
        y: selected.y + delta[1],
      });
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDelete(selected.id);
    }
  }

  /**
   * Ctrl+press starts a marquee wherever it lands; a plain click that did not
   * land on an element is a deselection.
   */
  function onStagePointer(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = event.target.getStage();
    if (!stage) return;

    const primary = !("button" in event.evt) || event.evt.button === 0;
    if (primary && (event.evt.ctrlKey || event.evt.metaKey)) {
      const point = stage.getRelativePointerPosition();
      if (point) setArea({ from: point, to: point, origin: ownerOf(event.target) });
      return;
    }

    if (event.target === stage) onSelect(null);
  }

  /**
   * A right-click selects what it lands on before the context menu opens, so
   * the menu acts on what the author pointed at. A group member keeps the
   * group.
   */
  function onStageContext(event: Konva.KonvaEventObject<PointerEvent>) {
    const id = ownerOf(event.target);
    if (id === null) onSelect(null);
    else if (!group.includes(id)) onSelect(id);
  }

  function onStageMove(event: Konva.KonvaEventObject<MouseEvent>) {
    if (!area) return;
    const point = event.target.getStage()?.getRelativePointerPosition();
    if (point) setArea({ ...area, to: point });
  }

  const grid: number[] = [];
  for (let at = GRID; at < canvas.width; at += GRID) grid.push(at);

  return (
    <div
      ref={frame}
      // No focus ring: the transformer already shows what the keys act on, and
      // a ring would light up the whole board the moment Shift is pressed to
      // scale.
      className="w-full p-1 outline-none"
      // Focusable so the nudge and delete keys have somewhere to land. Bound
      // here and not to `document`: inactive tabs stay mounted in this app.
      tabIndex={0}
      role="application"
      aria-label={t("presentations.editor.canvasLabel")}
      onKeyDown={onKeyDown}
    >
      {/* Not measured yet (or in a hidden tab): the board's own space, busy. */}
      {scale === 0 && (
        <div
          role="status"
          className="bg-muted/40 text-muted-foreground flex w-full items-center justify-center rounded-md border"
          style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
        >
          <Loader2 className="size-8 animate-spin" aria-hidden />
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      )}

      <div className={cn("flex", scale === 0 && "hidden")}>
        <div
          aria-hidden
          className="border-border bg-muted/40 shrink-0 border-r border-b"
          style={{ width: RULER_SIZE, height: RULER_SIZE }}
        />
        <CanvasRulers
          axis="x"
          canvas={canvas}
          scale={scale}
          {...(bounds ? { from: bounds.left, to: bounds.right } : {})}
        />
      </div>

      <div className={cn("flex", scale === 0 && "hidden")}>
        <CanvasRulers
          axis="y"
          canvas={canvas}
          scale={scale}
          {...(bounds ? { from: bounds.top, to: bounds.bottom } : {})}
        />

        <div
          className="border-border relative shrink-0 overflow-hidden border-r border-b shadow-sm"
          style={{ width: canvas.width * scale, height: canvas.height * scale }}
        >
          {scale > 0 && (
            <Stage
              width={canvas.width * scale}
              height={canvas.height * scale}
              scaleX={scale}
              scaleY={scale}
              onMouseDown={onStagePointer}
              onTouchStart={onStagePointer}
              onMouseMove={onStageMove}
              onContextMenu={onStageContext}
            >
              {/* Nothing here listens, so a click on the slide reaches the
                  stage and counts as a deselection. */}
              <Layer listening={false}>
                <Rect
                  x={0}
                  y={0}
                  width={canvas.width}
                  height={canvas.height}
                  fill={paint.color(slide.background ?? "background")}
                />
                {grid.map((at) => (
                  <Line
                    key={`v${at}`}
                    points={[at, 0, at, canvas.height]}
                    stroke={paint.color("border")}
                    strokeWidth={1 / scale}
                    opacity={0.5}
                  />
                ))}
                {grid
                  .filter((at) => at < canvas.height)
                  .map((at) => (
                    <Line
                      key={`h${at}`}
                      points={[0, at, canvas.width, at]}
                      stroke={paint.color("border")}
                      strokeWidth={1 / scale}
                      opacity={0.5}
                    />
                  ))}
              </Layer>

              <Layer>
                {/* Array order is paint order — there is no z-index anywhere. */}
                {slide.elements.map((element) => (
                  <CanvasElement
                    key={element.id}
                    element={element}
                    paint={paint}
                    scale={scale}
                    draggable={element.locked !== true && area === null}
                    grouped={group.includes(element.id)}
                    selecting={selecting}
                    register={(node) => {
                      if (node) nodes.current.set(element.id, node);
                      else nodes.current.delete(element.id);
                    }}
                    onSelect={() => pick(element.id)}
                    onDropGroup={dropGroup}
                    onTransform={(next) => onTransform(element.id, next)}
                    onCommit={onCommit}
                    onEdit={(next) => setEditing(next)}
                  />
                ))}

                {area && (
                  <MarqueeNode area={area} scale={scale} color={paint.color("primary")} />
                )}

                <Transformer
                  ref={transformer}
                  // A group only moves. A table stays upright; everything else
                  // settles every 45°.
                  resizeEnabled={!grouped}
                  rotateEnabled={!grouped && selected?.type !== "table"}
                  rotationSnaps={ROTATION_SNAPS}
                  rotationSnapTolerance={ROTATION_SNAP_TOLERANCE}
                  keepRatio={false}
                  flipEnabled={false}
                  // Sized in screen pixels: the transformer lives inside the
                  // scaled layer, so everything has to be divided back down.
                  anchorSize={ANCHOR / scale}
                  anchorStrokeWidth={1 / scale}
                  borderStrokeWidth={1 / scale}
                  rotateAnchorOffset={26 / scale}
                  anchorFill={paint.color("background")}
                  anchorStroke={paint.color("primary")}
                  borderStroke={paint.color("primary")}
                  boundBoxFunc={(_old, next) =>
                    // 16 canvas units is the floor the reducer enforces too: a
                    // zero-sized box cannot be grabbed again.
                    next.width < 16 * scale || next.height < 16 * scale ? _old : next
                  }
                />
              </Layer>
            </Stage>
          )}

          {editing && (
            <textarea
              // A canvas has no caret: typing happens in a real textarea laid
              // over the node, which also gives IME and spellcheck.
              autoFocus
              className="border-primary bg-background absolute z-10 resize-none overflow-hidden border p-0 leading-tight outline-none"
              style={{
                left: editing.box.left,
                top: editing.box.top,
                width: editing.box.width,
                height: editing.box.height,
                fontSize: editing.fontSize * scale,
                fontFamily: editing.fontFamily,
                textAlign: editing.align,
                color: editing.color,
              }}
              value={editing.value}
              aria-label={t("presentations.editor.editText")}
              // The browser's own menu (spellcheck, paste) is the one that
              // belongs to a text field, not the canvas menu around it.
              onContextMenu={(event) => event.stopPropagation()}
              onChange={(event) => {
                const value = event.target.value;
                setEditing({ ...editing, value });
                if (editing.row === undefined || editing.column === undefined) {
                  onText(editing.id, value);
                } else {
                  onCell(editing.id, editing.row, editing.column, value);
                }
              }}
              onBlur={closeEditor}
              onKeyDown={(event) => {
                // Enter is a newline in a text box and a commit in a cell.
                const single = editing.row !== undefined;
                if (event.key === "Escape" || (single && event.key === "Enter")) {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** The Ctrl+drag marquee: a tinted box with a hairline edge. */
function MarqueeNode({ area, scale, color }: { area: Area; scale: number; color: string }) {
  const drawn = marquee(area.from, area.to);
  const geometry = {
    x: drawn.left,
    y: drawn.top,
    width: drawn.right - drawn.left,
    height: drawn.bottom - drawn.top,
  };

  return (
    <>
      <Rect listening={false} {...geometry} fill={color} opacity={0.12} />
      <Rect listening={false} {...geometry} stroke={color} strokeWidth={1 / scale} />
    </>
  );
}

function box(element: PresentationElement): CanvasBox {
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
  };
}

/**
 * One element as a Konva group: the group carries the box (position, size,
 * angle) and its children only draw inside it, so every kind is dragged,
 * scaled and rotated by exactly the same code.
 */
function CanvasElement({
  element,
  paint,
  scale,
  draggable,
  grouped,
  selecting,
  register,
  onSelect,
  onDropGroup,
  onTransform,
  onCommit,
  onEdit,
}: {
  element: PresentationElement;
  paint: ThemePaint;
  scale: number;
  draggable: boolean;
  /** A member of a multi-selection: its moves are the group's, not its own. */
  grouped: boolean;
  /** Whether a marquee is being drawn — true before React has re-rendered. */
  selecting: React.RefObject<boolean>;
  register: (node: Konva.Group | null) => void;
  onSelect: () => void;
  onDropGroup: () => void;
  onTransform: (box: CanvasBox) => void;
  onCommit: () => void;
  onEdit: (editing: Editing) => void;
}) {
  /** Where a child sits on screen, for the textarea laid over it. */
  function screen(local: { x: number; y: number; width: number; height: number }) {
    return {
      left: (element.x + local.x) * scale,
      top: (element.y + local.y) * scale,
      width: local.width * scale,
      height: local.height * scale,
    };
  }

  return (
    <Group
      ref={register}
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      draggable={draggable}
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      onDragStart={(event) => {
        // Ctrl+press on an element starts a marquee, not a move — Konva may
        // have armed the drag before `draggable` was re-rendered off.
        if (!selecting.current) return;
        event.target.stopDrag();
        event.target.position({ x: element.x, y: element.y });
      }}
      onDragMove={(event) => {
        // A group's members are moved by the transformer, together; the
        // document catches up once, on drop.
        if (grouped || selecting.current) return;
        onTransform({ ...box(element), x: event.target.x(), y: event.target.y() });
      }}
      onDragEnd={() => {
        if (grouped) onDropGroup();
        else onCommit();
      }}
      onTransformEnd={(event) => {
        const node = event.target;
        const next = {
          x: node.x(),
          y: node.y(),
          width: element.width * node.scaleX(),
          height: element.height * node.scaleY(),
          rotation: node.rotation(),
        };

        // Konva scales a node; the document stores a size. The scale is handed
        // back to the box and reset, or it would multiply on the next drag.
        node.scaleX(1);
        node.scaleY(1);
        onTransform(next);
        onCommit();
      }}
    >
      {/* The whole box is grabbable, including the empty part of a text box or
          the corner outside an ellipse. Almost transparent rather than
          `opacity: 0`, which would take it out of hit detection. */}
      <Rect
        width={element.width}
        height={element.height}
        fill="rgba(0,0,0,0.001)"
        onDblClick={() => {
          if (element.type !== "text") return;
          onEdit({
            id: element.id,
            value: element.props.text,
            box: screen({ x: 0, y: 0, width: element.width, height: element.height }),
            fontSize: element.props.size,
            fontFamily: paint.font(element.props.mono === true),
            align: element.props.align,
            color: paint.color(element.props.color),
          });
        }}
      />

      <ElementArt
        element={element}
        paint={paint}
        onEditCell={(row, column, cell) => {
          if (element.type !== "table") return;
          onEdit({
            id: element.id,
            row,
            column,
            value: element.props.rows[row]?.[column] ?? "",
            box: screen(cell),
            fontSize: element.props.size,
            fontFamily: paint.font(element.props.mono === true),
            align: "left",
            color: paint.color(element.props.color),
          });
        }}
      />
    </Group>
  );
}
