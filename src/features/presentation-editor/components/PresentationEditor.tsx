import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { PresentationPlayer } from "@/components/common/PresentationPlayer";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CanvasContextMenu,
  type ContextTarget,
} from "@/features/presentation-editor/components/CanvasContextMenu";
import { DiscardChangesDialog } from "@/features/presentation-editor/components/DiscardChangesDialog";
import { EditorTopBar } from "@/features/presentation-editor/components/EditorTopBar";
import {
  ExportThemeDialog,
  type ExportRequest,
} from "@/features/presentation-editor/components/ExportThemeDialog";
import { ElementInspector } from "@/features/presentation-editor/components/ElementInspector";
import { ImageLibraryDialog } from "@/features/presentation-editor/components/ImageLibraryDialog";
import { MarkdownToolbar } from "@/features/presentation-editor/components/MarkdownToolbar";
import { MarkdownWriter } from "@/features/presentation-editor/components/MarkdownWriter";
import { NotesPanel } from "@/features/presentation-editor/components/NotesPanel";
import { PresentationEditorActions } from "@/features/presentation-editor/components/PresentationEditorActions";
import { PresentationStatusBadge } from "@/features/presentation-editor/components/PresentationStatusBadge";
import { SlideCanvas } from "@/features/presentation-editor/components/SlideCanvas";
import { SlidesToolbar } from "@/features/presentation-editor/components/SlidesToolbar";
import {
  canRedo,
  canUndo,
  editorReducer,
  emptyDocument,
  initEditor,
  PASTE_OFFSET,
  selectedElement,
  selectedSlide,
} from "@/features/presentation-editor/lib/editorState";
import {
  buildSlidesPdf,
  exportFilename,
} from "@/features/presentation-editor/lib/exportFiles";
import {
  insertSnippet,
  type MarkdownSnippet,
} from "@/features/presentation-editor/lib/markdownSnippets";
import {
  requestNewPresentation,
  useNewPresentationRequests,
} from "@/features/presentation-editor/lib/newPresentation";
import { dataUrlToBlob, renderSlides } from "@/features/presentation-editor/lib/renderSlides";
import type { PaintTheme } from "@/features/presentation-editor/lib/themeColors";
import { refreshTheoryMenu } from "@/hooks/useTheoryMenu";
import { downloadBlob } from "@/lib/pdf/exercisePdf";
import {
  MAX_MARKDOWN_LENGTH,
  type PresentationDocument,
  type PresentationElement,
  type PresentationMode,
  type ShapeKind,
} from "@/lib/presentations/contract";
import {
  deleteAsset,
  listAssets,
  PresentationApiError,
  savePresentation,
  submitPresentation,
  uploadAsset,
  withdrawPresentation,
  type PresentationAsset,
  type SavedPresentation,
} from "@/services/presentations";

