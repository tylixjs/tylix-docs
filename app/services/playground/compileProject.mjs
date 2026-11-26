// Compiles a playground project (an in-memory map of files) with the real
// Tylix compiler, the same steps `tylix dev` takes for a page on disk:
//
//   1. diagnoseTyx() on every .tyx file (syntax, imports, TypeScript)
//   2. app/pages/Home.tyx is the page; app/pages/_layout.tyx wraps it
//   3. every app/pages/components/**/*.tyx is registered by file name,
//      and relative imports resolve against the in-memory files
//   4. app/capabilities/*.tyx compile to defineCapability() calls
//   5. renderPageDocument() writes the HTML document
//
// Nothing here runs the visitor's code. The compiler only parses and
// generates JavaScript (its `new Function` calls are syntax checks that are
// never invoked). The document runs in the visitor's own browser, in a
// sandboxed iframe with an opaque origin.
//
// Plain .mjs (not .ts) so it loads the same way in a worker thread, in
// dev, in production and in tests.

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    diagnoseTyx,
    extractImports,
    resolveImportedComponents,
    renderPageDocument,
    Parser,
    Lexer,
    generateCapability,
} from "@tylix/compiler";

const here = path.dirname(fileURLToPath(import.meta.url));
// The docs project root, where node_modules/tylix-icons lives.
const DOCS_ROOT = path.resolve(here, "..", "..", "..");
// Paths that never exist, so renderPageDocument uses its built-in shell
// and reads nothing of the docs site's own app/ folder.
const NOWHERE = path.join(DOCS_ROOT, "storage", "playground-none");

export const ENTRY_PAGE = "app/pages/Home.tyx";
export const LAYOUT_FILE = "app/pages/_layout.tyx";
export const STYLES_FILE = "public/styles.css";

export const LIMITS = {
    files: 40,
    fileBytes: 60_000,
    totalBytes: 200_000,
};

// Package components the playground can import. Only packages installed in
// the docs site and meant for pages.
const ALLOWED_PACKAGES = new Set(["tylix-icons"]);

const PATH_RE = /^(?:[A-Za-z0-9_][A-Za-z0-9_.\-]*\/)*[A-Za-z0-9_][A-Za-z0-9_.\-]*$/;

export class ProjectError extends Error {}

// Checks shape and size. Returns a Map of path -> text.
export function normalizeFiles(input) {
    if (!Array.isArray(input)) throw new ProjectError("Send files as a list of { path, content }.");
    if (input.length === 0) throw new ProjectError("The project has no files.");
    if (input.length > LIMITS.files) throw new ProjectError(`A playground project can have up to ${LIMITS.files} files.`);

    const files = new Map();
    let total = 0;
    for (const entry of input) {
        const p = typeof entry?.path === "string" ? entry.path.trim() : "";
        const content = typeof entry?.content === "string" ? entry.content : null;
        if (!p || content === null) throw new ProjectError("Every file needs a path and text content.");
        if (p.length > 160 || !PATH_RE.test(p) || p.split("/").some((s) => s === "." || s === "..")) {
            throw new ProjectError(`"${p.slice(0, 80)}" is not a valid file path.`);
        }
        if (files.has(p)) throw new ProjectError(`${p} is in the project twice.`);
        const bytes = Buffer.byteLength(content, "utf8");
        if (bytes > LIMITS.fileBytes) throw new ProjectError(`${p} is too big for the playground (${Math.round(LIMITS.fileBytes / 1000)} KB per file).`);
        total += bytes;
        files.set(p, content);
    }
    if (total > LIMITS.totalBytes) throw new ProjectError(`The project is too big for the playground (${Math.round(LIMITS.totalBytes / 1000)} KB in all).`);
    return files;
}

function diag(file, message, line = 1, column = 1, extra = {}) {
    return { file, line, column, endLine: line, endColumn: column + 1, message, severity: "error", origin: "build", ...extra };
}

// "In component <TaskCard>: Unexpected ... at line 4" -> a diagnostic on
// the right file when the message says which one.
function diagnosticFromError(err, componentFiles) {
    const message = String(err?.message ?? err).replace(/\s+\(looked for [^)]*\)/, "");
    let file = ENTRY_PAGE;
    const comp = /^In component <([^>]+)>:\s*/.exec(message);
    if (comp && componentFiles.has(comp[1])) file = componentFiles.get(comp[1]);
    else if (/^In _layout\.tyx:/.test(message)) file = LAYOUT_FILE;
    const capability = /^In (app\/capabilities\/[^:]+):/.exec(message);
    if (capability) file = capability[1];
    const lineMatch = /at line (\d+)/.exec(message) ?? /line (\d+)/.exec(message);
    const clean = message.replace(/^In (component <[^>]+>|_layout\.tyx|app\/capabilities\/[^:]+):\s*/, "");
    return diag(file, clean, lineMatch ? Number(lineMatch[1]) : 1);
}

