import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { findFieldType } from "@/features/protocol-builder/lib/fieldTypes";
import {
  isFreeField,
  layoutProtocol,
  listFields,
  totalBits,
} from "@/features/protocol-builder/lib/protocol";
import {
  fromProtocolDocument,
  renderProtocolSvg,
  type DiagramLabels,
  type ProtocolDocument,
} from "@/features/protocol-builder/lib/protocolExport";

/**
 * A saved protocol as a reader sees it: the diagram, then the fields in
 * order. Read-only by construction — there is no state, no drag and no dialog.
 *
 * The picture is the **exported** SVG (`renderProtocolSvg`), not
 * `ProtocolDiagram`. That component is built around selection, dragging and
 * keyboard editing; teaching it a read-only mode would cost more than reusing
 * the drawing the export path already produces, and this way the link shows
 * exactly what a download would.
 */
export function SharedProtocolView({ document }: { document: ProtocolDocument }) {
  const { t } = useTranslation();

  const protocol = fromProtocolDocument(document);
  const labels: DiagramLabels = {
    free: t("tools.protocolBuilder.field.free"),
    untitled: t("tools.protocolBuilder.untitled"),
    bits: (count) => t("tools.protocolBuilder.field.bits", { count }),
  };

  const svg = renderProtocolSvg(protocol, labels);
  const entries = listFields(protocol);
  const rows = layoutProtocol(protocol);

  // The same running cursor `layoutProtocol` walks: a field starts where the
  // previous one ended, which is what makes the offsets match the ruler.
  let cursor = 0;
  const fields = entries.map((entry) => {
    const offset = cursor;
    cursor += entry.field.length;
    return { ...entry, offset };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0">{protocol.name || labels.untitled}</h1>
        <p className="m-0 text-muted-foreground">
          {[
            t("tools.protocolBuilder.summary.fields", { count: entries.length }),
            t("tools.protocolBuilder.summary.bits", { count: totalBits(protocol) }),
            t("tools.protocolBuilder.summary.rows", { count: rows.length }),
          ].join(" · ")}
        </p>
      </header>

      {/* An <img> rather than inlined markup: the diagram is a picture here,
          and nothing from the document reaches the DOM as HTML. */}
      <div className="overflow-x-auto rounded-lg border bg-white p-4">
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
          alt={protocol.name || labels.untitled}
        />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("page.shared.offset")}</TableHead>
              <TableHead>{t("tools.protocolBuilder.form.name")}</TableHead>
              <TableHead>{t("tools.protocolBuilder.form.type")}</TableHead>
              <TableHead>{t("tools.protocolBuilder.form.length")}</TableHead>
              <TableHead>{t("tools.protocolBuilder.form.meaning")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map(({ field, group, offset }) => {
              const type = findFieldType(field.typeId);
              return (
                <TableRow key={field.id}>
                  <TableCell className="font-mono">{offset}</TableCell>
                  <TableCell>
                    {group && (
                      <span className="text-muted-foreground">{group.name} · </span>
                    )}
                    {isFreeField(field) ? labels.free : field.name}
                  </TableCell>
                  <TableCell>
                    {type ? t(`tools.protocolBuilder.types.${type.id}.label`) : "—"}
                  </TableCell>
                  <TableCell className="font-mono">{field.length}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {field.meaning || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
