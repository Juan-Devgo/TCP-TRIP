import { useTranslation } from "react-i18next";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpToLine,
  Circle,
  Copy,
  ClipboardPaste,
  CopyPlus,
  Eraser,
  FileDown,
  FilePlus,
  ImagePlus,
  Lock,
  LockOpen,
  Minus,
  MonitorPlay,
  PaintBucket,
  Plus,
  Ratio,
  Redo2,
  Save,
  Send,
  Square,
  Table as TableIcon,
  Trash2,
  Triangle,
  Type,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Tip } from "@/features/presentation-editor/components/Tip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAX_SLIDES,
  PRESENTATION_CANVASES,
  SHAPE_KINDS,
  SLIDE_BACKGROUND_TOKENS,
  type PresentationCanvas,
  type PresentationSlide,
  type PresentationStatus,
  type ShapeKind,
} from "@/lib/presentations/contract";

/** The icon each figure gets in the Insert menu. */
const SHAPE_ICONS: Record<ShapeKind, React.ComponentType> = {
  rect: Square,
  ellipse: Circle,
  triangle: Triangle,
  line: Minus,
  arrow: ArrowRight,
};

/**
 * The slides bar: everything that acts on the deck, on one full-width row.
 *
 * The slide picker is a plain list with no thumbnails on purpose — the rail of
 * previews used to be the way around a deck, and at forty slides it was a
 * scrolling column that pushed the canvas off the screen. "Slide 3" is what
 * a teacher actually reads.
 *
 * The menus sit on the right, beside undo and redo, and follow the convention
 * every teacher already knows from a word processor (File / Insert / Edit /
 * View) — View holds what changes how the board looks rather than what is on
 * it: its size and the slide's background. Nothing here needs discovering:
 * everything on the bar is also reachable from a menu, and the menus carry the
 * keyboard shortcuts.
 */
