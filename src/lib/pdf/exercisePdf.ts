import type { TFunction } from "i18next";

import type { Difficulty, Exercise } from "@/lib/exercises/utils";
import {
  COLOR,
  contentWidth,
  DOCUMENT_IDENTITY,
  drawFooters,
  drawHeader,
  FONT,
  PAGE,
} from "@/lib/pdf/template";
import { collectBlob, loadPdfKit } from "@/lib/pdf/pdfkit";

export type ExercisePdfOptions = {
  exercises: Exercise[];
  /** Already translated name of the tool the exercises come from. */
  toolTitle: string;
  difficulty: Difficulty;
  includeAnswers: boolean;
  t: TFunction;
};

/** Vertical space left under each statement for the student to work in. */
const WORK_SPACE = 30;

/**
 * Render a set of exercises as a printable PDF. Every tool goes through this
 * function, which is what keeps the institutional template identical across
 * the app; the tool only supplies its title and its exercises.
 */
export async function buildExercisePdf({
  exercises,
  toolTitle,
  difficulty,
  includeAnswers,
  t,
}: ExercisePdfOptions): Promise<Blob> {
  const PDFDocument = await loadPdfKit();
  const doc = new PDFDocument({
    size: PAGE.size,
    margin: PAGE.margin,
    bufferPages: true,
    info: {
      Title: t("exercises.pdf.title", { tool: toolTitle }),
      Author: DOCUMENT_IDENTITY.author,
    },
  });

  const blob = collectBlob(doc);
  const width = contentWidth(doc);

  drawHeader(doc, {
    title: t("exercises.pdf.title", { tool: toolTitle }),
    subtitle: t("exercises.pdf.subtitle", {
      difficulty: t(`exercises.difficulty.${difficulty}`),
      count: exercises.length,
    }),
  });
  doc.moveDown(1);
  drawStudentFields(doc, t);
  doc.moveDown(1.5);

  exercises.forEach((exercise, index) => {
    doc
      .font(FONT.mono)
      .fontSize(11)
      .fillColor(COLOR.text)
      .text(`${index + 1}.  ${exercise.prompt}`, { width });
    doc.y += WORK_SPACE;
  });

  if (includeAnswers) {
    doc.addPage();
    drawHeader(doc, {
      title: t("exercises.pdf.answersTitle"),
      subtitle: t("exercises.pdf.subtitle", {
        difficulty: t(`exercises.difficulty.${difficulty}`),
        count: exercises.length,
      }),
    });

    exercises.forEach((exercise, index) => {
      doc
        .font(FONT.mono)
        .fontSize(10)
        .fillColor(COLOR.text)
        .text(`${index + 1}.  ${exercise.answer}`, { width });
      doc.moveDown(0.35);
    });
  }

  drawFooters(doc, t);
  doc.end();

  return blob;
}

/** "Nombre: ____  Fecha: ____" line, so the sheet works printed. */
function drawStudentFields(doc: PDFKit.PDFDocument, t: TFunction): void {
  const width = contentWidth(doc);
  const y = doc.y;
  const half = width / 2;

  doc.font(FONT.regular).fontSize(10).fillColor(COLOR.muted);
  doc.text(`${t("exercises.pdf.studentName")}:`, doc.page.margins.left, y, {
    width: half,
    lineBreak: false,
  });
  doc.text(`${t("exercises.pdf.date")}:`, doc.page.margins.left + half, y, {
    width: half,
    lineBreak: false,
  });

  const lineY = y + 12;
  doc.lineWidth(0.5).strokeColor(COLOR.faint);
  doc
    .moveTo(doc.page.margins.left + 70, lineY)
    .lineTo(doc.page.margins.left + half - 20, lineY)
    .stroke();
  doc
    .moveTo(doc.page.margins.left + half + 45, lineY)
    .lineTo(doc.page.margins.left + width, lineY)
    .stroke();

  doc.x = doc.page.margins.left;
  doc.y = lineY;
  doc.fillColor(COLOR.text);
}

/** Kebab-cased, accent-free file name: `conversor-de-bases-facil.pdf`. */
export function exercisePdfFilename(
  toolTitle: string,
  difficulty: Difficulty,
): string {
  const slug = toolTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "ejercicios"}-${difficulty}.pdf`;
}

/** Hand the finished document to the browser as a download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
