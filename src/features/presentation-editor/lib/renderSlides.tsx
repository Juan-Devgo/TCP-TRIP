import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Group, Layer, Rect, Stage } from "react-konva";
import type Konva from "konva";

import { ElementArt } from "@/features/presentation-editor/components/SlideArt";
import {
  themePaint,
  type PaintTheme,
  type ThemePaint,
} from "@/features/presentation-editor/lib/themeColors";
import { preloadCanvasImage } from "@/features/presentation-editor/lib/useCanvasImage";
import {
  presentationAssetUrl,
  type PresentationCanvas,
  type PresentationSlide,
} from "@/lib/presentations/contract";

/**
 * Slides as PNG data URLs, one per slide, at the document's own size.
 *
 * The slides are drawn by a Konva stage mounted off-screen with the **same
 * element drawing as the editor** (`ElementArt`), minus everything that is
 * editing rather than content: no grid, no rulers, no transformer. So an
 * exported slide is what was laid out, not a second interpretation of it.
 *
 * The palette is the theme the author picked for the export, not the one on
 * screen — a slide stores token names, so it has an answer for both.
 */
export async function renderSlides(
  slides: readonly PresentationSlide[],
  canvas: PresentationCanvas,
  theme: PaintTheme,
): Promise<string[]> {
  // Konva draws once: every picture has to be decoded, and the webfonts the
  // text uses loaded, before the stage exists.
  const assets = new Set(
    slides.flatMap((slide) =>
      slide.elements.flatMap((element) =>
        element.type === "image" ? [presentationAssetUrl(element.props.assetId)] : [],
      ),
    ),
  );
  await Promise.all([...assets].map(preloadCanvasImage));
  await window.document.fonts.ready;

  const paint = themePaint(theme);
  const host = window.document.createElement("div");
  // Laid out (a detached node would do too) but never seen or read aloud.
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  window.document.body.append(host);
  const root = createRoot(host);

  try {
    const images: string[] = [];
    for (const slide of slides) {
      images.push(
        await new Promise<string>((resolve) => {
          root.render(
            <SlideStill slide={slide} canvas={canvas} paint={paint} onReady={resolve} />,
          );
        }),
      );
    }
    return images;
  } finally {
    root.unmount();
    host.remove();
  }
}

/** One slide, drawn once and handed back as an image as soon as it exists. */
function SlideStill({
  slide,
  canvas,
  paint,
  onReady,
}: {
  slide: PresentationSlide;
  canvas: PresentationCanvas;
  paint: ThemePaint;
  onReady: (image: string) => void;
}) {
  const stage = useRef<Konva.Stage>(null);

  useEffect(() => {
    // react-konva commits the layer's children through its own reconciler;
    // one frame later they are all on the stage, whatever it scheduled.
    const frame = requestAnimationFrame(() => {
      const node = stage.current;
      if (node) onReady(node.toDataURL({ mimeType: "image/png", pixelRatio: 1 }));
    });
    return () => cancelAnimationFrame(frame);
  }, [slide, onReady]);

  return (
    <Stage ref={stage} width={canvas.width} height={canvas.height} listening={false}>
      <Layer>
        <Rect
          width={canvas.width}
          height={canvas.height}
          fill={paint.color(slide.background ?? "background")}
        />
        {/* Array order is paint order, as on the canvas. */}
        {slide.elements.map((element) => (
          <Group
            key={element.id}
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            rotation={element.rotation}
          >
            <ElementArt element={element} paint={paint} />
          </Group>
        ))}
      </Layer>
    </Stage>
  );
}

/** A data URL as bytes the browser can download. */
export async function dataUrlToBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  return response.blob();
}
