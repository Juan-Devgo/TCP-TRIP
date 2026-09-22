import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PresentationPlayer } from "@/components/common/PresentationPlayer";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorTopBar } from "@/features/presentation-editor/components/EditorTopBar";
import { ElementInspector } from "@/features/presentation-editor/components/ElementInspector";
import { ImageLibraryDialog } from "@/features/presentation-editor/components/ImageLibraryDialog";
import { MarkdownToolbar } from "@/features/presentation-editor/components/MarkdownToolbar";
import { MarkdownWriter } from "@/features/presentation-editor/components/MarkdownWriter";
import { NotesPanel } from "@/features/presentation-editor/components/NotesPanel";
import { PresentationEditorActions } from "@/features/presentation-editor/components/PresentationEditorActions";
import { PresentationStatusBar } from "@/features/presentation-editor/components/PresentationStatusBar";
import { SlideCanvas } from "@/features/presentation-editor/components/SlideCanvas";
import { SlidesToolbar } from "@/features/presentation-editor/components/SlidesToolbar";
import {
  canRedo,
  canUndo,
  editorReducer,
  emptyDocument,
  initEditor,
  selectedElement,
  selectedSlide,
} from "@/features/presentation-editor/lib/editorState";
import {
  insertSnippet,
  type MarkdownSnippet,
} from "@/features/presentation-editor/lib/markdownSnippets";
import { refreshTheoryMenu } from "@/hooks/useTheoryMenu";
import type { PresentationMode, ShapeKind } from "@/lib/presentations/contract";
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

/** What Insert ▸ Table starts from. Rows and columns are editable after. */
const TABLE_ROWS = 3;
const TABLE_COLUMNS = 2;

/**
 * The teacher's presentation editor.
 *
 * Draft state is **local** (`useReducer` over the pure `editorState`) and only
 * becomes server state when it is saved — the same split the rest of the app
 * uses: a protocol under construction lives in the component, a saved one lives
 * in the database. Nothing here autosaves: a submission for review is a
 * deliberate act, and so is the save before it.
 *
 * The screen is four rows, in the order a teacher uses them: what this is
 * called and how it is being written (`EditorTopBar`), one full-width bar of
 * everything that acts on it, the thing itself (a Konva canvas or a markdown
 * page), and the author's private notes.
 *
 * Both modes are edited in the same document. Switching tabs changes what is on
 * screen, not what is stored — a deck written as markdown keeps its slides and
 * the other way round, because nothing converts between them.
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
  const { t } = useTranslation();

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
  const markdown = useRef<HTMLTextAreaElement>(null);

  const slide = selectedSlide(state);
  const element = selectedElement(state);

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

  async function save(): Promise<SavedPresentation | null> {
    const title = t("presentations.toast.save");
    setBusy(true);
    try {
      const result = await savePresentation(state.document, saved?.id);
      setSaved(result);
      dispatch({ type: "saved" });
      onSaved?.(result);
      toast.add({ title, type: "success", description: t("presentations.toast.savedBody") });
      return result;
    } catch (error) {
      report(title, error);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const title = t("presentations.toast.submit");

    // Submitting what is on screen: an unsaved edit would otherwise go to
    // review as the previous version, which is the one thing a reviewer must
    // not be handed.
    const current = state.dirty ? await save() : saved;
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

        <PresentationStatusBar saved={saved} dirty={state.dirty} />

        <Tabs
          value={state.document.mode}
          onValueChange={(next) =>
            dispatch({ type: "mode", value: String(next) as PresentationMode })
          }
        >
          <EditorTopBar
            title={state.document.title}
            topic={state.document.topic}
            onTitle={(value) => dispatch({ type: "title", value })}
            onTopic={(value) => dispatch({ type: "topic", value })}
            onCommit={() => dispatch({ type: "commit" })}
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
              onDuplicateElement={() => {
                if (element) {
                  dispatch({
                    type: "duplicateElement",
                    id: element.id,
                    newId: crypto.randomUUID(),
                  });
                }
              }}
              onDeleteElement={() => {
                if (element) dispatch({ type: "deleteElement", id: element.id });
              }}
              onRestack={(where) => {
                if (element) {
                  dispatch({
                    type: where === "front" ? "bringToFront" : "sendToBack",
                    id: element.id,
                  });
                }
              }}
              onToggleLock={() => {
                if (element) dispatch({ type: "toggleLock", id: element.id });
              }}
            />

            <div className="flex flex-wrap items-start gap-4 xl:flex-nowrap">
              {slide && (
                <div className="min-w-0 flex-1">
                  <SlideCanvas
                    slide={slide}
                    canvas={state.document.canvas}
                    selectedElementId={state.selectedElementId}
                    onSelect={(id) => dispatch({ type: "selectElement", id })}
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
                </div>
              )}

              {slide && (
                <ElementInspector
                  slide={slide}
                  element={element}
                  canvas={state.document.canvas}
                  onCanvas={(value) => dispatch({ type: "canvas", value })}
                  onSlideTitle={(value) => dispatch({ type: "slideTitle", value })}
                  onSlideNotes={(value) => dispatch({ type: "slideNotes", value })}
                  onSlideBackground={(value) => dispatch({ type: "slideBackground", value })}
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

        {presenting && (
          <PresentationPlayer
            document={state.document}
            fullscreen
            onClose={() => setPresenting(false)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
