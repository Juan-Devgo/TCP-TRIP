import { RICH_TEXT_TAGS } from "@/lib/richText";

const ALLOWED = new Set<string>(RICH_TEXT_TAGS);

/**
 * Keeps only the editor's own formatting tags, with no attributes. Stored
 * instructions are fed back into a `contentEditable`, so anything else (a
 * `<script>`, an `onerror`, pasted styles) is dropped before it gets there.
 * Browser-only: it uses the DOM parser.
 */
export function sanitizeRichText(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");

  function clean(node: Node, into: Node): void {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        into.appendChild(doc.createTextNode(child.textContent ?? ""));
      } else if (child instanceof Element) {
        const tag = child.tagName.toLowerCase();
        if (tag === "script" || tag === "style") continue;
        if (ALLOWED.has(tag)) {
          const copy = doc.createElement(tag);
          clean(child, copy);
          into.appendChild(copy);
        } else {
          // Unknown wrapper (`<span style>`, `<a>`): keep the text, drop the tag.
          clean(child, into);
        }
      }
    }
  }

  const out = doc.createElement("div");
  clean(doc.body, out);
  return out.innerHTML;
}