function isTyx(p) {
    return p.endsWith(".tyx");
}

// Mirrors createApp's loadComponents: every .tyx under
// app/pages/components/, keyed by its base name (shallowest wins).
function discoverComponents(files) {
    const byBase = new Map();
    for (const p of files.keys()) {
        if (!p.startsWith("app/pages/components/") || !isTyx(p)) continue;
        const base = path.posix.basename(p, ".tyx");
        const depth = p.split("/").length;
        const current = byBase.get(base);
        if (!current || depth < current.depth) byBase.set(base, { path: p, depth });
    }
    return new Map([...byBase].map(([name, v]) => [name, v.path]));
}

// Resolves one file's imports against the in-memory project. Local imports
// become other playground files; package imports go to the real package
// resolver (tylix-icons). Returns { source, components } with the import
// lines blanked out, like extractImports.
async function expandFile(files, filePath, stack, components, owners) {
    const raw = files.get(filePath);
    const { imports, source } = extractImports(raw);

    const add = (name, text, from) => {
        if (Object.hasOwn(components, name) && components[name] !== text) {
            throw new Error(`"${name}" is provided by both ${owners[name]} and ${from}`);
        }
        components[name] = text;
        owners[name] = from;
    };

    for (const imp of imports) {
        if (imp.kind === "local") {
            let target = path.posix.normalize(path.posix.join(path.posix.dirname(filePath), imp.specifier));
            if (!path.posix.extname(target)) target += ".tyx";
            if (target.startsWith("..") || !files.has(target)) {
                throw new ImportError(filePath, imp.line, `Can't find "${imp.specifier}" (looked for ${target})`);
            }
            if (stack.includes(target)) {
                throw new ImportError(filePath, imp.line, `Circular import: ${[...stack, target].join(" -> ")}`);
            }
            const nested = await expandFile(files, target, [...stack, target], components, owners);
            add(imp.names[0].local, nested, target);
            continue;
        }
        if (!ALLOWED_PACKAGES.has(imp.specifier)) {
            throw new ImportError(filePath, imp.line, `The playground can import components from ${[...ALLOWED_PACKAGES].join(", ")} only, not "${imp.specifier}"`);
        }
        try {
            const resolved = await resolveImportedComponents([imp], {
                baseDir: DOCS_ROOT,
                fromFile: path.join(DOCS_ROOT, "app", "pages", "index.tyx"),
            });
            for (const [name, text] of Object.entries(resolved)) add(name, text, imp.specifier);
        } catch (err) {
            throw new ImportError(filePath, imp.line, String(err?.message ?? err).replace(/\s*\(checked [^)]*\)/, ""));
        }
    }
    return source;
}

class ImportError extends Error {
    constructor(file, line, message) {
        super(message);
        this.file = file;
        this.line = line;
    }
}

// A <PascalCase> tag that isn't a registered component compiles, then
// renders nothing (with a console warning). Point at the line instead.
function unknownComponentWarnings(files, components) {
    const out = [];
    for (const [p, text] of files) {
        if (!isTyx(p) || p.startsWith("app/capabilities/")) continue;
        const lines = text.split("\n");
        const start = lines.findIndex((l) => /^template\s*$/.test(l));
        if (start === -1) continue;
        for (let i = start + 1; i < lines.length; i++) {
            if (/^(style)\s*$/.test(lines[i])) break;
            const re = /<([A-Z][A-Za-z0-9_]*)[\s/>]/g;
            let m;
            while ((m = re.exec(lines[i]))) {
                const name = m[1];
                if (Object.hasOwn(components, name)) continue;
                const hint = name.startsWith("Icon")
                    ? `import { ${name} } from "tylix-icons" at the top of the file, if it's an icon`
                    : `create app/pages/components/${name}.tyx (starting with "component ${name}")`;
                out.push(diag(p, `<${name}> isn't a component in this project yet: ${hint}.`, i + 1, m.index + 2, {
                    endColumn: m.index + 2 + name.length,
                    severity: "warning",
                    origin: "components",
                }));
            }
        }
    }
    return out;
}

