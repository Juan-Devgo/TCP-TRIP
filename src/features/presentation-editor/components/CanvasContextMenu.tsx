import { useTranslation } from "react-i18next";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eraser,
  ImageDown,
  Lock,
  LockOpen,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

/**
 * What a right-click landed on. The canvas selects it before the menu opens,
 * so the menu is always about the current selection.
 */
export type ContextTarget =
  | { kind: "board" }
  | { kind: "element"; locked: boolean }
  | { kind: "group"; count: number };

/**
 * The right-click menu over the slide canvas.
 *
 * It repeats actions the Edit menu already has — the point is that they are
 * where the pointer is. On the board it offers what acts on the whole slide
 * (paste, undo, redo, clear); on an element, what acts on that element; on a
 * group, only what a group supports.
 *
 * Every target ends with exporting the slide as a PNG: whatever was
 * right-clicked, the slide is what gets drawn — never the selection handles.
 *
 * Clearing the slide asks for no confirmation: it is one undo step, and the
 * Undo item sits right above it.
 */
export function CanvasContextMenu({
  target,
  canPaste,
  canUndo,
  canRedo,
  slideEmpty,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  onClearSlide,
  onDuplicate,
  onRestack,
  onToggleLock,
  onDelete,
  onExportPng,
  children,
}: {
  target: ContextTarget;
  canPaste: boolean;
  canUndo: boolean;
  canRedo: boolean;
  slideEmpty: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearSlide: () => void;
  onDuplicate: () => void;
  onRestack: (where: "front" | "back") => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onExportPng: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  const paste = (
    <ContextMenuItem disabled={!canPaste} onClick={onPaste}>
      <ClipboardPaste />
      {t("presentations.editor.paste")}
      <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
    </ContextMenuItem>
  );

  const history = (
    <>
      <ContextMenuItem disabled={!canUndo} onClick={onUndo}>
        <Undo2 />
        {t("presentations.editor.undo")}
        <ContextMenuShortcut>Ctrl+Z</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!canRedo} onClick={onRedo}>
        <Redo2 />
        {t("presentations.editor.redo")}
        <ContextMenuShortcut>Ctrl+Shift+Z</ContextMenuShortcut>
      </ContextMenuItem>
    </>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger className="w-full">{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-56">
        {target.kind === "board" && (
          <>
            {paste}
            <ContextMenuSeparator />
            {history}
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={slideEmpty}
              variant="destructive"
              onClick={onClearSlide}
            >
              <Eraser />
              {t("presentations.editor.clearSlide")}
            </ContextMenuItem>
          </>
        )}

        {target.kind === "element" && (
          <>
            <ContextMenuItem onClick={onCopy}>
              <Copy />
              {t("presentations.editor.copy")}
              <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
            </ContextMenuItem>
            {paste}
            <ContextMenuItem onClick={onDuplicate}>
              <CopyPlus />
              {t("presentations.editor.duplicateElement")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onRestack("front")}>
              <ArrowUpToLine />
              {t("presentations.editor.bringToFront")}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onRestack("back")}>
              <ArrowDownToLine />
              {t("presentations.editor.sendToBack")}
            </ContextMenuItem>
            <ContextMenuItem onClick={onToggleLock}>
              {target.locked ? <Lock /> : <LockOpen />}
              {t(target.locked ? "presentations.editor.unlock" : "presentations.editor.lock")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              {t("presentations.editor.deleteElement")}
              <ContextMenuShortcut>Supr</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}

        {target.kind === "group" && (
          <>
            <ContextMenuGroup>
              <ContextMenuLabel>
                {t("presentations.editor.group", { count: target.count })}
              </ContextMenuLabel>
              <ContextMenuItem onClick={onCopy}>
                <Copy />
                {t("presentations.editor.copy")}
                <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
              </ContextMenuItem>
              {paste}
            </ContextMenuGroup>
            <ContextMenuSeparator />
            {history}
          </>
        )}

        <ContextMenuSeparator />
        <ContextMenuItem onClick={onExportPng}>
          <ImageDown />
          {t("presentations.export.png.action")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