export function SlidesToolbar({
  slides,
  selectedSlideId,
  status,
  dirty,
  busy,
  hasSelection,
  locked,
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  slideEmpty,
  canvas,
  background,
  exporting,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onSave,
  onSubmit,
  onWithdraw,
  onPresent,
  onNew,
  onExportPdf,
  onInsertText,
  onInsertImage,
  onInsertTable,
  onInsertShape,
  onUndo,
  onRedo,
  onDuplicateElement,
  onDeleteElement,
  onRestack,
  onToggleLock,
  onCopy,
  onPaste,
  onClearSlide,
  onCanvas,
  onBackground,
}: {
  slides: readonly PresentationSlide[];
  selectedSlideId: string;
  /** `null` until the draft has been saved once. */
  status: PresentationStatus | null;
  dirty: boolean;
  busy: boolean;
  /** Whether an element is selected — half of the Edit menu needs one. */
  hasSelection: boolean;
  locked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Something is selected — one element or a group. */
  canCopy: boolean;
  /** The editor's clipboard holds something. */
  canPaste: boolean;
  slideEmpty: boolean;
  canvas: PresentationCanvas;
  /** The selected slide's background token; `undefined` is the theme default. */
  background: string | undefined;
  /** An export is being drawn — a second one would race it. */
  exporting: boolean;
  onSelectSlide: (id: string) => void;
  onAddSlide: () => void;
  onDuplicateSlide: () => void;
  onDeleteSlide: () => void;
  onSave: () => void;
  onSubmit: () => void;
  onWithdraw: () => void;
  onPresent: () => void;
  onNew: () => void;
  onExportPdf: () => void;
  onInsertText: () => void;
  onInsertImage: () => void;
  onInsertTable: () => void;
  onInsertShape: (kind: ShapeKind) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicateElement: () => void;
  onDeleteElement: () => void;
  onRestack: (where: "front" | "back") => void;
  onToggleLock: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onClearSlide: () => void;
  onCanvas: (value: PresentationCanvas) => void;
  onBackground: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const full = slides.length >= MAX_SLIDES;
  const index = slides.findIndex((slide) => slide.id === selectedSlideId);

  const options = slides.map((slide, position) => ({
    value: slide.id,
    // A slide is named by its place in the deck, never by the author: the
    // name cannot drift from the order, and there is nothing to keep in sync.
    label: t("presentations.editor.slideName", { number: position + 1 }),
  }));

  return (
    <div className="border-border flex w-full flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5">
      <Select
        items={options}
        value={selectedSlideId}
        onValueChange={(next) => onSelectSlide(String(next))}
      >
        {/* The tooltip composes with the *trigger*, not with the select root:
            the root renders nothing, so it has no props to merge. */}
        <Tip
          label={t("presentations.editor.tips.slidePicker", {
            position: index + 1,
            count: slides.length,
          })}
        >
          <SelectTrigger size="sm" className="w-56">
            <SelectValue />
          </SelectTrigger>
        </Tip>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Tip label={t("presentations.editor.tips.addSlide")}>
        <Button
          size="icon"
          variant="outline"
          className="size-8"
          disabled={full}
          aria-label={t("presentations.editor.addSlide")}
          onClick={onAddSlide}
        >
          <Plus />
        </Button>
      </Tip>

      <Tip label={t("presentations.editor.tips.deleteSlide")}>
        <Button
          size="icon"
          variant="destructive"
          className="size-8"
          aria-label={t("presentations.editor.deleteSlide")}
          onClick={onDeleteSlide}
        >
          <Trash2 />
        </Button>
      </Tip>

      <div className="ml-auto flex items-center gap-1">
        <Menubar className="border-none">
          <MenubarMenu>
            <MenubarTrigger>{t("presentations.editor.menus.file")}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem disabled={busy} onClick={onNew}>
                <FilePlus />
                {t("presentations.editor.newPresentation")}
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem disabled={busy || !dirty} onClick={onSave}>
                <Save />
                {t(dirty ? "presentations.actions.save" : "presentations.actions.saved")}
                <MenubarShortcut>Ctrl+S</MenubarShortcut>
              </MenubarItem>
              {/* Submitting needs something saved to submit, and a state the
                  server will accept — the same guard as the query. */}
              {status !== null && status !== "pending" && (
                <MenubarItem disabled={busy} onClick={onSubmit}>
                  <Send />
                  {t(
                    status === "published"
                      ? "presentations.actions.submitUpdate"
                      : "presentations.actions.submit",
                  )}
                </MenubarItem>
              )}
              {(status === "pending" || status === "published") && (
                <MenubarItem
                  disabled={busy}
                  variant={status === "published" ? "destructive" : "default"}
                  onClick={onWithdraw}
                >
                  {t(
                    status === "pending"
                      ? "presentations.actions.cancelSubmission"
                      : "presentations.actions.unpublish",
                  )}
                </MenubarItem>
              )}
              <MenubarSeparator />
              <MenubarItem disabled={exporting || slides.length === 0} onClick={onExportPdf}>
                <FileDown />
                {t("presentations.export.pdf.action")}
              </MenubarItem>
              <MenubarItem onClick={onPresent}>
                <MonitorPlay />
                {t("presentations.actions.present")}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>{t("presentations.editor.menus.insert")}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={onInsertText}>
                <Type />
                {t("presentations.editor.addText")}
              </MenubarItem>
              <MenubarItem onClick={onInsertImage}>
                <ImagePlus />
                {t("presentations.editor.addImage")}
              </MenubarItem>
              <MenubarItem onClick={onInsertTable}>
                <TableIcon />
                {t("presentations.editor.addTable")}
              </MenubarItem>
              <MenubarSub>
                <MenubarSubTrigger>
                  {t("presentations.editor.addShape")}
                </MenubarSubTrigger>
                <MenubarSubContent>
                  {SHAPE_KINDS.map((kind) => {
                    const Icon = SHAPE_ICONS[kind];
                    return (
                      <MenubarItem key={kind} onClick={() => onInsertShape(kind)}>
                        <Icon />
                        {t(`presentations.editor.shapes.${kind}`)}
                      </MenubarItem>
                    );
                  })}
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>{t("presentations.editor.menus.edit")}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem disabled={!canUndo} onClick={onUndo}>
                <Undo2 />
                {t("presentations.editor.undo")}
                <MenubarShortcut>Ctrl+Z</MenubarShortcut>
              </MenubarItem>
              <MenubarItem disabled={!canRedo} onClick={onRedo}>
                <Redo2 />
                {t("presentations.editor.redo")}
                <MenubarShortcut>Ctrl+Shift+Z</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem disabled={!canCopy} onClick={onCopy}>
                <Copy />
                {t("presentations.editor.copy")}
                <MenubarShortcut>Ctrl+C</MenubarShortcut>
              </MenubarItem>
              <MenubarItem disabled={!canPaste} onClick={onPaste}>
                <ClipboardPaste />
                {t("presentations.editor.paste")}
                <MenubarShortcut>Ctrl+V</MenubarShortcut>
              </MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={onDuplicateElement}>
                <CopyPlus />
                {t("presentations.editor.duplicateElement")}
              </MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={() => onRestack("front")}>
                <ArrowUpToLine />
                {t("presentations.editor.bringToFront")}
              </MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={() => onRestack("back")}>
                <ArrowDownToLine />
                {t("presentations.editor.sendToBack")}
              </MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={onToggleLock}>
                {locked ? <Lock /> : <LockOpen />}
                {t(locked ? "presentations.editor.unlock" : "presentations.editor.lock")}
              </MenubarItem>
              <MenubarItem
                disabled={!hasSelection}
                variant="destructive"
                onClick={onDeleteElement}
              >
                <Trash2 />
                {t("presentations.editor.deleteElement")}
                <MenubarShortcut>Supr</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem disabled={full} onClick={onDuplicateSlide}>
                <CopyPlus />
                {t("presentations.editor.duplicateSlide")}
              </MenubarItem>
              <MenubarItem disabled={slideEmpty} variant="destructive" onClick={onClearSlide}>
                <Eraser />
                {t("presentations.editor.clearSlide")}
              </MenubarItem>
              <MenubarItem variant="destructive" onClick={onDeleteSlide}>
                <Trash2 />
                {t("presentations.editor.deleteSlide")}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>{t("presentations.editor.menus.view")}</MenubarTrigger>
            <MenubarContent>
              <MenubarSub>
                <MenubarSubTrigger>
                  <Ratio />
                  {t("presentations.editor.boardSize")}
                </MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarRadioGroup
                    value={`${canvas.width}x${canvas.height}`}
                    onValueChange={(next) => {
                      const preset = PRESENTATION_CANVASES.find(
                        (candidate) =>
                          `${candidate.width}x${candidate.height}` === String(next),
                      );
                      if (preset) onCanvas({ ...preset });
                    }}
                  >
                    {PRESENTATION_CANVASES.map((preset) => (
                      <MenubarRadioItem
                        key={`${preset.width}x${preset.height}`}
                        value={`${preset.width}x${preset.height}`}
                      >
                        {preset.width}×{preset.height}
                      </MenubarRadioItem>
                    ))}
                  </MenubarRadioGroup>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSub>
                <MenubarSubTrigger>
                  <PaintBucket />
                  {t("presentations.editor.slideBackground")}
                </MenubarSubTrigger>
                <MenubarSubContent>
                  {/* "" is the theme default: the slide stores no background. */}
                  <MenubarRadioGroup
                    value={background ?? ""}
                    onValueChange={(next) =>
                      onBackground(String(next) === "" ? null : String(next))
                    }
                  >
                    <MenubarRadioItem value="">
                      {t("presentations.editor.backgroundDefault")}
                    </MenubarRadioItem>
                    {SLIDE_BACKGROUND_TOKENS.map((token) => (
                      <MenubarRadioItem key={token} value={token}>
                        {t(`presentations.tokens.${token}`)}
                      </MenubarRadioItem>
                    ))}
                  </MenubarRadioGroup>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <Tip label={t("presentations.editor.tips.undo")}>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={!canUndo}
            aria-label={t("presentations.editor.undo")}
            onClick={onUndo}
          >
            <Undo2 />
          </Button>
        </Tip>
        <Tip label={t("presentations.editor.tips.redo")}>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={!canRedo}
            aria-label={t("presentations.editor.redo")}
            onClick={onRedo}
          >
            <Redo2 />
          </Button>
        </Tip>

        <Tip label={t("presentations.editor.tips.present")}>
          <Button size="sm" onClick={onPresent}>
            <MonitorPlay />
            {t("presentations.editor.present")}
          </Button>
        </Tip>
      </div>
    </div>
  );
}
