// Syntax highlighting for the playground editor: .tyx (script sections,
// template, style), CSS and JSON. Line based, with a little state carried
// from line to line (section, open tag, block comment). Small files only,
// so the whole document is re-highlighted on every keystroke.
//
//   highlight(text, language) -> { lines: [html, ...], sections: [name, ...] }
//   sectionAt(text, lineIndex) -> the .tyx section a line belongs to

const SECTION_HEADERS = new Set([
  "props", "uses", "needs", "background", "permissions", "state", "computed",
  "action", "actions", "onMount", "init", "template", "style",
]);
const JS_KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "break", "continue",
  "new", "async", "await", "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of",
  "switch", "case", "default", "class", "extends", "import", "from", "export", "type", "interface",
  "as", "delete", "void", "yield", "enum",
]);
const WORD_OPS = new Set(["is", "not", "and", "or", "has"]);
const CONSTANTS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function tok(cls, s) {
  return s ? (cls ? `<span class="t-${cls}">${esc(s)}</span>` : esc(s)) : "";
}

// ── JavaScript / TypeScript (with Tylix's word operators) ───────────────

const JS_RE = /(\/\/.*$)|(\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d"'`]+?)/gy;

export function highlightJs(line, state, opts = {}) {
  let out = "";
  let i = 0;
  if (state.blockComment) {
    const end = line.indexOf("*/");
    if (end === -1) return tok("comment", line);
    out += tok("comment", line.slice(0, end + 2));
    i = end + 2;
    state.blockComment = false;
  }
  JS_RE.lastIndex = i;
  let m;
  let prevWord = "";
  while (JS_RE.lastIndex < line.length && (m = JS_RE.exec(line))) {
    const [all, lineComment, block, str, num, word, ws, punct] = m;
    if (lineComment) out += tok("comment", all);
    else if (block) {
      out += tok("comment", all);
      if (!all.endsWith("*/") || all.length < 4) state.blockComment = true;
    } else if (str) out += tok("string", all);
    else if (num) out += tok("number", all);
    else if (word) {
      const rest = line.slice(JS_RE.lastIndex);
      let cls = "";
      if (word === "this") cls = "this";
      else if (WORD_OPS.has(word)) cls = "wordop";
      else if (CONSTANTS.has(word)) cls = "const";
      else if (JS_KEYWORDS.has(word)) cls = "keyword";
      else if (opts.keyPosition && /^\s*(\([^)]*\))?\s*:/.test(rest) && !prevWord) cls = "prop";
      else if (/^\s*\(/.test(rest)) cls = "fn";
      else if (/^[A-Z]/.test(word)) cls = "type";
      else if (/^\s*:/.test(rest) && /[{,]\s*$/.test(line.slice(0, m.index))) cls = "prop";
      out += tok(cls, all);
      prevWord = word;
    } else if (ws) out += esc(all);
    else if (punct) out += tok("punct", all);
    else break;
  }
  if (JS_RE.lastIndex < line.length && JS_RE.lastIndex === i) out += esc(line.slice(i));
  return out;
}

// ── Template (HTML with {{ }} and {{#blocks}}) ──────────────────────────

function mustache(src) {
  // src starts with "{{" and ends with "}}" (or runs to the end of the line)
  const inner = src.slice(2, src.endsWith("}}") ? -2 : undefined);
  const close = src.endsWith("}}") ? "}}" : "";
  const block = /^(\s*)([#/:@][A-Za-z]*(?:\s+if)?)/.exec(inner);
  let out = tok("brace", "{{");
  let rest = inner;
  if (block) {
    out += esc(block[1]) + tok("block", block[2]);
    rest = inner.slice(block[0].length);
  }
  out += highlightJs(rest, {});
  return out + tok("brace", close);
}

function withMustaches(text, cls) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("{{", i);
    if (start === -1) {
      out += tok(cls, text.slice(i));
      break;
    }
    out += tok(cls, text.slice(i, start));
    const end = text.indexOf("}}", start + 2);
    const stop = end === -1 ? text.length : end + 2;
    out += mustache(text.slice(start, stop));
    i = stop;
  }
  return out;
}

export function highlightTemplate(line, state) {
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (state.htmlComment) {
      const end = line.indexOf("-->", i);
      const stop = end === -1 ? line.length : end + 3;
      out += tok("comment", line.slice(i, stop));
      if (end !== -1) state.htmlComment = false;
      i = stop;
      continue;
    }
    if (state.inTag) {
      const rest = line.slice(i);
      let m;
      if ((m = /^\s+/.exec(rest))) out += esc(m[0]);
      else if ((m = /^\/?>/.exec(rest))) {
        out += tok("punct", m[0]);
        state.inTag = false;
      } else if ((m = /^([A-Za-z_:@][\w:.\-@]*)(\s*=\s*)?("[^"]*"?|'[^']*'?)?/.exec(rest)) && m[0]) {
        out += tok("attr", m[1]);
        if (m[2]) out += tok("punct", m[2]);
        if (m[3]) {
          const q = m[3][0];
          const body = m[3].slice(1, m[3].endsWith(q) && m[3].length > 1 ? -1 : undefined);
          out += tok("attrstr", q) + withMustaches(body, "attrstr") + (m[3].length > 1 && m[3].endsWith(q) ? tok("attrstr", q) : "");
        }
      } else if ((m = /^\{\{[\s\S]*?(\}\}|$)/.exec(rest))) out += mustache(m[0]);
      else m = [rest[0]], (out += esc(rest[0]));
      i += m[0].length;
      continue;
    }
    const rest = line.slice(i);
    let m;
    if (rest.startsWith("<!--")) {
      state.htmlComment = true;
      continue;
    }
    if ((m = /^(<\/?)([A-Za-z][\w.\-]*)/.exec(rest))) {
      const isComponent = /^[A-Z]/.test(m[2]);
      out += tok("punct", m[1]) + tok(isComponent ? "component" : "tag", m[2]);
      state.inTag = m[1] === "<";
      if (m[1] === "</") {
        const close = /^\s*>/.exec(rest.slice(m[0].length));
        if (close) {
          out += tok("punct", close[0]);
          i += close[0].length;
        }
      }
      i += m[0].length;
      continue;
    }
    if ((m = /^\{\{[\s\S]*?(\}\}|$)/.exec(rest))) {
      out += mustache(m[0]);
      i += m[0].length;
      continue;
    }
    const next = rest.slice(1).search(/<|\{\{/);
    const text = next === -1 ? rest : rest.slice(0, next + 1);
    out += esc(text);
    i += text.length;
  }
  return out;
}

// ── CSS ─────────────────────────────────────────────────────────────────

export function highlightCss(line, state) {
  let out = "";
  let i = 0;
  const re = /(\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(#[0-9a-fA-F]{3,8}\b)|(-?\d*\.?\d+(?:px|rem|em|%|s|ms|vh|vw|fr|deg)?)|(--[\w-]+)|(@[\w-]+)|([\w-]+)(?=\s*:(?!:)[^{]*;?\s*$)|([A-Za-z_][\w-]*)|(\s+)|([{}();:,>+~*.#\[\]=!/])|(.)/gy;
  if (state.blockComment) {
    const end = line.indexOf("*/");
    if (end === -1) return tok("comment", line);
    out += tok("comment", line.slice(0, end + 2));
    i = end + 2;
    state.blockComment = false;
  }
  re.lastIndex = i;
  let m;
  while (re.lastIndex < line.length && (m = re.exec(line))) {
    const [all, comment, str, hex, num, cssVar, at, prop, word, ws, punct] = m;
    if (comment) {
      out += tok("comment", all);
      if (!all.endsWith("*/") || all.length < 4) state.blockComment = true;
    } else if (str) out += tok("string", all);
    else if (hex) out += tok("number", all);
    else if (num) out += tok("number", all);
    else if (cssVar) out += tok("prop", all);
    else if (at) out += tok("keyword", all);
    else if (prop && state.depth > 0) out += tok("attr", all);
    else if (word) out += tok(state.depth > 0 ? "" : "tag", all);
    else if (ws) out += esc(all);
    else if (punct) {
      if (all === "{") state.depth++;
      if (all === "}") state.depth = Math.max(0, state.depth - 1);
      out += tok("punct", all);
    } else out += esc(all);
  }
  return out;
}

// ── JSON ────────────────────────────────────────────────────────────────

export function highlightJson(line) {
  return line.replace(/("(?:[^"\\]|\\.)*")(\s*:)?|(\b-?\d+(?:\.\d+)?\b)|\b(true|false|null)\b|([&<>])/g, (all, str, colon, num, lit, ch) => {
    if (str) return tok(colon ? "prop" : "string", str) + (colon ? tok("punct", colon) : "");
    if (num) return tok("number", num);
    if (lit) return tok("const", lit);
    return esc(ch);
  });
}

// ── .tyx files ──────────────────────────────────────────────────────────

const HEADER_RE = /^(page|component|capability)(\s+)([A-Za-z_$][\w$]*)?(.*)$/;

export function lineSection(line, current) {
  if (/^\S/.test(line)) {
    const word = /^([A-Za-z]+)\b/.exec(line)?.[1] ?? "";
    if (SECTION_HEADERS.has(word) && /^[A-Za-z]+\s*$/.test(line)) return word;
    if (HEADER_RE.test(line)) return "header";
    if (word === "import") return "import";
    if (word === "title") return "title";
  }
  return current;
}

function highlightTyxLine(line, state) {
  const section = lineSection(line, state.section);
  const changed = section !== state.section || /^\S/.test(line);
  state.section = section;

  if (changed && section === "header") {
    const m = HEADER_RE.exec(line);
    if (m) return tok("decl", m[1]) + esc(m[2]) + tok("name", m[3] ?? "") + esc(m[4]);
  }
  if (changed && SECTION_HEADERS.has(section) && /^[A-Za-z]+\s*$/.test(line)) {
    state.template = { inTag: false, htmlComment: false };
    state.css = { blockComment: false, depth: 0 };
    return tok("section", line);
  }
  if (section === "title" && /^title\b/.test(line)) {
    return tok("section", "title") + highlightJs(line.slice(5), {});
  }
  if (section === "template") return highlightTemplate(line, state.template);
  if (section === "style") return highlightCss(line, state.css);
  if (section === "uses" || section === "needs" || section === "background") {
    return line.replace(/[^\s]+/g, (w) => tok("type", w));
  }
  const keyPosition = (section === "state" || section === "props") && /^  \S/.test(line);
  return highlightJs(line, state.js, { keyPosition });
}

export function languageOf(path) {
  if (path.endsWith(".tyx")) return "tyx";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  return "text";
}

export function highlight(text, language) {
  const lines = text.split("\n");
  const html = [];
  const sections = [];
  const state = {
    section: "",
    js: { blockComment: false },
    template: { inTag: false, htmlComment: false },
    css: { blockComment: false, depth: 0 },
  };
  for (const line of lines) {
    if (language === "tyx") {
      html.push(highlightTyxLine(line, state));
      sections.push(state.section);
    } else if (language === "css") {
      html.push(highlightCss(line, state.css));
      sections.push("style");
    } else if (language === "json") {
      html.push(highlightJson(line));
      sections.push("");
    } else {
      html.push(esc(line));
      sections.push("");
    }
  }
  return { lines: html, sections };
}
