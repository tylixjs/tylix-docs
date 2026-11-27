// The playground's code editor: a transparent <textarea> over a
// highlighted copy of the same text. The textarea is sized to its content
// and the wrapper scrolls, so the two layers can never drift apart. Typing
// goes through execCommand("insertText") where possible, so the browser's
// own undo and redo keep working.
//
//   const editor = createEditor(host, { onChange, onRun, onCursor })
//   editor.open(path, text)            show a file (keeps each file's scroll and selection)
//   editor.setDiagnostics([{ line, column, endColumn, message, severity }])
//   editor.setCompletions({ symbols, components, icons, capabilities })
//   editor.reveal(line, column)        scroll to a position and focus
//   editor.value()                     current text
//   editor.readOnly(flag)

// Loaded with this module's own ?v=, so a deploy never pairs it with an
// old highlighter from a cache.
const { highlight, languageOf, lineSection } = await import("./highlight.js" + new URL(import.meta.url).search);

const INDENT = "  ";

const SECTION_SNIPPETS = [
  { label: "state", insert: "state\n  $0", detail: "reactive fields" },
  { label: "computed", insert: "computed\n  $0() {\n    return \n  }", detail: "derived values" },
  { label: "action", insert: "action\n  $0() {\n  }", detail: "methods" },
  { label: "props", insert: "props\n  $0: string", detail: "values passed in" },
  { label: "uses", insert: "uses\n  $0", detail: "capabilities" },
  { label: "onMount", insert: "onMount\n  async {\n    $0\n  }", detail: "runs once on screen" },
  { label: "template", insert: "template\n  $0", detail: "the markup" },
  { label: "style", insert: "style\n  $0", detail: "CSS for this file" },
  { label: "title", insert: 'title "$0"', detail: "document title" },
  { label: "import", insert: 'import $0 from "./components/"', detail: "a component" },
  { label: "init", insert: "init\n  async {\n    $0\n  }", detail: "capability setup" },
];
const BLOCK_SNIPPETS = [
  { label: "#if", insert: "#if $0}}\n{{/if}}", detail: "conditional" },
  { label: "#each", insert: "#each item in $0}}\n{{/each}}", detail: "list" },
  { label: "#else", insert: "#else}}", detail: "else branch" },
  { label: "#else if", insert: "#else if $0}}", detail: "else-if branch" },
  { label: "#await", insert: "#await $0}}\n{{#then value}}\n{{#catch error}}\n{{/await}}", detail: "promise" },
  { label: "@html", insert: "@html $0}}", detail: "trusted HTML" },
];
const ATTRIBUTES = [
  ["onclick", 'onclick="{{ $0 }}"', "event"],
  ["oninput", 'oninput="{{ $0 }}"', "event"],
  ["onsubmit.prevent", 'onsubmit.prevent="{{ $0 }}"', "event + modifier"],
  ["onkeydown.enter", 'onkeydown.enter="{{ $0 }}"', "event + modifier"],
  ["bind:value", 'bind:value="{{ $0 }}"', "two-way binding"],
  ["bind:checked", 'bind:checked="{{ $0 }}"', "two-way binding"],
  ["class", 'class="$0"', "attribute"],
  ["class:", 'class:$0="{{  }}"', "toggle a class"],
  ["style:", 'style:$0="{{  }}"', "set a style"],
  ["type", 'type="$0"', "attribute"],
  ["placeholder", 'placeholder="$0"', "attribute"],
  ["aria-label", 'aria-label="$0"', "attribute"],
  ["data-", "data-$0", "attribute"],
];
const HTML_TAGS = ["div", "span", "p", "h1", "h2", "h3", "button", "a", "ul", "ol", "li", "section", "header", "footer", "main", "nav", "form", "input", "label", "select", "option", "textarea", "img", "strong", "em", "small", "article", "aside", "table", "tr", "td", "th"];
const VOID_TAGS = new Set(["input", "img", "br", "hr"]);
const JS_WORDS = ["const", "let", "return", "if", "else", "for", "of", "await", "async", "this", "true", "false", "null", "is", "not", "and", "or", "has", "console.log"];
const CSS_PROPS = ["color", "background", "border", "border-radius", "box-shadow", "padding", "margin", "display", "gap", "font-size", "font-weight", "font-family", "text-transform", "letter-spacing", "width", "height", "grid-template-columns", "align-items", "justify-content", "transition", "transform", "opacity"];

