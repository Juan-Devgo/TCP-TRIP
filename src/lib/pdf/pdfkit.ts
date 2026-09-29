/**
 * PDFKit in the browser, shared by every document the app generates (exercise
 * sheets, exported presentations).
 */

/**
 * The browser build weighs ~2.4 MB, so it is imported on demand: only a user
 * who actually generates a sheet pays for it.
 */
export async function loadPdfKit(): Promise<typeof import("pdfkit")> {
  const module = await import("pdfkit/js/pdfkit.standalone.js");
  return module.default;
}

/** Resolve once the document has flushed every byte. */
export function collectBlob(doc: PDFKit.PDFDocument): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    doc.on("data", (chunk: Uint8Array<ArrayBuffer>) => chunks.push(chunk));
    doc.on("end", () => resolve(new Blob(chunks, { type: "application/pdf" })));
    doc.on("error", reject);
  });
}
