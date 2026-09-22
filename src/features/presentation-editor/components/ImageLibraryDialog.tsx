import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssetPanel } from "@/features/presentation-editor/components/AssetPanel";
import type { PresentationAsset } from "@/services/presentations";

/**
 * Insert ▸ Image: the presentation's own picture library.
 *
 * It is a dialog rather than a permanent panel because uploading is rare and
 * the canvas is what the editor is for — a strip of thumbnails next to a 1920
 * px stage costs more room than it earns. Inserting closes it, so the image
 * lands on a slide the author can still see.
 */
export function ImageLibraryDialog({
  open,
  onOpenChange,
  assets,
  disabled,
  uploading,
  onUpload,
  onInsert,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: PresentationAsset[];
  /** No saved presentation yet: there is nothing to attach an upload to. */
  disabled: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onInsert: (asset: PresentationAsset, width: number, height: number) => void;
  onDelete: (asset: PresentationAsset) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("presentations.editor.library")}</DialogTitle>
          <DialogDescription>
            {t("presentations.editor.libraryHint")}
          </DialogDescription>
        </DialogHeader>

        <AssetPanel
          assets={assets}
          disabled={disabled}
          uploading={uploading}
          onUpload={onUpload}
          onInsert={(asset, width, height) => {
            onInsert(asset, width, height);
            onOpenChange(false);
          }}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
