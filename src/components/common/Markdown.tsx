import { useMemo } from "react";

import {
  parseMarkdown,
  type BlockToken,
  type InlineToken,
} from "@/lib/markdown/markdown";
import { cn } from "@/lib/utils";

/**
 * Renders the markdown half of a presentation.
 *
 * Every token becomes a React element — there is **no `dangerouslySetInnerHTML`
 * anywhere**, which is what makes it safe to show one teacher's text to a whole
 * class: a `<script>` in the source is characters on the page, not a script.
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
  const blocks = useMemo(() => parseMarkdown(source), [source]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: BlockToken }) {
  switch (block.kind) {
    case "heading": {
      const Heading = `h${block.level}` as "h1" | "h2" | "h3";
      return (
        <Heading>
          <Inline tokens={block.content} />
        </Heading>
      );
    }

    case "paragraph":
      return (
        <p>
          <Inline tokens={block.content} />
        </p>
      );

    case "list":
      return block.ordered ? (
        <ol>
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline tokens={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul>
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline tokens={item} />
            </li>
          ))}
        </ul>
      );

    case "quote":
      return (
        <blockquote>
          <Inline tokens={block.content} />
        </blockquote>
      );

    case "code":
      return (
        // The horizontal scroll is the block's own, so a long line never makes
        // the page scroll sideways.
        <pre className="overflow-x-auto">
          <code className="font-mono">{block.text}</code>
        </pre>
      );

    case "rule":
      return <hr />;
  }
}

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.kind) {
          case "text":
            return <span key={index}>{token.text}</span>;
          case "strong":
            return <strong key={index}>{token.text}</strong>;
          case "em":
            return <em key={index}>{token.text}</em>;
          case "code":
            return (
              <code key={index} className="font-mono">
                {token.text}
              </code>
            );
          case "link":
            return (
              <a
                key={index}
                href={token.href}
                // The parser already refused anything but http(s)/mailto;
                // these keep the new tab from reaching back into the app.
                target="_blank"
                rel="noopener noreferrer"
              >
                {token.text}
              </a>
            );
        }
      })}
    </>
  );
}
