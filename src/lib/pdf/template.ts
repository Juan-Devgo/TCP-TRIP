import type { TFunction } from "i18next";

/**
 * Institutional identity printed on every generated document. This is the one
 * place to edit when the author, the university or the thesis advisor change.
 */
export const DOCUMENT_IDENTITY = {
  appName: "TCP-TRIP",
  author: "Juan Diego García Nieto",
  university: "Universidad del Quindío",
  advisor: "Carlos Eduardo Gómez Montoya Ph.D.",
} as const;

/** Letter page with ~2 cm margins: prints the same on Letter and A4 trays. */
export const PAGE = {
  size: "LETTER",
  margin: 56,
} as const;

/**
 * Standard PDF fonts, embedded in every reader. The app's Montserrat would
 * have to be downloaded at generation time, which would make the action fail
 * offline for a cosmetic gain.
 */
export const FONT = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  mono: "Courier",
  monoBold: "Courier-Bold",
} as const;

/** Print palette: black on white with the brand amber as the only accent. */
export const COLOR = {
  text: "#000000",
  muted: "#555555",
  rule: "#FE9A00",
  faint: "#BBBBBB",
} as const;

/** Horizontal span between margins. */
export function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

/**
 * Institutional masthead plus the sheet's own title. Leaves the cursor just
 * below the amber rule, ready for the first block of content.
 */
export function drawHeader(
  doc: PDFKit.PDFDocument,
  { title, subtitle }: { title: string; subtitle: string },
): void {
  const { left } = doc.page.margins;
  const width = contentWidth(doc);

  doc
    .font(FONT.bold)
    .fontSize(9)
    .fillColor(COLOR.muted)
    .text(DOCUMENT_IDENTITY.appName.toUpperCase(), left, doc.page.margins.top, {
      width,
      characterSpacing: 1.5,
    });

  doc
    .font(FONT.bold)
    .fontSize(18)
    .fillColor(COLOR.text)
    .text(title, { width })
    .font(FONT.regular)
    .fontSize(10)
    .fillColor(COLOR.muted)
    .text(subtitle, { width });

  const ruleY = doc.y + 8;
  doc
    .moveTo(left, ruleY)
    .lineTo(left + width, ruleY)
    .lineWidth(2)
    .strokeColor(COLOR.rule)
    .stroke();

  doc.y = ruleY + 16;
  doc.x = left;
  doc.fillColor(COLOR.text);
}

/**
 * Page numbers on every page. Call it once, right before `doc.end()`, with the
 * document created in `bufferPages` mode — that is what allows going back to
 * page 1 once the total is known.
 */
export function drawFooters(doc: PDFKit.PDFDocument, t: TFunction): void {
  const range = doc.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);

    // Writing below the bottom margin would otherwise spill onto a new page.
    const { bottom } = doc.page.margins;
    doc.page.margins.bottom = 0;

    const width = contentWidth(doc);
    const y = doc.page.height - bottom + 12;

    doc
      .font(FONT.regular)
      .fontSize(8)
      .fillColor(COLOR.muted)
      .text(
        `${DOCUMENT_IDENTITY.author} · ${DOCUMENT_IDENTITY.advisor} · ${DOCUMENT_IDENTITY.university}`,
        doc.page.margins.left,
        y,
        { width, align: "left", lineBreak: false },
      )
      .text(
        t("exercises.pdf.page", {
          page: index - range.start + 1,
          total: range.count,
        }),
        doc.page.margins.left,
        y,
        { width, align: "right", lineBreak: false },
      );

    doc.page.margins.bottom = bottom;
  }
}