/** Where a key press is typing, Ctrl+C and Ctrl+V belong to the text. */
function isTyping(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

/** What Insert ▸ Table starts from. Rows and columns are editable after. */
const TABLE_ROWS = 3;
const TABLE_COLUMNS = 2;

/** Quiet time after the last edit before autosave writes it. */
const AUTOSAVE_DELAY = 2000;

const NEW_PRESENTATION_PATH = "/teacher/presentations/new";

/**
 * The teacher's presentation editor, as a page.
 *
 * A draft opened from "Mis Presentaciones" is never replaced in place — its
 * URL names it. There, File ▸ New opens the New tab instead. The New tab's
 * editor starts over on every request (`newPresentation.ts`), from wherever
 * it came, after asking if what it holds has not been saved.
 */
export function PresentationEditor({
  draft,
  onSaved,
}: {
  /** An existing draft to edit; absent means a new presentation. */
  draft?: SavedPresentation;
  /** Lets the surrounding list refresh after a save, submit or withdraw. */
  onSaved?: (saved: SavedPresentation) => void;
}) {
  const navigate = useNavigate();
  const requests = useNewPresentationRequests();
  const [generation, setGeneration] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const seen = useRef(requests);
  const dirty = useRef(false);

  useEffect(() => {
    if (draft || requests === seen.current) return;
    seen.current = requests;
    if (dirty.current) setConfirming(true);
    else setGeneration((current) => current + 1);
  }, [draft, requests]);

  if (draft) {
    return (
      <Editor
        draft={draft}
        {...(onSaved ? { onSaved } : {})}
        onNew={() => {
          requestNewPresentation();
          navigate(NEW_PRESENTATION_PATH);
        }}
      />
    );
  }

  return (
    <>
      <Editor
        key={generation}
        {...(onSaved ? { onSaved } : {})}
        onDirty={(value) => {
          dirty.current = value;
        }}
        onNew={requestNewPresentation}
      />
      <DiscardChangesDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onDiscard={() => {
          setConfirming(false);
          dirty.current = false;
          setGeneration((current) => current + 1);
        }}
      />
    </>
  );
}

/**
 * The teacher's presentation editor.
 *
 * Draft state is **local** (`useReducer` over the pure `editorState`) and only
 * becomes server state when it is saved — the same split the rest of the app
 * uses: a protocol under construction lives in the component, a saved one lives
 * in the database. Submitting for review is a deliberate act. Saving is not:
 * once the presentation has a name of its own, every edit is written a couple
 * of seconds after typing stops. Until then nothing is stored — an untitled
 * scratch deck should not fill "Mis Presentaciones" — and the top bar says
 * so. Autosave also pauses while the presentation waits for review: approving
 * copies the draft row, so a silent save there would change what the
 * administrator approves.
 *
 * The screen is four rows, in the order a teacher uses them: what this is
 * called, where it stands and how it is being written (`EditorTopBar`), one full-width bar of
 * everything that acts on it, the thing itself (a Konva canvas or a markdown
 * page), and the author's private notes.
 *
 * Both modes are edited in the same document. Switching tabs changes what is on
 * screen, not what is stored — a deck written as markdown keeps its slides and
 * the other way round, because nothing converts between them.
 */
function Editor({
  draft,
  onSaved,
  onNew,
  onDirty,
}: {
  draft?: SavedPresentation;
  onSaved?: (saved: SavedPresentation) => void;
  /** File ▸ New presentation. */
  onNew: () => void;
  /** Reports unsaved work, so starting over can ask first. */
  onDirty?: (dirty: boolean) => void;
}) {
  const { t, i18n } = useTranslation();

  const [state, dispatch] = useReducer(
    editorReducer,
    draft?.document ?? emptyDocument(t("presentations.editor.untitled"), crypto.randomUUID()),
    initEditor,
  );

  /** What the server knows. `null` until the first save. */
  const [saved, setSaved] = useState<SavedPresentation | null>(draft ?? null);
  const [assets, setAssets] = useState<PresentationAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [library, setLibrary] = useState(false);
  const [preview, setPreview] = useState(true);
  const [exportRequest, setExportRequest] = useState<ExportRequest | null>(null);
  const [exporting, setExporting] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  /** The document an autosave failed on: not retried until it changes. */
  const autosaveFailed = useRef<PresentationDocument | null>(null);
  const markdown = useRef<HTMLTextAreaElement>(null);
  /**
   * The canvas multi-selection, tagged with its slide. It is a selection, not
   * an edit, so it stays out of the reducer and its history.
   */
  const [grouping, setGrouping] = useState<{ slideId: string; ids: readonly string[] }>({
    slideId: "",
    ids: [],
  });
  /**
   * Copied elements. In memory and per editor on purpose: an element means
   * nothing outside a presentation, and pasting it into a text field as JSON
   * would help nobody.
   */
  const [clipboard, setClipboard] = useState<readonly PresentationElement[]>([]);

  const slide = selectedSlide(state);
  const element = selectedElement(state);

  // Only while it is still true: on its own slide, with nothing selected
  // singly, and only the members that still exist (undo can remove them).
  const group = useMemo(() => {
    if (!slide || grouping.slideId !== slide.id || state.selectedElementId !== null) {
      return [];
    }
    const members = grouping.ids.filter((id) =>
      slide.elements.some((candidate) => candidate.id === id),
    );
    return members.length > 1 ? members : [];
  }, [grouping, slide, state.selectedElementId]);

  const contextTarget: ContextTarget =
    group.length > 0
      ? { kind: "group", count: group.length }
      : element
        ? { kind: "element", locked: element.locked === true }
        : { kind: "board" };

  // The images belong to the saved presentation, so they are loaded once it
  // has an id — and reloaded if the editor is pointed at another draft.
  useEffect(() => {
    const id = saved?.id;
    if (!id) {
      setAssets([]);
      return;
    }

    let cancelled = false;
    listAssets(id)
      .then((list) => {
        if (!cancelled) setAssets(list);
      })
      .catch((error: unknown) => {
        console.error("Could not load the presentation images", error);
      });

    return () => {
      cancelled = true;
    };
  }, [saved?.id]);

  /** Every failure the teacher can act on becomes the same kind of toast. */
  const report = useCallback(
    (title: string, error: unknown) => {
      console.error(title, error);

      const key =
        error instanceof PresentationApiError
          ? error.isUnauthenticated
            ? "presentations.errors.signedOut"
            : error.isForbidden
              ? "presentations.errors.notTeacher"
              : error.isConflict
                ? "presentations.errors.conflict"
                : "presentations.errors.generic"
          : "presentations.errors.generic";

      toast.add({ title, type: "error", description: t(key) });
    },
    [t],
  );

  /**
   * Saves what is on screen. An autosave is `quiet`: it does not announce
   * success (the status bar already shows it), and a failure is reported once
   * and not retried until the document changes — not every two seconds.
   */
  async function save({ quiet = false }: { quiet?: boolean } = {}): Promise<SavedPresentation | null> {
    const title = t("presentations.toast.save");
    const document = state.document;
    setBusy(true);
    try {
      const result = await savePresentation(document, saved?.id);
      setSaved(result);
      autosaveFailed.current = null;
      dispatch({ type: "saved", document });
      onSaved?.(result);
      if (!quiet) {
        toast.add({ title, type: "success", description: t("presentations.toast.savedBody") });
      }
      return result;
    } catch (error) {
      if (quiet) autosaveFailed.current = document;
      report(title, error);
      return null;
    } finally {
      setBusy(false);
    }
  }

  /**
   * Whether the title is the author's. The placeholder name is compared in
   * every language, because a deck started in Spanish keeps its Spanish
   * placeholder after the interface switches to English.
   */
  const named = useMemo(() => {
    const title = state.document.title.trim();
    const placeholders = Object.keys(i18n.options.resources ?? {}).map((language) =>
      i18n.getFixedT(language)("presentations.editor.untitled"),
    );
    return title !== "" && !placeholders.includes(title);
  }, [state.document.title, i18n]);

  const autosave = !named ? "off" : saved?.status === "pending" ? "paused" : "on";

  useEffect(() => {
    if (
      autosave !== "on" ||
      !state.dirty ||
      busy ||
      autosaveFailed.current === state.document
    ) {
      return;
    }
    // `save` reads the render this effect ran in, which holds this document.
    const timer = window.setTimeout(() => void save({ quiet: true }), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [autosave, state.dirty, state.document, busy]);

  useEffect(() => {
    onDirty?.(state.dirty);
  }, [onDirty, state.dirty]);

  /**
   * Draws the current slide (PNG) or the deck (PDF) in the palette the author
   * picked, and hands it to the browser as a download.
   */
  async function runExport(theme: PaintTheme) {
    if (!exportRequest) return;
    const { kind } = exportRequest;
    const title = t(`presentations.export.${kind}.title`);
    const { canvas, slides } = state.document;

    setExporting(true);
    try {
      if (kind === "png") {
        if (!slide) return;
        const [image] = await renderSlides([slide], canvas, theme);
        if (!image) return;
        const number = slides.findIndex((candidate) => candidate.id === slide.id) + 1;
        downloadBlob(
          await dataUrlToBlob(image),
          exportFilename(state.document.title, "png", `slide-${number}`),
        );
      } else {
        const images = await renderSlides(slides, canvas, theme);
        const pdf = await buildSlidesPdf({ title: state.document.title, canvas, images });
        downloadBlob(pdf, exportFilename(state.document.title, "pdf"));
      }
      setExportRequest(null);
    } catch (error) {
      report(title, error);
    } finally {
      setExporting(false);
    }
  }

  function downloadMarkdown() {
    downloadBlob(
      new Blob([state.document.markdown], { type: "text/markdown;charset=utf-8" }),
      exportFilename(state.document.title, "md"),
    );
  }

  /**
   * Replaces the markdown with a file's. It is one undo step, so Ctrl+Z
   * brings back what was written before — which is why it does not ask.
   */
  async function importMarkdown(file: File) {
    const title = t("presentations.toast.importMarkdown");
    try {
      // Windows line endings would show up as stray characters in the
      // faded-markup layer.
      const text = (await file.text()).replace(/\r\n?/g, "\n");
      if (text.length > MAX_MARKDOWN_LENGTH) {
        toast.add({
          title,
          type: "error",
          description: t("presentations.toast.importTooLong", { max: MAX_MARKDOWN_LENGTH }),
        });
        return;
      }

      dispatch({ type: "commit" });
      dispatch({ type: "markdown", value: text });
      dispatch({ type: "commit" });
      toast.add({
        title,
        type: "success",
        description: t("presentations.toast.importedBody", { name: file.name }),
      });
    } catch (error) {
      report(title, error);
    }
  }

  async function submit() {
    const title = t("presentations.toast.submit");

    // Submitting what is on screen: an unsaved edit would otherwise go to
    // review as the previous version, which is the one thing a reviewer must
    // not be handed.
    const current = state.dirty ? await save({ quiet: true }) : saved;
    if (!current) return;

    setBusy(true);
    try {
      const result = await submitPresentation(current.id);
      setSaved(result);
      onSaved?.(result);
      toast.add({
        title,
        type: "success",
        description: t("presentations.toast.submittedBody"),
      });
    } catch (error) {
      report(title, error);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!saved) return;
    const title = t("presentations.toast.withdraw");

    setBusy(true);
    try {
      const result = await withdrawPresentation(saved.id);
      setSaved(result);
      onSaved?.(result);
      // It has just left Theory, so the entry an administrator filed it under
      // is no longer visible — the sidebar has to stop offering it now.
      void refreshTheoryMenu();
      toast.add({
        title,
        type: "success",
        description: t("presentations.toast.withdrawnBody"),
      });
    } catch (error) {
      report(title, error);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    if (!saved) return;
    const title = t("presentations.toast.upload");

    setUploading(true);
    try {
      const asset = await uploadAsset(saved.id, file);
      setAssets((current) => [asset, ...current]);
    } catch (error) {
      report(title, error);
    } finally {
      setUploading(false);
    }
  }

  async function removeAsset(asset: PresentationAsset) {
    if (!saved) return;
    const title = t("presentations.toast.deleteImage");

    try {
      await deleteAsset(saved.id, asset.id);
      setAssets((current) => current.filter((candidate) => candidate.id !== asset.id));
    } catch (error) {
      report(title, error);
    }
  }

  /** A single selection always replaces the group. */
  function select(id: string | null) {
    setGrouping({ slideId: "", ids: [] });
    dispatch({ type: "selectElement", id });
  }

  function selectGroup(ids: readonly string[]) {
    setGrouping({ slideId: state.selectedSlideId, ids });
    dispatch({ type: "selectElement", id: null });
  }

  function copy() {
    const copied =
      group.length > 0
        ? (slide?.elements.filter((candidate) => group.includes(candidate.id)) ?? [])
        : element
          ? [element]
          : [];
    if (copied.length > 0) setClipboard(copied);
  }

  /**
   * Pastes onto the slide being edited — which is how an element moves to
   * another slide. The clipboard then follows the copies, so pasting again
   * cascades instead of stacking on the same spot.
   */
  function paste() {
    if (clipboard.length === 0) return;

    const copies = clipboard.map((source) => ({ ...source, id: crypto.randomUUID() }));
    dispatch({ type: "pasteElements", elements: copies });
    setClipboard(
      copies.map((copied) => ({
        ...copied,
        x: copied.x + PASTE_OFFSET,
        y: copied.y + PASTE_OFFSET,
      })),
    );
    if (copies.length > 1) selectGroup(copies.map((copied) => copied.id));
  }

  function duplicate() {
    if (element) {
      dispatch({ type: "duplicateElement", id: element.id, newId: crypto.randomUUID() });
    }
  }

  function restack(where: "front" | "back") {
    if (element) {
      dispatch({ type: where === "front" ? "bringToFront" : "sendToBack", id: element.id });
    }
  }

  /**
   * A toolbar button inserts markdown **where the caret is**, then puts the
   * caret back on the piece the author has to replace — so the button is a
   * shortcut for typing and not a jump to the end of the document.
   */
  function insert(snippet: MarkdownSnippet) {
    const node = markdown.current;
    const value = state.document.markdown;
    const selection = node
      ? { start: node.selectionStart, end: node.selectionEnd }
      : { start: value.length, end: value.length };

    const edit = insertSnippet(value, selection, snippet);
    dispatch({ type: "markdown", value: edit.value });
    // Each button press is its own undo step, whatever was typed before it.
    dispatch({ type: "commit" });

    // After React has written the new value, or the selection would be clamped
    // against the old one.
    requestAnimationFrame(() => {
      node?.focus();
      node?.setSelectionRange(edit.selection.start, edit.selection.end);
    });
  }

  /**
   * Undo and redo, bound to this subtree rather than to `document`: inactive
   * tabs stay mounted in this app, so a global listener here would undo edits
   * in whatever tab is actually on screen.
   */
  function onKeyDown(event: React.KeyboardEvent) {
    if (!event.ctrlKey && !event.metaKey) return;

    const key = event.key.toLowerCase();

    // Copy and paste act on canvas elements only while nothing is being typed:
    // in a field they are the browser's, on the text.
    if ((key === "c" || key === "v") && !event.shiftKey && !event.altKey) {
      if (state.document.mode !== "slides" || isTyping(event.target)) return;
      event.preventDefault();
      if (key === "c") copy();
      else paste();
      return;
    }

    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      dispatch({ type: "undo" });
      return;
    }

    if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault();
      dispatch({ type: "redo" });
    }
  }

  return (
    <TooltipProvider delay={300}>
      <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
        <PresentationEditorActions
          status={saved?.status ?? null}
          dirty={state.dirty}
          busy={busy}
          canPresent={state.document.slides.length > 0}
          onSave={() => void save()}
          onSubmit={() => void submit()}
          onWithdraw={() => void withdraw()}
          onPresent={() => setPresenting(true)}
        />

        <Tabs
          value={state.document.mode}
          onValueChange={(next) =>
            dispatch({ type: "mode", value: String(next) as PresentationMode })
          }
        >
          <EditorTopBar
            title={state.document.title}
            topic={state.document.topic}
            onTitle={(value) => {
              setPromptDismissed(true);
              dispatch({ type: "title", value });
            }}
            onTopic={(value) => dispatch({ type: "topic", value })}
            onCommit={() => dispatch({ type: "commit" })}
            promptName={!named && !promptDismissed}
            onDismissPrompt={() => setPromptDismissed(true)}
            status={
              <PresentationStatusBadge saved={saved} dirty={state.dirty} autosave={autosave} />
            }
          />

          <TabsContent value="slides" className="flex flex-col gap-3">
            <SlidesToolbar
              slides={state.document.slides}
              selectedSlideId={state.selectedSlideId}
              status={saved?.status ?? null}
              dirty={state.dirty}
              busy={busy}
              hasSelection={element !== undefined}
              locked={element?.locked === true}
              canUndo={canUndo(state)}
              canRedo={canRedo(state)}
              canCopy={element !== undefined || group.length > 0}
              canPaste={clipboard.length > 0}
              slideEmpty={(slide?.elements.length ?? 0) === 0}
              canvas={state.document.canvas}
              background={slide?.background}
              exporting={exporting}
              onSelectSlide={(id) => dispatch({ type: "selectSlide", id })}
              onAddSlide={() => dispatch({ type: "addSlide", id: crypto.randomUUID() })}
              onDuplicateSlide={() =>
                dispatch({ type: "duplicateSlide", id: state.selectedSlideId })
              }
              onDeleteSlide={() =>
                dispatch({
                  type: "deleteSlide",
                  id: state.selectedSlideId,
                  replacementId: crypto.randomUUID(),
                })
              }
              onSave={() => void save()}
              onSubmit={() => void submit()}
              onWithdraw={() => void withdraw()}
              onPresent={() => setPresenting(true)}
              onNew={onNew}
              onExportPdf={() => setExportRequest({ kind: "pdf" })}
              onInsertText={() =>
                dispatch({
                  type: "addText",
                  id: crypto.randomUUID(),
                  text: t("presentations.editor.newText"),
                })
              }
              onInsertImage={() => setLibrary(true)}
              onInsertTable={() =>
                dispatch({
                  type: "addTable",
                  id: crypto.randomUUID(),
                  rows: TABLE_ROWS,
                  columns: TABLE_COLUMNS,
                })
              }
              onInsertShape={(kind: ShapeKind) =>
                dispatch({ type: "addShape", id: crypto.randomUUID(), kind })
              }
              onUndo={() => dispatch({ type: "undo" })}
              onRedo={() => dispatch({ type: "redo" })}
              onDuplicateElement={duplicate}
              onDeleteElement={() => {
                if (element) dispatch({ type: "deleteElement", id: element.id });
              }}
              onRestack={restack}
              onToggleLock={() => {
                if (element) dispatch({ type: "toggleLock", id: element.id });
              }}
              onCopy={copy}
              onPaste={paste}
              onClearSlide={() => dispatch({ type: "clearSlide" })}
              onCanvas={(value) => dispatch({ type: "canvas", value })}
              onBackground={(value) => dispatch({ type: "slideBackground", value })}
            />

            <div className="flex flex-wrap items-start gap-4 xl:flex-nowrap">
              {slide && (
                <div className="min-w-0 flex-1">
                  <CanvasContextMenu
                    target={contextTarget}
                    canPaste={clipboard.length > 0}
                    canUndo={canUndo(state)}
                    canRedo={canRedo(state)}
                    slideEmpty={slide.elements.length === 0}
                    onCopy={copy}
                    onPaste={paste}
                    onUndo={() => dispatch({ type: "undo" })}
                    onRedo={() => dispatch({ type: "redo" })}
                    onClearSlide={() => dispatch({ type: "clearSlide" })}
                    onDuplicate={duplicate}
                    onRestack={restack}
                    onToggleLock={() => {
                      if (element) dispatch({ type: "toggleLock", id: element.id });
                    }}
                    onDelete={() => {
                      if (element) dispatch({ type: "deleteElement", id: element.id });
                    }}
                    onExportPng={() => setExportRequest({ kind: "png" })}
                  >
                    <SlideCanvas
                      slide={slide}
                      canvas={state.document.canvas}
                      selectedElementId={state.selectedElementId}
                      group={group}
                      onSelect={select}
                      onGroup={selectGroup}
                      onMoveGroup={(moves) => dispatch({ type: "moveElements", moves })}
                      onTransform={(id, next) =>
                        dispatch({ type: "transformElement", id, ...next })
                      }
                      onCommit={() => dispatch({ type: "commit" })}
                      onText={(id, text) => dispatch({ type: "textProps", id, props: { text } })}
                      onCell={(id, row, column, value) =>
                        dispatch({ type: "tableCell", id, row, column, value })
                      }
                      onDelete={(id) => dispatch({ type: "deleteElement", id })}
                    />
                  </CanvasContextMenu>
                </div>
              )}

              {slide && (
                <ElementInspector
                  element={element}
                  groupCount={group.length}
                  onTextProps={(id, props) => dispatch({ type: "textProps", id, props })}
                  onImageProps={(id, props) => dispatch({ type: "imageProps", id, props })}
                  onTableProps={(id, props) => dispatch({ type: "tableProps", id, props })}
                  onTableSize={(id, rows, columns) =>
                    dispatch({ type: "tableSize", id, rows, columns })
                  }
                  onShapeProps={(id, props) => dispatch({ type: "shapeProps", id, props })}
                  onBox={(id, box) => {
                    if (box.x !== undefined || box.y !== undefined) {
                      dispatch({
                        type: "moveElement",
                        id,
                        x: box.x ?? element?.x ?? 0,
                        y: box.y ?? element?.y ?? 0,
                      });
                    }
                    if (box.width !== undefined || box.height !== undefined) {
                      dispatch({
                        type: "resizeElement",
                        id,
                        width: box.width ?? element?.width ?? 0,
                        height: box.height ?? element?.height ?? 0,
                      });
                    }
                  }}
                  onRotate={(id, rotation) => dispatch({ type: "rotateElement", id, rotation })}
                  onToggleLock={(id) => dispatch({ type: "toggleLock", id })}
                  onRestack={(id, where) =>
                    dispatch({ type: where === "front" ? "bringToFront" : "sendToBack", id })
                  }
                  onDelete={(id) => dispatch({ type: "deleteElement", id })}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="markdown" className="flex flex-col gap-3">
            <MarkdownToolbar
              preview={preview}
              onInsert={insert}
              onTogglePreview={() => setPreview((current) => !current)}
              canDownload={state.document.markdown.trim() !== ""}
              onDownload={downloadMarkdown}
              onImport={(file) => void importMarkdown(file)}
            />

            <MarkdownWriter
              value={state.document.markdown}
              preview={preview}
              textareaRef={markdown}
              onChange={(value) => dispatch({ type: "markdown", value })}
              onCommit={() => dispatch({ type: "commit" })}
            />
          </TabsContent>
        </Tabs>

        <NotesPanel
          // A draft stored before notes existed has none: the panel is
          // controlled, so it needs a string either way.
          value={state.document.notes ?? ""}
          onChange={(value) => dispatch({ type: "notes", value })}
          onCommit={() => dispatch({ type: "commit" })}
        />

        <ImageLibraryDialog
          open={library}
          onOpenChange={setLibrary}
          assets={assets}
          disabled={saved === null}
          uploading={uploading}
          onUpload={(file) => void upload(file)}
          onInsert={(asset, width, height) =>
            dispatch({
              type: "addImage",
              id: crypto.randomUUID(),
              assetId: asset.id,
              alt: "",
              width,
              height,
            })
          }
          onDelete={(asset) => void removeAsset(asset)}
        />

        <ExportThemeDialog
          request={exportRequest}
          busy={exporting}
          onOpenChange={(open) => {
            if (!open) setExportRequest(null);
          }}
          onExport={(theme) => void runExport(theme)}
        />

        {presenting && (
          <PresentationPlayer
            document={state.document}
            fullscreen
            // The editor is the author's own draft: their notes are theirs.
            speakerNotes
            onClose={() => setPresenting(false)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
