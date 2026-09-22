import { useTranslation } from "react-i18next";

import { Markdown } from "@/components/common/Markdown";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MARKDOWN_LENGTH } from "@/lib/presentations/contract";
import { cn } from "@/lib/utils";

/**
 * The markdown mode's writing surface: a page, not a form field.
 *
 * It is deliberately plain — one column, generous line height, no chrome — the
 * way a blog editor is, because this mode exists for the half of a teacher's
 * material that is prose rather than a projected slide. The preview is the
 * **same renderer the student gets** (`Markdown`), never a second one, so what
 * is written here cannot look different once it is published.
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

  return (
    <div className={cn("grid gap-4", preview && "lg:grid-cols-2")}>
      <div className="bg-card border-border rounded-lg border px-5 py-4 shadow-sm">
        <Textarea
          ref={textareaRef}
          value={value}
          maxLength={MAX_MARKDOWN_LENGTH}
          aria-label={t("presentations.editor.markdown")}
          placeholder={t("presentations.editor.markdownPlaceholder")}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
          className="min-h-[60vh] resize-none border-none bg-transparent px-0 py-0 text-base leading-relaxed shadow-none focus-visible:ring-0 md:text-base"
        />
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
