/**
 * Markdown → HTML for the docs and for Hub changelog bodies.
 *
 * - Code fences are highlighted on the server by Shiki, using the same
 *   TextMate grammar and colour themes as the Tylix VS Code extension, so a
 *   `.tyx` sample looks exactly like it does in the editor.
 *   Fence meta:  ```tyx title="app/pages/Home.tyx" {3,5-7}
 * - `## Heading` and `### Heading` get ids and anchor links, and are
 *   returned as the page's table of contents.
 * - GitHub-style callouts: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!DANGER]`.
 * - Raw HTML in the source is escaped, never passed through.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { Marked, type Tokens } from "marked";
import { createHighlighter, type Highlighter, type ShikiTransformer } from "shiki";

export interface TocItem {
    id: string;
    text: string;
    depth: 2 | 3;
}

export interface RenderResult {
    html: string;
    toc: TocItem[];
    /** Plain text per heading section, for search. */
    sections: { id: string; heading: string; text: string }[];
}

const SHIKI_DIR = path.resolve(process.cwd(), "resources/shiki");

const LANGS = [
    "javascript", "typescript", "jsx", "tsx", "json", "bash", "shellscript", "html", "css",
    "vue", "svelte", "diff", "yaml", "sql", "ini", "dotenv", "markdown", "docker", "toml",
] as const;

const ALIASES: Record<string, string> = {
    js: "javascript", ts: "typescript", sh: "bash", shell: "bash", zsh: "bash",
    console: "bash", env: "dotenv", yml: "yaml", md: "markdown", dockerfile: "docker",
};

const LANG_LABELS: Record<string, string> = {
    tyx: "Tylix", javascript: "JavaScript", typescript: "TypeScript", jsx: "JSX", tsx: "TSX",
    json: "JSON", bash: "Terminal", html: "HTML", css: "CSS", vue: "Vue", svelte: "Svelte",
    diff: "Diff", yaml: "YAML", sql: "SQL", dotenv: ".env", ini: "INI", text: "Text",
    docker: "Dockerfile", toml: "TOML", markdown: "Markdown",
};

let highlighterPromise: Promise<Highlighter> | null = null;

function readJson(file: string) {
    return JSON.parse(readFileSync(path.join(SHIKI_DIR, file), "utf-8"));
}

function highlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
        const tyx = { ...readJson("tylix.tmLanguage.json"), name: "tyx", embeddedLangs: ["javascript", "css"] };
        const dark = { ...readJson("tylix-dark-color-theme.json"), name: "tylix-dark" };
        const light = { ...readJson("tylix-light-color-theme.json"), name: "tylix-light" };
        highlighterPromise = createHighlighter({
            themes: [light, dark],
            langs: [...LANGS, tyx],
        }).catch((err) => {
            highlighterPromise = null;
            throw err;
        });
    }
    return highlighterPromise;
}

