import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Arrow,
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type Konva from "konva";

import {
  CanvasRulers,
  RULER_SIZE,
} from "@/features/presentation-editor/components/CanvasRulers";
import { useThemeColors, type ThemePaint } from "@/features/presentation-editor/lib/themeColors";
import { useCanvasImage } from "@/features/presentation-editor/lib/useCanvasImage";
import {
  NO_FILL,
  presentationAssetUrl,
  type PresentationCanvas,
  type PresentationElement,
  type PresentationSlide,
  type ShapeElementProps,
  type TableElementProps,
} from "@/lib/presentations/contract";

/** How far an arrow key nudges, in canvas units. Shift multiplies it. */
const NUDGE = 8;
const NUDGE_FAST = 48;

/** The alignment grid, in canvas units. Drawn, never snapped to. */
const GRID = 120;

/** Handles are sized in screen pixels, so zooming does not resize them. */
const ANCHOR = 9;

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
 */
export function SlideCanvas({
  slide,
  canvas,
  selectedElementId,
  onSelect,
  onTransform,
  onCommit,
  onText,
  onCell,
  onDelete,
}: {
  slide: PresentationSlide;
  canvas: PresentationCanvas;
  selectedElementId: string | null;
  onSelect: (id: string | null) => void;
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

  // One measurement is all the geometry the stage needs: it scales.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setAvailable(entry?.contentRect.width ?? 0);
    });
    observer.observe(element);
    setAvailable(element.clientWidth);

    return () => observer.disconnect();
  }, []);

  // Never over 1:1 — the canvas is a fixed stage, and a blown-up slide would
  // invite laying it out for a screen this size.
  const scale = Math.min(1, Math.max(0, (available - RULER_SIZE) / canvas.width));

  const selected = slide.elements.find((element) => element.id === selectedElementId);

  /** Keeps the transformer on whatever is selected, and off what is locked. */
  useEffect(() => {
    const handles = transformer.current;
    if (!handles) return;

    const node =
      selectedElementId !== null && selected?.locked !== true
        ? nodes.current.get(selectedElementId)
        : undefined;

    handles.nodes(node ? [node] : []);
    handles.getLayer()?.batchDraw();
  }, [selectedElementId, selected, slide.elements]);

  /** Closing the editor ends the undo step the typing belonged to. */
  function closeEditor() {
    setEditing(null);
    onCommit();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    // The textarea is a child of this node: while it is open, the keys are
    // the author's text, not canvas commands.
    if (editing || !selected || selected.locked) return;

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
      return;
    }

    if (event.key === "Escape") onSelect(null);
  }

  /** A click that did not land on an element is a deselection. */
  function onStagePointer(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (event.target === event.target.getStage()) onSelect(null);
  }

  const grid: number[] = [];
  for (let at = GRID; at < canvas.width; at += GRID) grid.push(at);

  return (
    <div
      ref={frame}
      className="focus-visible:ring-ring w-full rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      // Focusable so the nudge and delete keys have somewhere to land. Bound
      // here and not to `document`: inactive tabs stay mounted in this app.
      tabIndex={0}
      role="application"
      aria-label={t("presentations.editor.canvasLabel")}
      onKeyDown={onKeyDown}
    >
      <div className="flex">
        <div
          aria-hidden
          className="border-border bg-muted/40 shrink-0 border-r border-b"
          style={{ width: RULER_SIZE, height: RULER_SIZE }}
        />
        <CanvasRulers
          axis="x"
          canvas={canvas}
          scale={scale}
          {...(selected ? { from: selected.x, to: selected.x + selected.width } : {})}
        />
      </div>

      <div className="flex">
        <CanvasRulers
          axis="y"
          canvas={canvas}
          scale={scale}
          {...(selected ? { from: selected.y, to: selected.y + selected.height } : {})}
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
                    register={(node) => {
                      if (node) nodes.current.set(element.id, node);
                      else nodes.current.delete(element.id);
                    }}
                    onSelect={() => onSelect(element.id)}
                    onTransform={(next) => onTransform(element.id, next)}
                    onCommit={onCommit}
                    onEdit={(next) => setEditing(next)}
                  />
                ))}

                <Transformer
                  ref={transformer}
                  rotateEnabled
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
  register,
  onSelect,
  onTransform,
  onCommit,
  onEdit,
}: {
  element: PresentationElement;
  paint: ThemePaint;
  scale: number;
  register: (node: Konva.Group | null) => void;
  onSelect: () => void;
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
      draggable={element.locked !== true}
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      onDragMove={(event) =>
        onTransform({ ...box(element), x: event.target.x(), y: event.target.y() })
      }
      onDragEnd={onCommit}
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

      {element.type === "text" && (
        <Text
          listening={false}
          width={element.width}
          height={element.height}
          text={element.props.text}
          fontSize={element.props.size}
          fontFamily={paint.font(element.props.mono === true)}
          fontStyle={element.props.weight >= 600 ? "bold" : "normal"}
          align={element.props.align}
          fill={paint.color(element.props.color)}
          lineHeight={1.2}
          wrap="word"
        />
      )}

      {element.type === "image" && (
        <ImageNode
          assetId={element.props.assetId}
          fit={element.props.fit}
          width={element.width}
          height={element.height}
        />
      )}

      {element.type === "table" && (
        <TableNode
          props={element.props}
          paint={paint}
          width={element.width}
          height={element.height}
          onEditCell={(row, column, cell) =>
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
            })
          }
        />
      )}

      {element.type === "shape" && (
        <ShapeNode
          props={element.props}
          paint={paint}
          width={element.width}
          height={element.height}
        />
      )}
    </Group>
  );
}

