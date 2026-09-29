import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import diff from "highlight.js/lib/languages/diff";
import dns from "highlight.js/lib/languages/dns";
import go from "highlight.js/lib/languages/go";
import http from "highlight.js/lib/languages/http";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import plaintext from "highlight.js/lib/languages/plaintext";
import powershell from "highlight.js/lib/languages/powershell";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

/**
 * Syntax highlighting for the code blocks of the markdown renderer.
 *
 * Only the **core** of highlight.js is bundled, plus the languages a
 * networking course actually shows: shells and configs (`bash`, `shell`,
 * `powershell`, `ini`, `yaml`, `dns`), protocols on the wire (`http`, `json`,
 * `xml`), and the languages sockets get written in. The full build carries
 * ~190 grammars (~1 MB) that no slide here would use. A fence tagged with a
 * language outside this list renders as plain code — never an error.
 *
 * Aliases come with each grammar (`sh`, `html`, `js`, `ts`, `py`, `yml` …).
 */
const LANGUAGES = {
  bash,
  c,
  cpp,
  diff,
  dns,
  go,
  http,
  ini,
  java,
  javascript,
  json,
  plaintext,
  powershell,
  python,
  rust,
  shell,
  sql,
  typescript,
  xml,
  yaml,
};

for (const [name, grammar] of Object.entries(LANGUAGES)) {
  hljs.registerLanguage(name, grammar);
}

/**
 * Highlighted code as a tree, not as HTML: text, or a span carrying the
 * scope classes highlight.js assigned (`hljs-keyword`, `hljs-title class_` …).
 * The renderer turns it into React elements, so no markup string ever
 * reaches the DOM.
 */
export type HighlightNode = string | { className: string; children: HighlightNode[] };

/** Whether a fence's language tag names a registered grammar or alias. */
export function isHighlightable(language: string): boolean {
  return hljs.getLanguage(language) !== undefined;
}

/**
 * The code as highlighted nodes, or `null` when the language is unknown —
 * the caller then shows it as plain text.
 */
export function highlightCode(code: string, language: string): HighlightNode[] | null {
  if (!isHighlightable(language)) return null;
  const { value } = hljs.highlight(code, { language, ignoreIllegals: true });
  return parseHighlight(value);
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
};

/**
 * Reads highlight.js output back into a tree.
 *
 * That output is a closed language: every character of the source is
 * escaped (`&amp; &lt; &gt; &quot; &#x27;`) and the only tags are
 * `<span class="…">` and `</span>`. Anything else would be text the grammar
 * did not escape, which highlight.js never produces — so this reads exactly
 * those three shapes and treats the rest as literal characters.
 */
export function parseHighlight(html: string): HighlightNode[] {
  const root: HighlightNode[] = [];
  const stack: HighlightNode[][] = [root];
  const pattern = /<span class="([^"]*)">|<\/span>|&(?:amp|lt|gt|quot|#x27|#39);|[^<&]+|[<&]/g;

  const push = (node: HighlightNode) => {
    const current = stack[stack.length - 1] ?? root;
    const last = current[current.length - 1];
    // Adjacent text is one string: fewer React children, same output.
    if (typeof node === "string" && typeof last === "string") {
      current[current.length - 1] = last + node;
    } else {
      current.push(node);
    }
  };

  for (const [token, className] of html.matchAll(pattern)) {
    if (className !== undefined) {
      const span = { className, children: [] as HighlightNode[] };
      push(span);
      stack.push(span.children);
    } else if (token === "</span>") {
      if (stack.length > 1) stack.pop();
    } else {
      push(ENTITIES[token] ?? token);
    }
  }

  return root;
}
