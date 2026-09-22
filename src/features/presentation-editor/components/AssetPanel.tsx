import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ALLOWED_ASSET_MIME_TYPES,
  MAX_ASSETS_PER_PRESENTATION,
  MAX_ASSET_BYTES,
  presentationAssetUrl,
} from "@/lib/presentations/contract";
import type { PresentationAsset } from "@/services/presentations";

/**
 * The images a presentation owns.
 *
 * Uploading needs a saved presentation, because the bytes are stored against
 * its id — so the panel asks for a save first rather than holding files in
 * memory and hoping. Inserting reads the image's **natural size** so the
 * element lands with the right aspect ratio instead of a guessed square.
 */
export function AssetPanel({
  assets,
  disabled,
  uploading,
  onUpload,
  onInsert,
  onDelete,
}: {
  assets: PresentationAsset[];
  /** No saved presentation yet: there is nothing to attach an upload to. */
  disabled: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onInsert: (asset: PresentationAsset, width: number, height: number) => void;
  onDelete: (asset: PresentationAsset) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [measuring, setMeasuring] = useState<string | null>(null);

  async function insert(asset: PresentationAsset) {
    setMeasuring(asset.id);
    try {
      const { width, height } = await measure(presentationAssetUrl(asset.id));
      onInsert(asset, width, height);
    } finally {
      setMeasuring(null);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold">
          {t("presentations.editor.images", {
            count: assets.length,
            max: MAX_ASSETS_PER_PRESENTATION,
          })}
        </h3>

        <Button
          size="sm"
          variant="outline"
          disabled={disabled || uploading || assets.length >= MAX_ASSETS_PER_PRESENTATION}
          onClick={() => input.current?.click()}
        >
          <Upload />
          {t(uploading ? "presentations.editor.uploading" : "presentations.editor.upload")}
        </Button>
        <input
          ref={input}
          type="file"
          hidden
          accept={ALLOWED_ASSET_MIME_TYPES.join(",")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset first: picking the same file twice must fire again.
            event.target.value = "";
            if (file) onUpload(file);
          }}
        />
      </div>

      {disabled ? (
        <p className="text-muted-foreground m-0 text-xs">
          {t("presentations.editor.saveBeforeUpload")}
        </p>
      ) : (
        <p className="text-muted-foreground m-0 text-xs">
          {t("presentations.editor.uploadHint", {
            formats: "PNG · JPEG · WEBP · GIF · AVIF",
            max: Math.round(MAX_ASSET_BYTES / (1024 * 1024)),
          })}
        </p>
      )}

      {assets.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {assets.map((asset) => (
            <li key={asset.id} className="border-border m-0 w-28 rounded-md border p-1">
              <img
                src={presentationAssetUrl(asset.id)}
                alt={asset.filename}
                className="h-16 w-full rounded object-contain"
                loading="lazy"
              />
              <span className="text-muted-foreground mt-1 block truncate text-[11px]">
                {asset.filename}
              </span>
              <div className="mt-1 flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={measuring === asset.id}
                  aria-label={t("presentations.editor.insertImage")}
                  title={t("presentations.editor.insertImage")}
                  onClick={() => void insert(asset)}
                >
                  <ImagePlus />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive ml-auto size-7"
                  aria-label={t("presentations.editor.deleteImage")}
                  title={t("presentations.editor.deleteImage")}
                  onClick={() => onDelete(asset)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The image's own pixel size. A failed load still resolves — with the stage's
 * default box — so a broken asset cannot leave the insert button spinning.
 */
function measure(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 800, height: 600 });
    image.src = url;
  });
}