/** An uploaded image, letterboxed or centre-cropped to the box it is given. */
function ImageNode({
  assetId,
  fit,
  width,
  height,
}: {
  assetId: string;
  fit: "contain" | "cover";
  width: number;
  height: number;
}) {
  const image = useCanvasImage(presentationAssetUrl(assetId));
  if (!image) return null;

  const natural = { width: image.naturalWidth || width, height: image.naturalHeight || height };

  if (fit === "contain") {
    const ratio = Math.min(width / natural.width, height / natural.height);
    const drawn = { width: natural.width * ratio, height: natural.height * ratio };

    return (
      <KonvaImage
        listening={false}
        image={image}
        x={(width - drawn.width) / 2}
        y={(height - drawn.height) / 2}
        width={drawn.width}
        height={drawn.height}
      />
    );
  }

  // Cover: fill the box and crop what does not fit, from the centre.
  const ratio = Math.max(width / natural.width, height / natural.height);
  const crop = { width: width / ratio, height: height / ratio };

  return (
    <KonvaImage
      listening={false}
      image={image}
      width={width}
      height={height}
      crop={{
        x: (natural.width - crop.width) / 2,
        y: (natural.height - crop.height) / 2,
        width: crop.width,
        height: crop.height,
      }}
    />
  );
}

/**
 * A table drawn as what it is: a grid of equal cells over the element's box.
 * The document stores the cells, so resizing the element re-lays the grid
 * instead of scattering text boxes.
 */
