import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Markdown } from "@/components/common/Markdown";
import { Textarea } from "@/components/ui/textarea";
import { continueList } from "@/features/presentation-editor/lib/markdownSnippets";
import { markdownSyntax } from "@/features/presentation-editor/lib/markdownSyntax";
import { MAX_MARKDOWN_LENGTH } from "@/lib/presentations/contract";
import { cn } from "@/lib/utils";

/**
 * The typography the textarea and the layer drawn over it share. They have to
 * wrap on exactly the same characters, or the faded markup drifts off the
 * letters it belongs to.
 */
const WRITING = "text-base leading-relaxed md:text-base whitespace-pre-wrap break-words";

/**
 * The markdown mode's writing surface: a page, not a form field.
 *
 * It is deliberately plain — one column, generous line height, no chrome — the
 * way a blog editor is, because this mode exists for the half of a teacher's
 * material that is prose rather than a projected slide. The preview is the
 * **same renderer the student gets** (`Markdown`), never a second one, so what
 * is written here cannot look different once it is published.
 *
 * The markup reads fainter than the words (`#`, `-`, `|`, `**` …). A textarea
 * cannot colour part of its text, so its own text is transparent and a
 * layer with the same typography draws it on top; the caret, the
 * selection, spellcheck and IME all stay the textarea's.
 */
export function MarkdownWriter({
  value,
  preview,
  textareaRef,
  onChange,
  onCommit,
}: {
  value: string;
  preview: boolean;
  /** The toolbar inserts at this textarea's selection. */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  /** Typing has stopped — one undo step for the paragraph, not for a letter. */
  onCommit: () => void;
}) {
  const { t } = useTranslation();
  const segments = useMemo(() => markdownSyntax(value), [value]);

  /** Enter inside a list starts the next item; on an empty item it ends the list. */
  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    const node = event.currentTarget;
    const edit = continueList(value, { start: node.selectionStart, end: node.selectionEnd });
    if (!edit || edit.value.length > MAX_MARKDOWN_LENGTH) return;

    event.preventDefault();
    onChange(edit.value);

    // After React has written the new value, or the caret would be clamped
    // against the old one.
    requestAnimationFrame(() => {
      node.setSelectionRange(edit.selection.start, edit.selection.end);
    });
  }

  return (
    <div className={cn("grid gap-4", preview && "lg:grid-cols-2")}>
      <div className="bg-card border-border rounded-lg border px-5 py-4 shadow-sm">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            maxLength={MAX_MARKDOWN_LENGTH}
            aria-label={t("presentations.editor.markdown")}
            placeholder={t("presentations.editor.markdownPlaceholder")}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onCommit}
            className={cn(
              "caret-foreground min-h-[60vh] resize-none rounded-none border-none bg-transparent px-0 py-0 text-transparent shadow-none focus-visible:ring-0",
              WRITING,
            )}
          />

          {/* Drawn over the textarea, not under it: it has no background, so
              the caret and the selection show through, and nothing the
              textarea paints can tint the text. */}
          <div
            aria-hidden
            className={cn("text-foreground pointer-events-none absolute inset-0", WRITING)}
          >
            {segments.map((segment, index) =>
              segment.syntax ? (
                <span key={index} className="opacity-40">
                  {segment.text}
                </span>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </div>
        </div>
      </div>

      {preview && (
        <div className="bg-card border-border rounded-lg border px-5 py-4 shadow-sm">
          {value.trim() === "" ? (
            <p className="text-muted-foreground m-0 text-sm">
              {t("presentations.editor.previewEmpty")}
            </p>
          ) : (
            <Markdown source={value} />
          )}
        </div>
      )}
    </div>
  );
}
