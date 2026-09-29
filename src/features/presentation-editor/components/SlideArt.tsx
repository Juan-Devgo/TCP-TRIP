import {
  Arrow,
  Ellipse,
  Group,
  Image as KonvaImage,
  Line,
  Rect,
  Text,
} from "react-konva";

import type { ThemePaint } from "@/features/presentation-editor/lib/themeColors";
import { useCanvasImage } from "@/features/presentation-editor/lib/useCanvasImage";
import {
  NO_FILL,
  presentationAssetUrl,
  type PresentationElement,
  type ShapeElementProps,
  type TableElementProps,
} from "@/lib/presentations/contract";

type CellBox = { x: number; y: number; width: number; height: number };

/**
 * What one element looks like on a Konva canvas, drawn inside a box whose
 * origin is the element's top-left corner.
 *
 * It is the drawing and nothing else — no dragging, no selection — so the
 * editable canvas (`SlideCanvas`) and the exporter (`slideRenderer`) paint a
 * slide with the same code and a PNG cannot drift from what was laid out.
 */
export function ElementArt({
  element,
  paint,
  onEditCell,
}: {
  element: PresentationElement;
  paint: ThemePaint;
  /** A double-click on a table cell; absent where nothing is editable. */
  onEditCell?: (row: number, column: number, cell: CellBox) => void;
}) {
  switch (element.type) {
    case "text":
      return (
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
      );

    case "image":
      return (
        <ImageNode
          assetId={element.props.assetId}
          fit={element.props.fit}
          width={element.width}
          height={element.height}
        />
      );

    case "table":
      return (
        <TableNode
          props={element.props}
          paint={paint}
          width={element.width}
          height={element.height}
          {...(onEditCell ? { onEditCell } : {})}
        />
      );

    case "shape":
      return (
        <ShapeNode
          props={element.props}
          paint={paint}
          width={element.width}
          height={element.height}
        />
      );
  }
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
  onEditCell?: (row: number, column: number, cell: CellBox) => void;
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
                onDblClick={() => onEditCell?.(rowIndex, columnIndex, geometry)}
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
