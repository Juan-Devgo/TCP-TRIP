import { useEffect, useRef, useState } from "react";

import {
  NO_FILL,
  presentationAssetUrl,
  type PresentationCanvas,
  type PresentationElement,
  type PresentationSlide,
  type ShapeElement,
  type TableElement,
} from "@/lib/presentations/contract";
import { cn } from "@/lib/utils";

/**
 * One slide, drawn at its real size and scaled to fit whatever it is given.
 *
 * It lives in `components/common/` and not in a feature because **three places
 * render the same slide**: the teacher's editor, the student's reading view and
 * presentation mode. A feature may not import another feature, and a slide that
 * looked different in the editor than on the projector would defeat the point
 * of a fixed canvas.
 *
 * Nothing here is a `<canvas>`: the elements are ordinary DOM nodes, so text
 * stays selectable, screen-readable and themed by the same CSS variables as the
 * rest of the app — which is what makes a slide authored in light mode readable
 * when the projector is in dark mode.
 */
export function PresentationStage({
  slide,
  canvas,
  className,
  overlay,
}: {
  slide: PresentationSlide;
  canvas: PresentationCanvas;
  className?: string;
  /**
   * Drawn on top of the slide, in **canvas coordinates** — the editor's
   * selection handles. It receives the scale so a handle can stay the same size
   * on screen however far the stage is zoomed out.
   */
  overlay?: (scale: number) => React.ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // The stage is scaled, not reflowed: one measurement of the available width
  // is all the geometry it needs.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry?.contentRect.width ?? 0);
    });
    observer.observe(element);
    setWidth(element.clientWidth);

    return () => observer.disconnect();
  }, []);

  const scale = width > 0 ? width / canvas.width : 0;

  return (
    <div
      ref={frame}
      className={cn("relative w-full overflow-hidden", className)}
      // The frame owns the aspect ratio, so the slide keeps its shape before
      // the first measurement and never jumps when it arrives.
      style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `scale(${scale})`,
          background: `var(--color-${slide.background ?? "background"})`,
        }}
      >
        {/* Array order is paint order — there is no z-index anywhere. */}
        {slide.elements.map((element) => (
          <StageElement key={element.id} element={element} />
        ))}
      </div>

      {overlay && scale > 0 && (
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: canvas.width,
            height: canvas.height,
            transform: `scale(${scale})`,
          }}
        >
          {overlay(scale)}
        </div>
      )}
    </div>
  );
}

/** The box every element sits in: position, size and rotation, nothing else. */
function StageElement({ element }: { element: PresentationElement }) {
  return (
    <div
      className="absolute"
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        transform: element.rotation === 0 ? undefined : `rotate(${element.rotation}deg)`,
      }}
    >
      {element.type === "table" ? (
        <StageTable element={element} />
      ) : element.type === "shape" ? (
        <StageShape element={element} />
      ) : element.type === "text" ? (
        <p
          className={cn(
            "m-0 h-full w-full break-words",
            element.props.mono ? "font-mono" : "font-sans",
          )}
          style={{
            fontSize: element.props.size,
            fontWeight: element.props.weight,
            textAlign: element.props.align,
            // A token name, never a hex value: the slide follows the theme.
            color: `var(--color-${element.props.color})`,
            lineHeight: 1.2,
            whiteSpace: "pre-wrap",
          }}
        >
          {element.props.text}
        </p>
      ) : (
        <img
          src={presentationAssetUrl(element.props.assetId)}
          alt={element.props.alt}
          className="h-full w-full"
          style={{ objectFit: element.props.fit }}
          // Slides are read in order, and a deck can hold fifty images.
          loading="lazy"
          draggable={false}
        />
      )}
    </div>
  );
}

/**
 * A table, laid out by the browser from the cells the document stores: equal
 * columns, equal rows, the first one optionally a heading. The canvas editor
 * draws the same grid with Konva — same geometry, two renderers, because a
 * projected slide has to be selectable text here and a bitmap there.
 */
function StageTable({ element }: { element: TableElement }) {
  const { rows, header, size, color, mono } = element.props;
  const rule = Math.max(1, size * 0.05);
  const padding = size * 0.3;

  return (
    <table
      className={cn("m-0 border-collapse", mono ? "font-mono" : "font-sans")}
      style={{
        width: "100%",
        height: "100%",
        tableLayout: "fixed",
        fontSize: size,
        color: `var(--color-${color})`,
        lineHeight: 1.2,
      }}
    >
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            style={
              header && rowIndex === 0
                ? { background: "var(--color-muted)" }
                : undefined
            }
          >
            {row.map((cell, columnIndex) => (
              <td
                key={columnIndex}
                style={{
                  border: `${rule}px solid var(--color-border)`,
                  padding,
                  fontWeight: header && rowIndex === 0 ? 600 : 400,
                  verticalAlign: "middle",
                  overflow: "hidden",
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * A figure, as SVG rather than as a `<div>` with borders: an ellipse, a
 * triangle and an arrowhead are not box shapes, and the viewBox matches the
 * element's own box so a stroke keeps its width when the stage scales.
 */
function StageShape({ element }: { element: ShapeElement }) {
  const { kind, fill, stroke, strokeWidth } = element.props;
  const width = element.width;
  const height = element.height;
  const inset = strokeWidth / 2;
  const paint = {
    fill: fill === NO_FILL ? "none" : `var(--color-${fill})`,
    stroke: `var(--color-${stroke})`,
    strokeWidth,
  };

  // A connector is drawn along the middle of its box; its height is the room
  // the stroke and the arrowhead get.
  const thickness = strokeWidth > 0 ? strokeWidth : Math.max(2, height / 3);
  const head = Math.max(thickness * 2.5, 16);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {kind === "rect" && (
        <rect
          x={inset}
          y={inset}
          width={Math.max(1, width - strokeWidth)}
          height={Math.max(1, height - strokeWidth)}
          {...paint}
        />
      )}
      {kind === "ellipse" && (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={Math.max(1, (width - strokeWidth) / 2)}
          ry={Math.max(1, (height - strokeWidth) / 2)}
          {...paint}
        />
      )}
      {kind === "triangle" && (
        <polygon
          points={`${width / 2},${inset} ${width - inset},${height - inset} ${inset},${height - inset}`}
          {...paint}
        />
      )}
      {kind === "line" && (
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={paint.stroke}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
      )}
      {kind === "arrow" && (
        <>
          <line
            x1={0}
            y1={height / 2}
            x2={Math.max(0, width - head)}
            y2={height / 2}
            stroke={paint.stroke}
            strokeWidth={thickness}
          />
          {/* The head is filled, and a connector's fill is `none` — so it
              takes the stroke colour rather than disappearing. */}
          <polygon
            points={`${width},${height / 2} ${Math.max(0, width - head)},${height / 2 - head / 2} ${Math.max(0, width - head)},${height / 2 + head / 2}`}
            fill={paint.stroke}
          />
        </>
      )}
    </svg>
  );
}
