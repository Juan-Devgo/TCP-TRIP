import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Asked before a new presentation replaces one with unsaved work. With
 * autosave on that is rare — an untitled deck, or one waiting for review —
 * which is exactly when losing it would be a surprise.
 */
export function DiscardChangesDialog({
  open,
  onCancel,
  onDiscard,
}: {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("presentations.editor.discard.title")}</DialogTitle>
          <DialogDescription>{t("presentations.editor.discard.body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("presentations.editor.discard.keep")}
          </Button>
          <Button variant="destructive" onClick={onDiscard}>
            {t("presentations.editor.discard.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