function TableNode({
  props,
  paint,
  width,
  height,
  onEditCell,
}: {
  props: TableElementProps;
  paint: ThemePaint;
  width: number;
  height: number;
  onEditCell: (
    row: number,
    column: number,
    cell: { x: number; y: number; width: number; height: number },
  ) => void;
}) {
  const rows = props.rows.length;
  const columns = props.rows[0]?.length ?? 1;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const line = Math.max(1, props.size * 0.05);
  const padding = props.size * 0.3;

  return (
    <>
      {props.header && (
        <Rect
          listening={false}
          width={width}
          height={cellHeight}
          fill={paint.color("muted")}
        />
      )}

      {props.rows.map((row, rowIndex) =>
        row.map((cell, columnIndex) => {
          const geometry = {
            x: columnIndex * cellWidth,
            y: rowIndex * cellHeight,
            width: cellWidth,
            height: cellHeight,
          };

          return (
            <Group key={`${rowIndex}-${columnIndex}`} x={geometry.x} y={geometry.y}>
              <Rect
                width={cellWidth}
                height={cellHeight}
                fill="rgba(0,0,0,0.001)"
                onDblClick={() => onEditCell(rowIndex, columnIndex, geometry)}
              />
              <Text
                listening={false}
                x={padding}
                y={padding}
                width={Math.max(1, cellWidth - padding * 2)}
                height={Math.max(1, cellHeight - padding * 2)}
                text={cell}
                fontSize={props.size}
                fontFamily={paint.font(props.mono === true)}
                fontStyle={props.header && rowIndex === 0 ? "bold" : "normal"}
                fill={paint.color(props.color)}
                verticalAlign="middle"
                wrap="word"
                ellipsis
              />
            </Group>
          );
        }),
      )}

      {/* The rules, drawn last so they sit over the header fill. */}
      {Array.from({ length: rows + 1 }, (_unused, index) => (
        <Line
          key={`h${index}`}
          listening={false}
          points={[0, index * cellHeight, width, index * cellHeight]}
          stroke={paint.color("border")}
          strokeWidth={line}
        />
      ))}
      {Array.from({ length: columns + 1 }, (_unused, index) => (
        <Line
          key={`v${index}`}
          listening={false}
          points={[index * cellWidth, 0, index * cellWidth, height]}
          stroke={paint.color("border")}
          strokeWidth={line}
        />
      ))}
    </>
  );
}

/** A figure. `none` really means no fill, so the prop is omitted, not empty. */
function ShapeNode({
  props,
  paint,
  width,
  height,
}: {
  props: ShapeElementProps;
  paint: ThemePaint;
  width: number;
  height: number;
}) {
  const stroke = paint.color(props.stroke);
  const fill = props.fill === NO_FILL ? {} : { fill: paint.color(props.fill) };
  const inset = props.strokeWidth / 2;
  const common = { listening: false, stroke, strokeWidth: props.strokeWidth } as const;

  if (props.kind === "rect") {
    return (
      <Rect
        {...common}
        {...fill}
        x={inset}
        y={inset}
        width={Math.max(1, width - props.strokeWidth)}
        height={Math.max(1, height - props.strokeWidth)}
      />
    );
  }

  if (props.kind === "ellipse") {
    return (
      <Ellipse
        {...common}
        {...fill}
        x={width / 2}
        y={height / 2}
        radiusX={Math.max(1, (width - props.strokeWidth) / 2)}
        radiusY={Math.max(1, (height - props.strokeWidth) / 2)}
      />
    );
  }

  if (props.kind === "triangle") {
    return (
      <Line
        {...common}
        {...fill}
        closed
        points={[width / 2, inset, width - inset, height - inset, inset, height - inset]}
      />
    );
  }

  // A connector is drawn along the middle of its box, which is why it is born
  // wide and thin: its height is the room the stroke and the head get.
  const thickness = props.strokeWidth > 0 ? props.strokeWidth : Math.max(2, height / 3);

  if (props.kind === "line") {
    return (
      <Line
        listening={false}
        stroke={stroke}
        strokeWidth={thickness}
        points={[0, height / 2, width, height / 2]}
        lineCap="round"
      />
    );
  }

  return (
    <Arrow
      listening={false}
      stroke={stroke}
      // An arrowhead is filled, and a connector's fill is `none` — so it takes
      // the stroke colour rather than disappearing.
      fill={props.fill === NO_FILL ? stroke : paint.color(props.fill)}
      strokeWidth={thickness}
      pointerLength={Math.max(thickness * 2.5, 16)}
      pointerWidth={Math.max(thickness * 2.5, 16)}
      points={[0, height / 2, width, height / 2]}
    />
  );
}
