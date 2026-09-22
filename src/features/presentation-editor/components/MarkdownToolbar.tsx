import { useTranslation } from "react-i18next";
import {
  Bold,
  Code,
  Eye,
  EyeOff,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Strikethrough,
  Table as TableIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tip } from "@/features/presentation-editor/components/Tip";
import {
  MARKDOWN_SNIPPETS,
  type MarkdownSnippet,
} from "@/features/presentation-editor/lib/markdownSnippets";

const ICONS: Record<MarkdownSnippet, React.ComponentType> = {
  bold: Bold,
  italic: Italic,
  heading: Heading2,
  strikethrough: Strikethrough,
  unorderedList: List,
  orderedList: ListOrdered,
  checklist: ListChecks,
  link: LinkIcon,
  image: ImageIcon,
  table: TableIcon,
  code: Code,
  quote: Quote,
};

/**
 * The markdown bar: twelve buttons that insert a piece of structure, and the
 * preview switch.
 *
 * Every button **inserts**, it never formats: the author keeps writing plain
 * markdown, which is the point of the mode — the file stays readable, diffable
 * and pasteable somewhere else. The caret arithmetic lives in
 * `lib/markdownSnippets.ts`; this component only reads the textarea's selection
 * and hands it over.
 *
 * The order is the order a teacher looks for them (emphasis, headings, lists,
 * links, blocks), and it is fixed by `MARKDOWN_SNIPPETS`, so adding a snippet
 * puts a button here with no layout decision to make.
 */
export function MarkdownToolbar({
  preview,
  onInsert,
  onTogglePreview,
}: {
  preview: boolean;
  onInsert: (snippet: MarkdownSnippet) => void;
  onTogglePreview: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="border-border flex w-full flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5">
      {MARKDOWN_SNIPPETS.map((snippet, index) => {
        const Icon = ICONS[snippet];
        const label = t(`presentations.editor.snippets.${snippet}`);

        return (
          <div key={snippet} className="flex items-center gap-1">
            {/* Emphasis, then blocks, then links: a rule between the groups. */}
            {(index === 4 || index === 7) && (
              <Separator orientation="vertical" className="mx-1 h-5" />
            )}
            <Tip label={t(`presentations.editor.snippetTips.${snippet}`)}>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label={label}
                onClick={() => onInsert(snippet)}
              >
                <Icon />
              </Button>
            </Tip>
          </div>
        );
      })}

      <div className="ml-auto">
        <Tip label={t("presentations.editor.tips.preview")}>
          <Button
            size="sm"
            variant={preview ? "default" : "outline"}
            onClick={onTogglePreview}
          >
            {preview ? <EyeOff /> : <Eye />}
            {t("presentations.editor.preview")}
          </Button>
        </Tip>
      </div>
    </div>
  );
}
