/**
 * Small, dependency-free HTML sanitiser for owner-authored rich content.
 * Removes script/style/iframe-like elements, event handlers, javascript: and
 * data: URLs, and attributes outside a conservative allow-list. Output is safe
 * to render with dangerouslySetInnerHTML.
 */
const ALLOWED_TAGS = new Set([
  "a", "abbr", "address", "article", "aside", "b", "blockquote", "br", "caption", "cite", "code", "col", "colgroup", "dd", "del", "details", "dfn", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "ins", "kbd", "li", "main", "mark", "nav", "ol", "p", "pre", "q", "s", "section", "small", "span", "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul", "var", "video", "source", "audio", "picture",
]);
const VOID_TAGS = new Set(["br", "hr", "img", "col", "source"]);
const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed", "noscript", "template", "form", "input", "button", "select", "textarea", "svg", "math", "link", "meta", "base", "head", "title"];
const ALLOWED_ATTRS = new Set(["href", "src", "srcset", "alt", "title", "class", "id", "width", "height", "loading", "colspan", "rowspan", "scope", "datetime", "cite", "start", "type", "controls", "poster", "muted", "playsinline", "loop", "autoplay", "open", "target", "rel", "lang", "dir", "role", "aria-label", "aria-hidden", "align"]);
const URL_ATTRS = new Set(["href", "src", "poster", "cite", "srcset"]);

function escapeText(s: string): string {
  return s.replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Accepts relative URLs, anchors and http(s)/mailto/tel/sms; rejects javascript:, data:, vbscript: and friends. */
export function isSafeUrl(raw: string): boolean {
  const value = raw.trim().replace(/[\u0000-\u0020]+/g, "").toLowerCase();
  if (value === "") return false;
  if (value.startsWith("#") || value.startsWith("/") || value.startsWith("./") || value.startsWith("../") || value.startsWith("?")) return true;
  const scheme = value.match(/^([a-z][a-z0-9+.-]*):/);
  if (!scheme) return true;
  return ["http", "https", "mailto", "tel", "sms"].includes(scheme[1]);
}

function sanitizeAttrs(tag: string, attrString: string): string {
  const out: string[] = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  let hasRel = false;
  let target: string | null = null;
  while ((m = re.exec(attrString))) {
    const name = m[1].toLowerCase();
    const bare = m[2] === undefined && m[3] === undefined && m[4] === undefined;
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) continue;
    if (URL_ATTRS.has(name)) {
      if (name === "srcset") {
        if (!value.split(",").every((part) => isSafeUrl(part.trim().split(/\s+/)[0] ?? ""))) continue;
      } else if (!isSafeUrl(value)) continue;
    }
    if (name === "target") {
      target = value;
      continue;
    }
    if (name === "rel") hasRel = true;
    if (name === "class" && /expression|javascript/i.test(value)) continue;
    out.push(bare ? name : `${name}="${escapeAttr(value)}"`);
  }
  if (tag === "a" && target === "_blank") {
    out.push('target="_blank"');
    if (!hasRel) out.push('rel="noopener noreferrer"');
  }
  return out.length ? " " + out.join(" ") : "";
}

/** Strips disallowed tags and attributes; keeps their text. Always returns balanced markup. */
export function sanitizeHtml(input: string): string {
  if (!input) return "";
  let html = input.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "").replace(new RegExp(`<\\/?${tag}\\b[^>]*\\/?>`, "gi"), "");
  }
  const out: string[] = [];
  const open: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>|([^<]+)|(<)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    if (m[3] !== undefined) {
      out.push(escapeText(m[3]));
      continue;
    }
    if (m[4] !== undefined) {
      out.push("&lt;");
      continue;
    }
    const raw = m[0];
    const tag = m[1].toLowerCase();
    const closing = raw.startsWith("</");
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (closing) {
      if (VOID_TAGS.has(tag)) continue;
      const idx = open.lastIndexOf(tag);
      if (idx === -1) continue;
      while (open.length > idx) out.push(`</${open.pop()}>`);
      continue;
    }
    const attrs = sanitizeAttrs(tag, m[2] ?? "");
    out.push(`<${tag}${attrs}>`);
    if (!VOID_TAGS.has(tag)) open.push(tag);
  }
  while (open.length) out.push(`</${open.pop()}>`);
  return out.join("");
}