export function escapeHtml(text: string): string {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/<[^>]+>/g, "")
        .replace(/&[a-z]+;/g, "")
        .replace(/[`*_~]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

/** `tyx title="a.tyx" {2,4-6}` → { lang, title, lines } */
function parseFenceInfo(info: string | undefined) {
    const raw = (info ?? "").trim();
    const lang = raw.split(/\s+/)[0]?.toLowerCase() || "text";
    const title = /title="([^"]*)"/.exec(raw)?.[1] ?? "";
    const lines = new Set<number>();
    const range = /\{([\d,\s-]+)\}/.exec(raw)?.[1];
    if (range) {
        for (const part of range.split(",")) {
            const [a, b] = part.trim().split("-").map((n) => Number.parseInt(n, 10));
            if (Number.isInteger(a)) for (let n = a; n <= (Number.isInteger(b) ? b : a); n++) lines.add(n);
        }
    }
    return { lang: ALIASES[lang] ?? lang, title, lines };
}

const COPY_ICON =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

const CALLOUTS: Record<string, string> = { NOTE: "Note", TIP: "Tip", WARNING: "Warning", DANGER: "Danger", IMPORTANT: "Important" };

function plain(text: string) {
    return text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export async function renderMarkdown(source: string, opts: { anchors?: boolean } = {}): Promise<RenderResult> {
    const hl = await highlighter();
    const loaded = new Set(hl.getLoadedLanguages());
    const anchors = opts.anchors !== false;

    const toc: TocItem[] = [];
    const used = new Map<string, number>();
    const sections: RenderResult["sections"] = [{ id: "", heading: "", text: "" }];

    const marked = new Marked({ gfm: true });

    marked.use({
        renderer: {
            heading(this: any, { tokens, depth }: Tokens.Heading) {
                const inner = this.parser.parseInline(tokens);
                const text = plain(inner);
                let id = slugify(text) || "section";
                const n = used.get(id) ?? 0;
                used.set(id, n + 1);
                if (n > 0) id = `${id}-${n}`;

                if (depth === 2 || depth === 3) {
                    toc.push({ id, text, depth });
                    sections.push({ id, heading: text, text: "" });
                }
                if (!anchors || depth === 1) return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
                return `<h${depth} id="${id}"><a class="doc-anchor" href="#${id}" aria-label="Link to this section">#</a>${inner}</h${depth}>\n`;
            },

            paragraph(this: any, { tokens }: Tokens.Paragraph) {
                const inner = this.parser.parseInline(tokens);
                sections[sections.length - 1].text += " " + plain(inner);
                return `<p>${inner}</p>\n`;
            },

            code({ text, lang: info }: Tokens.Code) {
                const { lang, title, lines } = parseFenceInfo(info);
                const known = lang === "tyx" || loaded.has(lang);
                const isShell = lang === "bash";
                // In a terminal block, a "$ " prompt goes before each command:
                // not before comments, blank lines or a continued line.
                const src = text.replace(/\n$/, "").split("\n");
                const isCmd = (n: number) => {
                    const t = (src[n - 1] ?? "").trim();
                    const prev = (src[n - 2] ?? "").trimEnd();
                    return t !== "" && !t.startsWith("#") && !prev.endsWith("\\");
                };
                const transformers: ShikiTransformer[] = [
                    {
                        line(node, line) {
                            if (lines.has(line)) this.addClassToHast(node, "is-hl");
                            if (isShell && isCmd(line)) this.addClassToHast(node, "is-cmd");
                        },
                    },
                ];
                const highlighted = hl.codeToHtml(text.replace(/\n$/, ""), {
                    lang: known ? lang : "text",
                    themes: { light: "tylix-light", dark: "tylix-dark" },
                    defaultColor: false,
                    transformers,
                });
                const label = title || LANG_LABELS[lang] || lang;
                sections[sections.length - 1].text += " " + text.slice(0, 400);
                return (
                    `<figure class="doc-code${isShell ? " is-shell" : ""}${lines.size ? " has-hl" : ""}">` +
                    `<figcaption><span class="doc-code-label${title ? " is-file" : ""}">${escapeHtml(label)}</span>` +
                    `<button type="button" class="doc-copy" data-copy aria-label="Copy code">${COPY_ICON}<span>Copy</span></button></figcaption>` +
                    `${highlighted}<textarea class="doc-code-src" hidden aria-hidden="true">${escapeHtml(text.replace(/\n$/, ""))}</textarea></figure>\n`
                );
            },

            codespan({ text }: Tokens.Codespan) {
                return `<code>${text}</code>`;
            },

            blockquote(this: any, { tokens }: Tokens.Blockquote) {
                let body = this.parser.parse(tokens);
                const m = /^<p>\[!(NOTE|TIP|WARNING|DANGER|IMPORTANT)\]\s*/.exec(body);
                if (!m) return `<blockquote>${body}</blockquote>\n`;
                body = "<p>" + body.slice(m[0].length);
                body = body.replace(/^<p>\s*<\/p>\n?/, "");
                const kind = m[1].toLowerCase();
                return `<aside class="doc-callout is-${kind}" role="note"><p class="doc-callout-title">${CALLOUTS[m[1]]}</p>${body}</aside>\n`;
            },

            table(this: any, token: Tokens.Table) {
                const cell = (c: Tokens.TableCell, tag: string) => {
                    const align = c.align ? ` style="text-align:${c.align}"` : "";
                    return `<${tag}${align}>${this.parser.parseInline(c.tokens)}</${tag}>`;
                };
                const head = `<tr>${token.header.map((c) => cell(c, "th")).join("")}</tr>`;
                const rows = token.rows.map((r) => `<tr>${r.map((c) => cell(c, "td")).join("")}</tr>`).join("");
                return `<div class="doc-table"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>\n`;
            },

            link(this: any, { href, title, tokens }: Tokens.Link) {
                const inner = this.parser.parseInline(tokens);
                const external = /^https?:\/\//.test(href);
                const t = title ? ` title="${escapeHtml(title)}"` : "";
                const ext = external ? ' target="_blank" rel="noopener noreferrer"' : "";
                return `<a href="${escapeHtml(href)}"${t}${ext}>${inner}</a>`;
            },

            html({ text }: Tokens.HTML | Tokens.Tag) {
                return escapeHtml(text);
            },
        },
    });

    const html = await marked.parse(source);
    return { html, toc, sections: sections.filter((s) => s.heading || s.text.trim()) };
}

/** Warm Shiki up at boot so the first docs request isn't the slow one. */
export function warmHighlighter() {
    void highlighter().catch((err) => console.error("[docs] Shiki failed to load:", err));
}
