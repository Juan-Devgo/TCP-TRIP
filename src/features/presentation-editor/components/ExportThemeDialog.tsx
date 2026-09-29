import { useTranslation } from "react-i18next";
import { Loader2, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PaintTheme } from "@/features/presentation-editor/lib/themeColors";

/** What is being exported: the slide under the pointer, or the whole deck. */
export type ExportRequest = { kind: "png" } | { kind: "pdf" };

const THEMES: { value: PaintTheme; icon: React.ComponentType }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
];

/**
 * Asks which palette an export is drawn in, every time.
 *
 * A slide stores token names, so it has a light and a dark rendering and
 * neither is "the" slide: a printed handout wants light, a PNG pasted into a
 * dark slide deck wants dark. The two choices are the buttons themselves — one
 * click picks the palette and starts the export.
 */
export function ExportThemeDialog({
  request,
  busy,
  onOpenChange,
  onExport,
}: {
  /** `null` when closed. */
  request: ExportRequest | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (theme: PaintTheme) => void;
}) {
  const { t } = useTranslation();
  const kind = request?.kind ?? "png";

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !busy && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`presentations.export.${kind}.title`)}</DialogTitle>
          <DialogDescription>{t("presentations.export.themeHint")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {THEMES.map(({ value, icon: Icon }) => (
            <Button
              key={value}
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              disabled={busy}
              onClick={() => onExport(value)}
            >
              <Icon />
              {t(`presentations.export.themes.${value}`)}
            </Button>
          ))}
        </div>

        {busy && (
          <p className="text-muted-foreground m-0 flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {t("presentations.export.working")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
