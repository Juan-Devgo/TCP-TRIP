/**
 * The standalone bundle is the browser build of PDFKit: it carries its own
 * fontkit and AFM metrics and touches no Node built-ins, so it is the only
 * entry point that survives bundling for the browser. It ships without types,
 * so borrow the ones from the Node entry point.
 */
declare module "pdfkit/js/pdfkit.standalone.js" {
  const PDFDocument: typeof import("pdfkit");
  export default PDFDocument;
}
