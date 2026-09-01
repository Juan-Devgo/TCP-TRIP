import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, FileJson, FileImage, FileCode2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type ExportFormat = "json" | "svg" | "png";

/** Picks the file the diagram leaves as: the schema, or the picture. */
export function ProtocolExportDialog({
  open,
  onOpenChange,
  onExport,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (format: ExportFormat) => void;
  /** Already translated; set when the last attempt failed. */
  error: string | null;
}) {
  const { t } = useTranslation();

  const options: { format: ExportFormat; icon: React.ReactNode }[] = [
    { format: "json", icon: <FileJson /> },
    { format: "svg", icon: <FileCode2 /> },
    { format: "png", icon: <FileImage /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tools.protocolBuilder.export.title")}</DialogTitle>
          <DialogDescription>
            {t("tools.protocolBuilder.export.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {options.map(({ format, icon }) => (
            <Button
              key={format}
              type="button"
              variant="outline"
              className="h-auto justify-start py-2"
              onClick={() => onExport(format)}
            >
              {icon}
              <span className="flex flex-col items-start">
                <span>{t(`tools.protocolBuilder.export.${format}`)}</span>
                <span className="text-xs text-muted-foreground">
                  {t(`tools.protocolBuilder.export.${format}Hint`)}
                </span>
              </span>
            </Button>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("tools.protocolBuilder.form.cancel")}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The read-only link to a saved protocol. */
export function ProtocolShareDialog({
  open,
  onOpenChange,
  url,
  /** `false` while the API is still a stand-in, so the link is not live yet. */
  live,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  live: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("Could not copy the share link", error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tools.protocolBuilder.share.title")}</DialogTitle>
          <DialogDescription>
            {t("tools.protocolBuilder.share.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input readOnly value={url} className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void copy()}
            aria-label={t(copied ? "common.copied" : "common.copy")}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>

        {!live && (
          <p className="text-xs text-muted-foreground">
            {t("tools.protocolBuilder.share.pending")}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("tools.protocolBuilder.form.cancel")}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Clearing throws away a schema that may never have been saved — hence a stop. */
export function ProtocolClearDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("tools.protocolBuilder.clear.title")}</DialogTitle>
          <DialogDescription>
            {t("tools.protocolBuilder.clear.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("tools.protocolBuilder.clear.cancel")}
          </DialogClose>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {t("tools.protocolBuilder.clear.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
