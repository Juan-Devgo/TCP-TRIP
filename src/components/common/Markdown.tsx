import MarkdownToJsx, { type MarkdownToJSX } from "markdown-to-jsx/react";
import { useMemo } from "react";

import { highlightCode, type HighlightNode } from "@/lib/highlight";
import { cn } from "@/lib/utils";

/**
 * Renders the markdown half of a presentation.
 *
 * `markdown-to-jsx` turns the source into React elements — there is **no
 * `dangerouslySetInnerHTML` anywhere**, and raw HTML parsing is switched off,
 * so a teacher writing `<script>` gets the characters `<script>` on the page
 * and nothing else. Its built-in sanitizer drops `javascript:` and friends from
 * links and images, which is the one other way a markdown document could run
 * something.
 *
 * It speaks GitHub-flavoured markdown: tables, task lists, strikethrough and
 * images render as what they are, and a backslash before a punctuation mark
 * (`\*`) shows the mark instead of the markup — any other backslash stays.
 *
 * A fenced block tagged with a language (```` ```bash ````) is highlighted by
 * highlight.js (`@/lib/highlight`). Its output is read back into a tree and
 * rendered as React spans, so the no-`innerHTML` rule above still holds. The
 * colours are the `.hljs-*` rules in `globals.css`, drawn from the theme's
 * ink tokens, so a block reads in both themes.
 *
 * The typography comes from the app's typeset styles (`MainLayout` scopes
 * `.typeset .typeset-docs` over the content), so a heading here looks like a
 * heading everywhere else and nothing needs restyling per view.
 */
export function Markdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const options = useMemo<MarkdownToJSX.Options>(
    () => ({
      disableParsingRawHTML: true,
      forceBlock: true,
      wrapper: null,
      overrides: {
        a: {
          // The new tab must not reach back into the app.
          props: { target: "_blank", rel: "noopener noreferrer" },
        },
        img: { props: { loading: "lazy", className: "h-auto max-w-full" } },
        // The horizontal scroll is the block's own, so a long line or a wide
        // table never makes the page scroll sideways.
        pre: { props: { className: "overflow-x-auto" } },
        code: { component: Code },
        table: { component: ScrollingTable },
        // A task list is read, not ticked: the box shows the state it was
        // written with.
        input: { props: { disabled: true } },
      },
    }),
    [],
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        // A task item carries its own checkbox; a bullet in front of it is noise.
        "[&_li:has(>input[type=checkbox])]:list-none",
        className,
      )}
    >
      <MarkdownToJsx options={options}>{source}</MarkdownToJsx>
    </div>
  );
}

function ScrollingTable(props: React.ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  );
}

/**
 * Inline code and code blocks alike. `markdown-to-jsx` tags a fenced block's
 * `code` with `lang-<name>`; anything untagged, or tagged with a language
 * that is not bundled, stays plain.
 */
function Code({ className, children, ...props }: React.ComponentProps<"code">) {
  const language = /(?:^|\s)lang-(\S+)/.exec(className ?? "")?.[1];
  const source = typeof children === "string" ? children : null;

  const nodes = useMemo(
    () => (language && source !== null ? highlightCode(source, language) : null),
    [language, source],
  );

  return (
    <code {...props} className={cn("font-mono", nodes && "hljs", className)}>
      {nodes ? renderHighlight(nodes) : children}
    </code>
  );
}

function renderHighlight(nodes: HighlightNode[]): React.ReactNode[] {
  return nodes.map((node, index) =>
    typeof node === "string" ? (
      node
    ) : (
      <span key={index} className={node.className}>
        {renderHighlight(node.children)}
      </span>
    ),
  );
}
