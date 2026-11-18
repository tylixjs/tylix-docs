/**
 * The documentation content: Markdown files in content/docs, ordered by
 * content/docs/nav.json.
 *
 *   content/docs/installation.md   →  /docs/installation
 *
 * Each file may start with front matter:
 *   ---
 *   title: Installation
 *   description: One line, used under the title and in search results.
 *   ---
 *
 * Rendered pages are cached and re-rendered when the file changes, so
 * editing a doc shows up on the next request without a restart.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { renderMarkdown, type TocItem } from "./Markdown.js";

const DOCS_DIR = path.resolve(process.cwd(), "content/docs");
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export interface NavItem {
    slug: string;
    title: string;
    badge?: string;
}
export interface NavSection {
    title: string;
    items: NavItem[];
}

export interface DocPage {
    slug: string;
    title: string;
    description: string;
    section: string;
    html: string;
    toc: TocItem[];
    prev: NavItem | null;
    next: NavItem | null;
    editUrl: string;
    updatedAt: string;
}

interface Cached {
    mtimeMs: number;
    page: Omit<DocPage, "prev" | "next" | "section">;
    sections: { id: string; heading: string; text: string }[];
}

const cache = new Map<string, Cached>();
let navCache: { mtimeMs: number; nav: NavSection[] } | null = null;

const EDIT_BASE = process.env.DOCS_EDIT_URL ?? "https://github.com/tylixjs/tylix-docs/edit/main/content/docs";

function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
    if (!m) return { meta: {}, body: raw };
    const meta: Record<string, string> = {};
    for (const line of m[1].split(/\r?\n/)) {
        const i = line.indexOf(":");
        if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
    return { meta, body: raw.slice(m[0].length) };
}

export async function getNav(): Promise<NavSection[]> {
    const file = path.join(DOCS_DIR, "nav.json");
    const stat = await fs.stat(file);
    if (navCache && navCache.mtimeMs === stat.mtimeMs) return navCache.nav;
    const nav = JSON.parse(await fs.readFile(file, "utf-8")) as NavSection[];
    navCache = { mtimeMs: stat.mtimeMs, nav };
    return nav;
}

async function load(slug: string): Promise<Cached | null> {
    if (!SLUG_RE.test(slug)) return null;
    const file = path.join(DOCS_DIR, `${slug}.md`);
    const stat = await fs.stat(file).catch(() => null);
    if (!stat) return null;

    const hit = cache.get(slug);
    if (hit && hit.mtimeMs === stat.mtimeMs) return hit;

    const { meta, body } = parseFrontMatter(await fs.readFile(file, "utf-8"));
    // The H1 is drawn by the page itself from the title.
    const withoutH1 = body.replace(/^\s*#\s+.+\n/, "");
    const titleFromH1 = /^\s*#\s+(.+)\n/.exec(body)?.[1]?.trim();
    const { html, toc, sections } = await renderMarkdown(withoutH1);

    const entry: Cached = {
        mtimeMs: stat.mtimeMs,
        sections,
        page: {
            slug,
            title: meta.title || titleFromH1 || slug,
            description: meta.description ?? "",
            html,
            toc,
            editUrl: `${EDIT_BASE}/${slug}.md`,
            updatedAt: stat.mtime.toISOString(),
        },
    };
    cache.set(slug, entry);
    return entry;
}

export async function getDoc(slug: string): Promise<DocPage | null> {
    const entry = await load(slug);
    if (!entry) return null;

    const nav = await getNav();
    const flat = nav.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })));
    const at = flat.findIndex((i) => i.slug === slug);
    const strip = (i: (typeof flat)[number] | undefined) => (i ? { slug: i.slug, title: i.title } : null);

    return {
        ...entry.page,
        section: at >= 0 ? flat[at].section : "",
        prev: at > 0 ? strip(flat[at - 1]) : null,
        next: at >= 0 ? strip(flat[at + 1]) : null,
    };
}

const SNIPPETS_DIR = path.resolve(process.cwd(), "content/snippets");
let snippetCache: { signature: string; data: Record<string, string> } | null = null;

/** content/snippets/*.md, highlighted: { page: "<figure…>", … } */
export async function getSnippets(): Promise<Record<string, string>> {
    const files = (await fs.readdir(SNIPPETS_DIR).catch(() => [] as string[])).filter((f) => f.endsWith(".md") && f !== "README.md");
    const stats = await Promise.all(files.map((f) => fs.stat(path.join(SNIPPETS_DIR, f))));
    const signature = files.map((f, i) => `${f}:${stats[i].mtimeMs}`).join("|");
    if (snippetCache && snippetCache.signature === signature) return snippetCache.data;

    const data: Record<string, string> = {};
    for (const f of files) {
        const { html } = await renderMarkdown(await fs.readFile(path.join(SNIPPETS_DIR, f), "utf-8"), { anchors: false });
        data[f.replace(/\.md$/, "")] = html;
    }
    snippetCache = { signature, data };
    return data;
}

