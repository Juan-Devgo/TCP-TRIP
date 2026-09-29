import { DOCUMENT_IDENTITY } from "@/lib/pdf/template";
import { collectBlob, loadPdfKit } from "@/lib/pdf/pdfkit";

/** What a presentation file is called when its title slugs to nothing. */
const FALLBACK_NAME = "presentation";

/**
 * A download's file name from the presentation title: accents dropped,
 * lower-case, words joined by hyphens — something every OS and mail client
 * keeps intact. `part` distinguishes one slide from the deck.
 */
export function exportFilename(title: string, extension: string, part?: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || FALLBACK_NAME}${part ? `-${part}` : ""}.${extension}`;
}

/**
 * The page a slide is printed on, in PDF points: 13.33 in wide — the size a
 * projector deck is printed at — and as tall as the canvas proportions ask.
 */
export const PDF_PAGE_WIDTH = 960;

export function pdfPageSize(canvas: { width: number; height: number }): [number, number] {
  return [PDF_PAGE_WIDTH, Math.round((PDF_PAGE_WIDTH * canvas.height) / canvas.width)];
}

/**
 * The deck as a PDF: one page per slide, each page the slide's image edge to
 * edge. The images come from `renderSlides`, so the PDF shows exactly what
 * the canvas does.
 */
export async function buildSlidesPdf({
  title,
  canvas,
  images,
}: {
  title: string;
  canvas: { width: number; height: number };
  /** PNG data URLs, in slide order. */
  images: readonly string[];
}): Promise<Blob> {
  const PDFDocument = await loadPdfKit();
  const doc = new PDFDocument({
    autoFirstPage: false,
    info: { Title: title, Creator: DOCUMENT_IDENTITY.appName },
  });
  const done = collectBlob(doc);
  const [width, height] = pdfPageSize(canvas);

  for (const image of images) {
    doc.addPage({ size: [width, height], margin: 0 });
    doc.image(image, 0, 0, { width, height });
  }

  doc.end();
  return done;
}
