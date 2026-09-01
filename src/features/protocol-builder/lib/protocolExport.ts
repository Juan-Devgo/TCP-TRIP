/**
 * What leaves the builder: the schema as JSON — the format `Mis Protocolos`
 * and the message composer will read — and the diagram as a picture, for a
 * report or a slide.
 */

import {
  DEFAULT_RULER_WIDTH,
  isRulerWidth,
  layoutProtocol,
  listFields,
  totalBits,
  type Protocol,
} from "@/features/protocol-builder/lib/protocol";

/** Bumped whenever the shape below stops being readable by an older reader. */
export const PROTOCOL_SCHEMA_VERSION = 1;

export type ProtocolDocument = {
  version: number;
  name: string;
  rulerWidth: number;
  totalBits: number;
  fieldCount: number;
  nodes: Protocol["nodes"];
};

export function toProtocolDocument(protocol: Protocol): ProtocolDocument {
  return {
    version: PROTOCOL_SCHEMA_VERSION,
    name: protocol.name.trim(),
    rulerWidth: protocol.rulerWidth,
    totalBits: totalBits(protocol),
    fieldCount: listFields(protocol).length,
    nodes: protocol.nodes,
  };
}

/** The inverse, so an exported file can come back in later. */
export function fromProtocolDocument(document: ProtocolDocument): Protocol {
  return {
    name: document.name,
    rulerWidth: isRulerWidth(document.rulerWidth)
      ? document.rulerWidth
      : DEFAULT_RULER_WIDTH,
    nodes: document.nodes,
  };
}

export function protocolFilename(protocol: Protocol, extension: string): string {
  const slug =
    protocol.name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "protocolo";
  return `${slug}.${extension}`;
}

export function protocolJsonBlob(protocol: Protocol): Blob {
  return new Blob([JSON.stringify(toProtocolDocument(protocol), null, 2)], {
    type: "application/json",
  });
}

/** Copy the SVG needs from the component, already translated. */
export type DiagramLabels = {
  free: string;
  /** e.g. `(8 bits)` — receives the field's length. */
  bits: (count: number) => string;
  untitled: string;
};

const CELL_WIDTH = 22;
const ROW_HEIGHT = 46;
const RULER_HEIGHT = 30;
const PADDING = 16;
const TITLE_HEIGHT = 28;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The diagram as a standalone SVG. Deliberately independent of the React
 * rendering: it is drawn from the same layout, but with its own black-on-white
 * palette so it stays readable pasted into a document of any theme.
 */
export function renderProtocolSvg(protocol: Protocol, labels: DiagramLabels): string {
  const rows = layoutProtocol(protocol);
  const width = protocol.rulerWidth * CELL_WIDTH;
  const height =
    PADDING * 2 + TITLE_HEIGHT + RULER_HEIGHT + rows.length * ROW_HEIGHT;
  const fieldsById = new Map(
    listFields(protocol).map((entry) => [entry.field.id, entry]),
  );

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width + PADDING * 2}" height="${height}" viewBox="0 0 ${width + PADDING * 2} ${height}" font-family="monospace">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="${PADDING}" y="${PADDING + 16}" font-size="15" font-weight="bold" fill="#111111">${escapeXml(protocol.name.trim() || labels.untitled)}</text>`,
  );

  // The ruler: a number every four bits, plus the tick under it.
  const rulerY = PADDING + TITLE_HEIGHT;
  for (let bit = 0; bit <= protocol.rulerWidth; bit += 4) {
    const x = PADDING + bit * CELL_WIDTH;
    parts.push(
      `<text x="${x}" y="${rulerY + 10}" font-size="9" fill="#555555" text-anchor="middle">${bit}</text>`,
      `<line x1="${x}" y1="${rulerY + 14}" x2="${x}" y2="${rulerY + 20}" stroke="#999999" stroke-width="1"/>`,
    );
  }

  const gridTop = rulerY + RULER_HEIGHT;
  for (const row of rows) {
    const y = gridTop + row.index * ROW_HEIGHT;
    for (const segment of row.segments) {
      const entry = fieldsById.get(segment.fieldId);
      const x = PADDING + (segment.offset % protocol.rulerWidth) * CELL_WIDTH;
      const w = segment.length * CELL_WIDTH;
      const free = !entry || entry.field.typeId === null;
      const name = free
        ? labels.free
        : segment.continued
          ? `↳ ${entry.field.name}`
          : entry.field.name;

      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${ROW_HEIGHT}" fill="${free ? "#f5f5f5" : "#ffffff"}" stroke="#333333" stroke-width="1" ${free ? 'stroke-dasharray="4 3"' : ""}/>`,
        `<text x="${x + w / 2}" y="${y + ROW_HEIGHT / 2}" font-size="10" fill="#111111" text-anchor="middle">${escapeXml(name)}</text>`,
        `<text x="${x + w / 2}" y="${y + ROW_HEIGHT / 2 + 13}" font-size="8" fill="#666666" text-anchor="middle">${escapeXml(labels.bits(segment.fieldLength))}</text>`,
      );

      if (entry?.group && segment.firstOfGroup && !segment.continued) {
        parts.push(
          `<text x="${x + 3}" y="${y + 10}" font-size="7" fill="#7F00FF">${escapeXml(entry.group.name)}</text>`,
        );
      }
    }
  }

  parts.push("</svg>");
  return parts.join("\n");
}

export function protocolSvgBlob(protocol: Protocol, labels: DiagramLabels): Blob {
  return new Blob([renderProtocolSvg(protocol, labels)], {
    type: "image/svg+xml;charset=utf-8",
  });
}

/**
 * The same SVG rasterised through a canvas, since a slide deck takes a PNG and
 * not every editor takes an SVG. Browser-only: it needs `Image` and a canvas.
 */
export async function protocolPngBlob(
  protocol: Protocol,
  labels: DiagramLabels,
  scale = 2,
): Promise<Blob> {
  const svg = renderProtocolSvg(protocol, labels);
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas produced no blob"))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not rasterise the diagram"));
    image.src = url;
  });
}