export interface SearchHit {
    slug: string;
    page: string;
    section: string;
    heading: string;
    anchor: string;
    snippet: string;
    /** Set for pages outside /docs (/auth, /whats-new, …); the link is href#anchor. */
    href?: string;
}

// --- Site pages in search ---------------------------------------------
//
// The product pages aren't Markdown, so their text is read from the .tyx
// file itself: the template split at each <h2>, anchored to the nearest
// <section id>, plus the strings in the state block (the lists the
// template loops over). Re-read when the file changes, like the docs.

const PAGES_DIR = path.resolve(process.cwd(), "app/pages");

interface SitePage {
    file: string;
    href: string;
    page: string;
    section: string;
    description: string;
}

const SITE_PAGES: SitePage[] = [
    { file: "whats-new.tyx", href: "/whats-new", page: "What's new in 2.1", section: "Release notes", description: "Roles and permissions, installable apps, authentication in every new app, and the 2.1.1 patch." },
    { file: "Auth.tyx", href: "/auth", page: "Tylix Auth", section: "Packages", description: "Sessions, password hashing, social sign-in, two-factor and rate limits for any JavaScript framework." },
    { file: "Permissions.tyx", href: "/permissions", page: "Roles & permissions", section: "Packages", description: "Roles, wildcards, inheritance, denies, teams and expiring grants, checked on the server and in the browser." },
    { file: "Documents.tyx", href: "/documents", page: "PDF & Excel", section: "Packages", description: "Invoices, reports and spreadsheets from plain objects, with a live demo in the browser." },
];

const siteCache = new Map<string, { mtimeMs: number; sections: { id: string; heading: string; text: string }[] }>();