// Runs the compiler's own diagnostics on every .tyx file. Returns
// { diagnostics, symbols } where symbols is { [path]: outline }.
export function diagnoseProject(files, { typecheck = true } = {}) {
    const diagnostics = [];
    const symbols = {};
    for (const [p, text] of files) {
        if (!isTyx(p)) continue;
        let result;
        try {
            result = diagnoseTyx(text, { typecheck, language: {} });
        } catch (err) {
            diagnostics.push(diag(p, String(err?.message ?? err)));
            continue;
        }
        if (result.kind === "other") {
            diagnostics.push(diag(p, "A .tyx file starts with page, component or capability, then its name.", 1, 1, { origin: "syntax" }));
            continue;
        }
        symbols[p] = { kind: result.kind, name: result.name, symbols: result.symbols ?? [] };
        if (p.startsWith("app/capabilities/") && result.kind !== "capability") {
            diagnostics.push(diag(p, `Files in app/capabilities/ start with "capability ${path.posix.basename(p, ".tyx")}".`, 1, 1, { origin: "syntax" }));
        }
        if (p.startsWith("app/pages/components/") && result.kind !== "component") {
            diagnostics.push(diag(p, `Files in app/pages/components/ start with "component ${path.posix.basename(p, ".tyx")}".`, 1, 1, { origin: "syntax" }));
        }
        for (const d of result.diagnostics) {
            diagnostics.push({ ...d, file: p, severity: "error" });
        }
    }
    return { diagnostics, symbols };
}

// The whole build. Returns
//   { ok: true, html, diagnostics: [], symbols, ms }
//   { ok: false, diagnostics, symbols, ms }
export async function compileProject(input, { typecheck = true, bridge = "" } = {}) {
    const started = performance.now();
    const files = input instanceof Map ? input : normalizeFiles(input);
    const done = (result) => ({ ...result, ms: Math.round(performance.now() - started) });

    const { diagnostics, symbols } = diagnoseProject(files, { typecheck });

    if (!files.has(ENTRY_PAGE)) {
        diagnostics.push(diag(ENTRY_PAGE, "The preview shows app/pages/Home.tyx. Add it back (or reset the project)."));
    } else if (symbols[ENTRY_PAGE] && symbols[ENTRY_PAGE].kind !== "page") {
        diagnostics.push(diag(ENTRY_PAGE, 'Home.tyx is the page the preview shows, so it starts with "page Home".'));
    }
    if (diagnostics.length > 0) return done({ ok: false, diagnostics, symbols });

    const componentFiles = discoverComponents(files);
    try {
        const components = {};
        const owners = {};

        // Discovered components first; explicit imports (below) win.
        const discovered = {};
        for (const [name, p] of componentFiles) {
            discovered[name] = await expandFile(files, p, [p], components, owners);
        }
        Object.assign(components, discovered);

        const page = await expandFile(files, ENTRY_PAGE, [ENTRY_PAGE], components, owners);
        const layout = files.has(LAYOUT_FILE) ? await expandFile(files, LAYOUT_FILE, [LAYOUT_FILE], components, owners) : null;

        const capabilities = [];
        for (const [p, text] of files) {
            if (!p.startsWith("app/capabilities/") || !isTyx(p)) continue;
            try {
                const node = new Parser(new Lexer(text).tokenize(), {}).parseCapability();
                capabilities.push(generateCapability(node));
            } catch (err) {
                err.message = `In ${p}: ${err.message}`;
                throw err;
            }
        }

        const css = files.get(STYLES_FILE) ?? "";
        const styleTag = css.trim() ? `<style>\n${css.replace(/<\/(style)/gi, "<\\/$1")}\n</style>` : "";

        let html = await renderPageDocument(page, components, {
            layout,
            apiHelpers: capabilities.join("\n\n"),
            stylesheets: [],
            capabilitiesDir: NOWHERE,
            headFile: path.join(NOWHERE, "head.html"),
            shellFile: path.join(NOWHERE, "index.html"),
            loadingFile: path.join(NOWHERE, "loading.tyx"),
            extraHead: styleTag,
            loadingBar: false,
            loadingScreen: false,
            language: {},
        });

        // The built-in shell links /favicon.png, which means nothing here.
        html = html.replace(/\s*<link rel="icon"[^>]*>/, "");
        if (bridge) html = html.replace(/<head>/i, () => `<head>\n  <script>${bridge}</script>`);
        return done({ ok: true, html, diagnostics: unknownComponentWarnings(files, components), symbols });
    } catch (err) {
        const d = err instanceof ImportError
            ? diag(err.file, err.message, err.line)
            : diagnosticFromError(err, new Map([...componentFiles].map(([name, p]) => [name, p])));
        return done({ ok: false, diagnostics: [d], symbols });
    }
}
