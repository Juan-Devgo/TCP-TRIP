import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";

import { Toggle } from "@/components/ui/toggle";
import { sanitizeRichText } from "@/features/classroom/lib/sanitize";
import { richTextToPlain } from "@/lib/richText";
import { cn } from "@/lib/utils";

/**
 * The formatting the instructions support. `execCommand` is deprecated but
 * still the only built-in way to edit a `contentEditable` — a full editor
 * library would be a large dependency for five buttons.
 */
const COMMANDS = [
  { command: "bold", icon: Bold, labelKey: "teacher.editor.bold" },
  { command: "italic", icon: Italic, labelKey: "teacher.editor.italic" },
  { command: "underline", icon: Underline, labelKey: "teacher.editor.underline" },
  { command: "insertUnorderedList", icon: List, labelKey: "teacher.editor.bullets" },
  { command: "insertOrderedList", icon: ListOrdered, labelKey: "teacher.editor.numbers" },
] as const;

type Command = (typeof COMMANDS)[number]["command"];

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  id?: string;
  /** Sanitized HTML. */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Set<Command>>(new Set());
  const [focused, setFocused] = useState(false);

  // Write external value changes (load, reset) into the DOM — but never the
  // echo of our own typing, which would move the caret to the start.
  useEffect(() => {
    const element = ref.current;
    if (element && element.innerHTML !== value) element.innerHTML = sanitizeRichText(value);
  }, [value]);

  // Toolbar state follows the caret while the editor has focus.
  useEffect(() => {
    if (!focused) return;
    function refresh() {
      setActive(
        new Set(COMMANDS.map((item) => item.command).filter((cmd) => document.queryCommandState(cmd))),
      );
    }
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, [focused]);

  function emit() {
    onChange(ref.current?.innerHTML ?? "");
  }

  function run(command: Command) {
    ref.current?.focus();
    document.execCommand(command);
    emit();
  }

  const empty = richTextToPlain(value) === "";

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        disabled && "opacity-50",
      )}
    >
      <div
        role="toolbar"
        aria-label={t("teacher.editor.toolbar")}
        className="flex flex-wrap gap-0.5 border-b border-input p-1"
      >
        {COMMANDS.map(({ command, icon: Icon, labelKey }) => (
          <Toggle
            key={command}
            size="sm"
            disabled={disabled}
            pressed={active.has(command)}
            aria-label={t(labelKey)}
            // Keep the selection in the editor: a click would blur it first.
            onMouseDown={(event) => event.preventDefault()}
            onPressedChange={() => run(command)}
          >
            <Icon />
          </Toggle>
        ))}
      </div>
      <div className="relative">
        {empty && placeholder && (
          <span className="pointer-events-none absolute top-2 left-3 text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          contentEditable={!disabled}
          suppressContentEditableWarning
          className="min-h-32 px-3 py-2 text-sm outline-none [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-6"
          onInput={emit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            const mod = event.ctrlKey || event.metaKey;
            if (!mod) return;
            const key = event.key.toLowerCase();
            const command: Command | null =
              key === "b" ? "bold" : key === "i" ? "italic" : key === "u" ? "underline" : null;
            if (command) {
              event.preventDefault();
              run(command);
            }
          }}
          onPaste={(event) => {
            // Pasted HTML carries styles and scripts; keep only its text.
            event.preventDefault();
            document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
            emit();
          }}
        />
      </div>
    </div>
  );
}