function tyxText(html: string): string {
    return html
        .replace(/\{\{[#/][^}]*\}\}/g, " ")
        .replace(/\{\{[\s\S]*?\}\}/g, " ")
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;|&#160;/g, " ")
        .replace(/&[a-z]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

async function sitePageSections(page: SitePage): Promise<{ id: string; heading: string; text: string }[]> {
    const file = path.join(PAGES_DIR, page.file);
    const stat = await fs.stat(file).catch(() => null);
    if (!stat) return [];
    const hit = siteCache.get(page.file);
    if (hit && hit.mtimeMs === stat.mtimeMs) return hit.sections;

    const raw = await fs.readFile(file, "utf8");
    const at = raw.search(/^template\s*$/m);
    const template = at >= 0 ? raw.slice(at) : "";
    const head = at >= 0 ? raw.slice(0, at) : raw;
    const stateBlock = /^state\s*$([\s\S]*?)(?=^\S)/m.exec(head)?.[1] ?? "";
    const stateText = [...stateBlock.matchAll(/"((?:[^"\\]|\\.){12,})"/g)].map((m) => m[1]).join(". ");

    const parts = template.split(/(?=<h2[\s>])/);
    const sections: { id: string; heading: string; text: string }[] = [];
    sections.push({ id: "", heading: "", text: `${page.description} ${tyxText(parts[0] ?? "")} ${stateText}` });
    let offset = (parts[0] ?? "").length;
    for (const part of parts.slice(1)) {
        const heading = tyxText(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(part)?.[1] ?? "");
        // The id of the nearest <section id="…"> that opens before this heading.
        const before = template.slice(0, offset);
        const ids = [...before.matchAll(/<section[^>]*\sid="([a-z0-9-]+)"/g)];
        const opened = ids.length ? ids[ids.length - 1] : null;
        const closedAfter = opened ? before.slice(opened.index!).includes("</section>") : true;
        sections.push({ id: opened && !closedAfter ? opened[1] : "", heading, text: tyxText(part.replace(/<h2[^>]*>[\s\S]*?<\/h2>/, " ")) });
        offset += part.length;
    }
    siteCache.set(page.file, { mtimeMs: stat.mtimeMs, sections });
    return sections;
}

function snippetAround(text: string, terms: string[]): string {
    const clean = text.replace(/\s+/g, " ").trim();
    const lower = clean.toLowerCase();
    const at = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0), Infinity);
    if (!Number.isFinite(at)) return clean.slice(0, 140);
    const start = Math.max(0, at - 50);
    return (start > 0 ? "…" : "") + clean.slice(start, start + 150) + (start + 150 < clean.length ? "…" : "");
}

// "whats new" finds "What's new": apostrophes are ignored on both sides.
const APOSTROPHES = /['\u2019]/g;

export async function search(query: string, limit = 12): Promise<SearchHit[]> {
    const terms = query.toLowerCase().replace(APOSTROPHES, "").split(/\s+/).filter((t) => t.length > 1).slice(0, 6);
    if (terms.length === 0) return [];

    const nav = await getNav();
    const scored: { hit: SearchHit; score: number }[] = [];

    for (const section of nav) {
        for (const item of section.items) {
            const entry = await load(item.slug);
            if (!entry) continue;
            const title = entry.page.title.toLowerCase().replace(APOSTROPHES, "");
            const desc = entry.page.description.toLowerCase().replace(APOSTROPHES, "");

            for (const s of entry.sections) {
                const heading = s.heading.toLowerCase().replace(APOSTROPHES, "");
                const text = s.text.toLowerCase().replace(APOSTROPHES, "");
                let score = 0;
                let all = true;
                for (const t of terms) {
                    let hit = 0;
                    if (title.includes(t)) hit += 6;
                    if (heading.includes(t)) hit += 8;
                    if (!s.heading && desc.includes(t)) hit += 3;
                    if (text.includes(t)) hit += 1 + Math.min(text.split(t).length - 1, 4) * 0.25;
                    if (hit === 0) all = false;
                    score += hit;
                }
                if (!all || score === 0) continue;
                if (!s.heading) score += 2; // the page itself ranks above its sections
                scored.push({
                    score,
                    hit: {
                        slug: item.slug,
                        page: entry.page.title,
                        section: section.title,
                        heading: s.heading,
                        anchor: s.id,
                        snippet: snippetAround(s.heading ? s.text : entry.page.description || s.text, terms),
                    },
                });
            }
        }
    }

    for (const page of SITE_PAGES) {
        const title = page.page.toLowerCase().replace(APOSTROPHES, "");
        for (const s of await sitePageSections(page)) {
            const heading = s.heading.toLowerCase().replace(APOSTROPHES, "");
            const text = s.text.toLowerCase().replace(APOSTROPHES, "");
            let score = 0;
            let all = true;
            for (const t of terms) {
                let hit = 0;
                // The page's own entry gets the title; its sections only count it a little,
                // so "what's new" lands on the page, not on a section with "new" in its heading.
                if (title.includes(t)) hit += s.heading ? 1 : 6;
                if (heading.includes(t)) hit += 8;
                if (text.includes(t)) hit += 1 + Math.min(text.split(t).length - 1, 4) * 0.25;
                if (hit === 0) all = false;
                score += hit;
            }
            if (!all || score === 0) continue;
            if (!s.heading) score += 2;
            scored.push({
                score,
                hit: {
                    slug: "",
                    href: page.href,
                    page: page.page,
                    section: page.section,
                    heading: s.heading,
                    anchor: s.id,
                    snippet: snippetAround(s.heading ? s.text : page.description || s.text, terms),
                },
            });
        }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.hit);
}