function el(tag, cls, attrs = {}) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function createEditor(host, { onChange = () => {}, onRun = () => {}, onCursor = () => {} } = {}) {
  host.classList.add("pg-ed");
  host.innerHTML = "";
  const scroller = el("div", "pg-ed-scroll");
  const gutter = el("div", "pg-ed-gutter", { "aria-hidden": "true" });
  const body = el("div", "pg-ed-body");
  const marks = el("div", "pg-ed-marks", { "aria-hidden": "true" });
  const hl = el("pre", "pg-ed-hl", { "aria-hidden": "true" });
  const input = el("textarea", "pg-ed-input", {
    spellcheck: "false", autocapitalize: "off", autocomplete: "off", autocorrect: "off",
    wrap: "off", "aria-label": "Code editor", "aria-autocomplete": "list", "aria-multiline": "true",
  });
  const popup = el("div", "pg-ed-complete", { role: "listbox", hidden: "" });
  const tooltip = el("div", "pg-ed-tip", { role: "tooltip", hidden: "" });
  const probe = el("span", "pg-ed-probe", { "aria-hidden": "true" });
  probe.textContent = "M".repeat(80);
  body.append(marks, hl, input);
  scroller.append(gutter, body);
  host.append(scroller, popup, tooltip, probe);

  let path = "";
  let language = "text";
  let diagnostics = [];
  let sources = { symbols: {}, components: [], icons: [], capabilities: {} };
  const views = new Map(); // path -> { start, end, top, left }
  let charW = 8;
  let lineH = 20;
  let padTop = 12;
  let padLeft = 16;
  let complete = null; // { items, index, from, to }
  let lastLines = -1;

  function measure() {
    const rect = probe.getBoundingClientRect();
    if (rect.width > 0) charW = rect.width / 80;
    const cs = getComputedStyle(input);
    lineH = parseFloat(cs.lineHeight) || 20;
    padTop = parseFloat(cs.paddingTop) || 0;
    padLeft = parseFloat(cs.paddingLeft) || 0;
  }

  function render() {
    const text = input.value;
    const { lines } = highlight(text, language);
    hl.innerHTML = lines.join("\n") + "\n";
    if (lines.length !== lastLines) {
      lastLines = lines.length;
      let g = "";
      for (let i = 1; i <= lines.length; i++) g += `<div class="pg-ln" data-line="${i}">${i}</div>`;
      gutter.innerHTML = g;
    }
    renderMarks();
    activeLine();
  }

  function renderMarks() {
    const lines = input.value.split("\n");
    marks.innerHTML = "";
    gutter.querySelectorAll(".pg-ln.is-error, .pg-ln.is-warning").forEach((n) => {
      n.classList.remove("is-error", "is-warning");
      n.removeAttribute("title");
    });
    for (const d of diagnostics) {
      const line = Math.min(Math.max(1, d.line), lines.length);
      const text = lines[line - 1] ?? "";
      let col = Math.min(Math.max(1, d.column || 1), text.length + 1);
      let end = d.endLine === d.line && d.endColumn > col ? d.endColumn : col + 1;
      if (end - col <= 1) {
        // A one-character span is hard to see: widen it to the word there.
        const word = /^[\w$#@:.\-]+/.exec(text.slice(col - 1));
        if (word) end = col + word[0].length;
        else if (!text.trim()) end = col + 1;
      }
      const kind = d.severity === "warning" ? "warning" : "error";
      const row = el("div", `pg-mark-line is-${kind}`);
      row.style.top = `${padTop + (line - 1) * lineH}px`;
      row.style.height = `${lineH}px`;
      const squiggle = el("div", `pg-mark is-${kind}`);
      squiggle.style.top = `${padTop + (line - 1) * lineH}px`;
      squiggle.style.left = `${padLeft + (col - 1) * charW}px`;
      squiggle.style.width = `${Math.max(1, end - col) * charW}px`;
      squiggle.style.height = `${lineH}px`;
      marks.append(row, squiggle);
      const ln = gutter.querySelector(`[data-line="${line}"]`);
      if (ln) {
        ln.classList.add(`is-${kind}`);
        ln.title = d.message;
      }
    }
  }

  function caretLineCol(pos = input.selectionStart) {
    const before = input.value.slice(0, pos);
    const line = before.split("\n").length;
    const col = pos - before.lastIndexOf("\n");
    return { line, col };
  }

  function activeLine() {
    const { line, col } = caretLineCol();
    gutter.querySelector(".pg-ln.is-active")?.classList.remove("is-active");
    gutter.querySelector(`[data-line="${line}"]`)?.classList.add("is-active");
    onCursor({ line, column: col });
  }

  // Keeps the caret inside the visible part of the scroller.
  function keepCaretVisible() {
    const { line, col } = caretLineCol(input.selectionEnd);
    const top = padTop + (line - 1) * lineH;
    const left = padLeft + (col - 1) * charW + gutter.offsetWidth;
    const view = scroller;
    if (top < view.scrollTop) view.scrollTop = top - lineH;
    else if (top + lineH * 2 > view.scrollTop + view.clientHeight) view.scrollTop = top + lineH * 2 - view.clientHeight;
    if (left < view.scrollLeft + gutter.offsetWidth + 8) view.scrollLeft = Math.max(0, left - gutter.offsetWidth - 40);
    else if (left + 24 > view.scrollLeft + view.clientWidth) view.scrollLeft = left + 48 - view.clientWidth;
  }

  // Inserts text over [from, to] as if typed, so undo works.
  let applying = false;
  function replace(from, to, text, caretOffset = text.length, selectLength = 0) {
    input.focus();
    input.setSelectionRange(from, to);
    let ok = false;
    applying = true;
    try {
      ok = text.length > 0 ? document.execCommand("insertText", false, text) : document.execCommand("delete", false);
    } catch {
      ok = false;
    }
    if (!ok) {
      input.setRangeText(text, from, to, "end");
      input.dispatchEvent(new Event("input"));
    }
    applying = false;
    const caret = from + caretOffset;
    input.setSelectionRange(caret, caret + selectLength);
  }

  // Inserts a snippet; "$0" marks where the caret ends up. Lines after
  // the first get the current line's indentation.
  function insertSnippet(from, to, snippet) {
    const value = input.value;
    const lineStart = value.lastIndexOf("\n", from - 1) + 1;
    const indent = /^\s*/.exec(value.slice(lineStart, from))[0];
    const text = snippet.replace(/\n/g, "\n" + indent);
    const at = text.indexOf("$0");
    const clean = text.replace("$0", "");
    replace(from, to, clean, at === -1 ? clean.length : at);
  }

  // ── Completion ─────────────────────────────────────────────────────

  function fileSymbols(p = path) {
    return sources.symbols?.[p]?.symbols ?? [];
  }

  function capabilityNames() {
    return Object.keys(sources.capabilities ?? {});
  }

  function completionContext(explicit) {
    const value = input.value;
    const pos = input.selectionStart;
    if (pos !== input.selectionEnd) return null;
    const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
    const before = value.slice(lineStart, pos);
    const lineIndex = value.slice(0, lineStart).split("\n").length - 1;
    const { sections } = highlight(value.slice(0, lineStart) + "x", language);
    const section = language === "tyx" ? lineSection(before, sections[lineIndex] ?? "") : "";

    const items = [];
    let prefix = /[\w$]*$/.exec(before)[0];
    let from = pos - prefix.length;
    const add = (label, insert, kind, detail = "") => items.push({ label, insert: insert ?? label, kind, detail });

    if (language === "css") {
      if (/^\s+[\w-]*$/.test(before)) {
        prefix = /[\w-]*$/.exec(before)[0];
        from = pos - prefix.length;
        CSS_PROPS.forEach((p) => add(p, `${p}: $0;`, "property"));
      }
      if (/var\(--[\w-]*$/.test(before) || /--[\w-]*$/.test(before)) {
        prefix = /--[\w-]*$/.exec(before)?.[0] ?? "";
        from = pos - prefix.length;
        const vars = new Set(value.match(/--[\w-]+(?=\s*:)/g) ?? []);
        vars.forEach((v) => add(v, v, "variable"));
      }
      return finish(items, prefix, from, explicit);
    }
    if (language !== "tyx") return null;

    // Section keywords at the start of a line.
    if (/^[A-Za-z]*$/.test(before)) {
      SECTION_SNIPPETS.forEach((s) => add(s.label, s.insert, "section", s.detail));
      return finish(items, prefix, from, explicit);
    }

    // `{{#` blocks and `{{` expressions in a template.
    const block = /\{\{\s*([#@][\w ]*)$/.exec(before);
    if (section === "template" && block) {
      prefix = block[1];
      from = pos - prefix.length;
      BLOCK_SNIPPETS.forEach((s) => add(s.label, s.insert, "block", s.detail));
      return finish(items, prefix, from, true);
    }

    // `Capability.` and `this.`
    const member = /(\b[A-Za-z_$][\w$]*)\.([\w$]*)$/.exec(before);
    if (member) {
      prefix = member[2];
      from = pos - prefix.length;
      const owner = member[1];
      let symbols = [];
      if (owner === "this") symbols = fileSymbols();
      else if (sources.capabilities?.[owner]) symbols = fileSymbols(sources.capabilities[owner]);
      symbols.forEach((s) => add(s.name, s.kind === "action" ? `${s.name}($0)` : s.name, s.kind, s.detail));
      return finish(items, prefix, from, true);
    }

    if (section === "template") {
      const tagOpen = /<([A-Za-z][\w]*)?$/.exec(before);
      if (tagOpen) {
        sources.components.forEach((c) => add(c, `${c} $0/>`, "component"));
        sources.icons.forEach((c) => add(c, `${c} class="icon" />`, "icon"));
        HTML_TAGS.forEach((t) => add(t, VOID_TAGS.has(t) ? `${t} $0/>` : `${t}>$0</${t}>`, "tag"));
        return finish(items, prefix, from, true);
      }
      // Inside a tag (an attribute position)?
      const lastOpen = before.lastIndexOf("<");
      const lastClose = before.lastIndexOf(">");
      const inMustache = before.lastIndexOf("{{") > before.lastIndexOf("}}");
      if (!inMustache && lastOpen > lastClose && /\s[\w:.\-]*$/.test(before)) {
        prefix = /[\w:.\-]*$/.exec(before)[0];
        from = pos - prefix.length;
        ATTRIBUTES.forEach(([label, insert, detail]) => add(label, insert, "attribute", detail));
        return finish(items, prefix, from, explicit);
      }
      if (!inMustache) return finish(items, prefix, from, false);
    }

    // Script or {{ expression }}: this file's names, capabilities, keywords.
    if (section === "uses" || section === "needs" || section === "background") {
      capabilityNames().forEach((c) => add(c, c, "capability"));
      return finish(items, prefix, from, explicit);
    }
    const inTemplate = section === "template";
    for (const s of fileSymbols()) {
      const ref = inTemplate ? s.name : `this.${s.name}`;
      add(s.name, s.kind === "action" ? `${inTemplate ? s.name : `this.${s.name}`}($0)` : ref, s.kind, s.detail);
    }
    capabilityNames().forEach((c) => add(c, c, "capability"));
    JS_WORDS.forEach((w) => add(w, w, "keyword"));
    return finish(items, prefix, from, explicit);
  }

  function finish(items, prefix, from, explicit) {
    if (!explicit && prefix.length < 1) return null;
    const p = prefix.toLowerCase();
    const seen = new Set();
    const ranked = [];
    for (const item of items) {
      if (seen.has(item.label)) continue;
      const l = item.label.toLowerCase();
      // Prefix matches first; then matches inside the name, earliest first
      // (so "<Trash" still finds IconTrash).
      const at = l.indexOf(p);
      if (at < 0 || (at > 0 && p.length < 2)) continue;
      const score = at === 0 ? 0 : 1 + at;
      if (l === p && item.insert === item.label) continue;
      seen.add(item.label);
      ranked.push({ ...item, score });
    }
    ranked.sort((a, b) => a.score - b.score);
    const list = ranked.slice(0, 40);
    if (list.length === 0) return null;
    return { items: list, index: 0, from, to: input.selectionStart };
  }

  function showCompletion(explicit = false) {
    const ctx = completionContext(explicit);
    if (!ctx) return hideCompletion();
    complete = ctx;
    drawCompletion();
  }

  function drawCompletion() {
    if (!complete) return;
    popup.innerHTML = "";
    complete.items.forEach((item, i) => {
      const row = el("div", `pg-cmp${i === complete.index ? " is-active" : ""}`, { role: "option", "data-index": String(i) });
      if (i === complete.index) row.setAttribute("aria-selected", "true");
      const kind = el("span", `pg-cmp-kind is-${item.kind}`);
      kind.textContent = item.kind.slice(0, 1).toUpperCase();
      const label = el("span", "pg-cmp-label");
      label.textContent = item.label;
      const detail = el("span", "pg-cmp-detail");
      detail.textContent = item.detail || item.kind;
      row.append(kind, label, detail);
      popup.append(row);
    });
    const { line, col } = caretLineCol(complete.from);
    const hostRect = host.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    let left = bodyRect.left - hostRect.left + padLeft + (col - 1) * charW;
    let top = bodyRect.top - hostRect.top + padTop + line * lineH + 2;
    popup.hidden = false;
    const width = popup.offsetWidth;
    const height = popup.offsetHeight;
    left = Math.max(4, Math.min(left, hostRect.width - width - 4));
    if (top + height > hostRect.height - 4) top = Math.max(4, top - height - lineH - 4);
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
  }

  function hideCompletion() {
    complete = null;
    popup.hidden = true;
  }

  function acceptCompletion(index = complete?.index ?? 0) {
    if (!complete) return;
    const item = complete.items[index];
    const { from, to } = complete;
    hideCompletion();
    if (item) insertSnippet(from, to, item.insert);
  }

  popup.addEventListener("mousedown", (event) => {
    const row = event.target.closest(".pg-cmp");
    if (!row) return;
    event.preventDefault();
    acceptCompletion(Number(row.dataset.index));
  });

  // ── Keys ───────────────────────────────────────────────────────────

  function selectedLineRange() {
    const value = input.value;
    const start = value.lastIndexOf("\n", input.selectionStart - 1) + 1;
    let end = value.indexOf("\n", Math.max(input.selectionEnd - (input.selectionEnd > input.selectionStart && value[input.selectionEnd - 1] === "\n" ? 1 : 0), input.selectionStart));
    if (end === -1) end = value.length;
    return { start, end };
  }

  function indentLines(outdent) {
    const { start, end } = selectedLineRange();
    const block = input.value.slice(start, end);
    const lines = block.split("\n");
    const next = lines.map((l) => (outdent ? l.replace(/^ {1,2}/, "") : INDENT + l)).join("\n");
    replace(start, end, next);
    input.setSelectionRange(start, start + next.length);
  }

  function toggleComment() {
    const { start, end } = selectedLineRange();
    const lines = input.value.slice(start, end).split("\n");
    const lineIndex = input.value.slice(0, start).split("\n").length - 1;
    const { sections } = highlight(input.value, language);
    const section = sections[lineIndex];
    const html = language === "tyx" && section === "template";
    const css = language === "css" || section === "style";
    const isCommented = lines.every((l) => !l.trim() || (html ? /^\s*<!--.*-->\s*$/.test(l) : css ? /^\s*\/\*.*\*\/\s*$/.test(l) : /^\s*\/\//.test(l)));
    const next = lines.map((l) => {
      if (!l.trim()) return l;
      const [, ws, rest] = /^(\s*)(.*)$/.exec(l);
      if (isCommented) {
        if (html) return ws + rest.replace(/^<!--\s?/, "").replace(/\s?-->$/, "");
        if (css) return ws + rest.replace(/^\/\*\s?/, "").replace(/\s?\*\/$/, "");
        return ws + rest.replace(/^\/\/\s?/, "");
      }
      return html ? `${ws}<!-- ${rest} -->` : css ? `${ws}/* ${rest} */` : `${ws}// ${rest}`;
    }).join("\n");
    replace(start, end, next);
    input.setSelectionRange(start, start + next.length);
  }

  input.addEventListener("keydown", (event) => {
    const mod = event.metaKey || event.ctrlKey;
    if (complete) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const n = complete.items.length;
        complete.index = (complete.index + (event.key === "ArrowDown" ? 1 : n - 1)) % n;
        drawCompletion();
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        acceptCompletion();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        hideCompletion();
        return;
      }
    }
    if (input.readOnly) {
      if (mod && (event.key === "Enter" || event.key === "s")) {
        event.preventDefault();
        onRun();
      }
      return;
    }
    if (mod && (event.key === "Enter" || event.key.toLowerCase() === "s")) {
      event.preventDefault();
      onRun();
      return;
    }
    if (mod && event.key === " ") {
      event.preventDefault();
      showCompletion(true);
      return;
    }
    if (mod && event.key === "/") {
      event.preventDefault();
      toggleComment();
      return;
    }
    if (event.key === "Tab" && !mod && !event.altKey) {
      // Shift+Tab outdents. Tab indents a selection, or inserts spaces.
      event.preventDefault();
      if (event.shiftKey || input.selectionStart !== input.selectionEnd) indentLines(event.shiftKey);
      else replace(input.selectionStart, input.selectionEnd, INDENT);
      return;
    }
    if (event.key === "Enter" && !mod && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      const value = input.value;
      const pos = input.selectionStart;
      const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
      const line = value.slice(lineStart, pos);
      let indent = /^\s*/.exec(line)[0];
      const after = value.slice(input.selectionEnd);
      const trimmed = line.trimEnd();
      const opens = /[{[(]$/.test(trimmed) || (language === "tyx" && /^[A-Za-z]+$/.test(trimmed) && lineSection(trimmed, "") !== "");
      if (opens) {
        const closes = /^\s*[}\])]/.test(after);
        if (closes && /[{[(]$/.test(trimmed)) {
          const text = "\n" + indent + INDENT + "\n" + indent;
          replace(pos, input.selectionEnd, text, 1 + indent.length + INDENT.length);
          return;
        }
        indent += INDENT;
      }
      replace(pos, input.selectionEnd, "\n" + indent);
      return;
    }
    if (event.key === "Escape") {
      hideTooltip();
    }
  });

  // `{{` becomes `{{  }}` with the caret in the middle.
  input.addEventListener("beforeinput", (event) => {
    if (event.inputType !== "insertText" || event.data !== "{" || input.readOnly) return;
    const pos = input.selectionStart;
    if (pos !== input.selectionEnd || input.value[pos - 1] !== "{" || input.value[pos - 2] === "{") return;
    if (input.value.slice(pos, pos + 2) === "}}") return;
    event.preventDefault();
    replace(pos, pos, "{  }}", 2);
    if (language === "tyx") showCompletion(true);
  });

  input.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text/plain");
    if (text == null || input.readOnly) return;
    if (!/\t|\r/.test(text)) return;
    event.preventDefault();
    replace(input.selectionStart, input.selectionEnd, text.replace(/\r\n?/g, "\n").replace(/\t/g, INDENT));
  });

  let lastValue = "";
  input.addEventListener("input", (event) => {
    render();
    keepCaretVisible();
    const value = input.value;
    if (value !== lastValue) {
      lastValue = value;
      onChange(path, value);
    }
    if (applying) return;
    const typed = event.inputType === "insertText" ? event.data : null;
    if (typed && typed.length === 1 && /[\w$<.#@:\-]/.test(typed)) showCompletion(typed === "<" || typed === ".");
    else if (event.inputType?.startsWith("delete") && complete) showCompletion(false);
    else hideCompletion();
  });

  const caretEvents = () => {
    activeLine();
    keepCaretVisible();
  };
  input.addEventListener("keyup", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key) && !complete) caretEvents();
  });
  input.addEventListener("mouseup", () => activeLine());
  input.addEventListener("blur", () => setTimeout(hideCompletion, 120));
  scroller.addEventListener("scroll", () => {
    if (complete) drawCompletion();
    hideTooltip();
  });

  // Hovering a marked spot shows its message.
  function hideTooltip() {
    tooltip.hidden = true;
  }
  body.addEventListener("mousemove", (event) => {
    if (diagnostics.length === 0) return hideTooltip();
    const rect = body.getBoundingClientRect();
    const line = Math.floor((event.clientY - rect.top - padTop) / lineH) + 1;
    const hits = diagnostics.filter((d) => d.line === line);
    if (hits.length === 0) return hideTooltip();
    tooltip.textContent = hits.map((d) => d.message).join("\n");
    tooltip.className = `pg-ed-tip is-${hits[0].severity === "warning" ? "warning" : "error"}`;
    tooltip.hidden = false;
    const hostRect = host.getBoundingClientRect();
    const top = rect.top - hostRect.top + padTop + line * lineH + 4;
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${Math.max(8, Math.min(event.clientX - hostRect.left - 20, hostRect.width - tooltip.offsetWidth - 8))}px`;
  });
  body.addEventListener("mouseleave", hideTooltip);

  gutter.addEventListener("click", (event) => {
    const ln = event.target.closest(".pg-ln");
    if (ln) reveal(Number(ln.dataset.line), 1);
  });

  function saveView() {
    if (!path) return;
    views.set(path, { start: input.selectionStart, end: input.selectionEnd, top: scroller.scrollTop, left: scroller.scrollLeft });
  }

  function open(nextPath, text) {
    saveView();
    path = nextPath;
    language = languageOf(nextPath);
    host.dataset.language = language;
    input.value = text.replace(/\r\n?/g, "\n").replace(/\t/g, INDENT);
    lastValue = input.value;
    diagnostics = [];
    hideCompletion();
    hideTooltip();
    lastLines = -1;
    render();
    const view = views.get(nextPath);
    if (view) {
      input.setSelectionRange(view.start, view.end);
      scroller.scrollTop = view.top;
      scroller.scrollLeft = view.left;
    } else {
      input.setSelectionRange(0, 0);
      scroller.scrollTop = 0;
      scroller.scrollLeft = 0;
    }
    activeLine();
  }

  function reveal(line, column = 1) {
    const lines = input.value.split("\n");
    const l = Math.min(Math.max(1, line), lines.length);
    let pos = 0;
    for (let i = 0; i < l - 1; i++) pos += lines[i].length + 1;
    pos += Math.min(Math.max(0, column - 1), lines[l - 1].length);
    input.focus({ preventScroll: true });
    input.setSelectionRange(pos, pos);
    const top = padTop + (l - 1) * lineH;
    scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 3);
    keepCaretVisible();
    activeLine();
  }

  function setDiagnostics(list) {
    diagnostics = (list ?? []).filter((d) => d.file === path);
    renderMarks();
  }

  const relayout = () => {
    measure();
    renderMarks();
    if (complete) drawCompletion();
  };
  if (document.fonts?.ready) document.fonts.ready.then(relayout);
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(relayout) : null;
  observer?.observe(host);
  measure();

  return {
    open,
    reveal,
    setDiagnostics(list) {
      setDiagnostics(list);
    },
    setAllDiagnostics(list) {
      setDiagnostics(list);
    },
    setCompletions(next) {
      sources = { ...sources, ...next };
    },
    value: () => input.value,
    path: () => path,
    focus: () => input.focus(),
    readOnly(flag) {
      input.readOnly = !!flag;
      host.classList.toggle("is-readonly", !!flag);
    },
    refresh: relayout,
    destroy() {
      observer?.disconnect();
      host.innerHTML = "";
    },
  };
}
