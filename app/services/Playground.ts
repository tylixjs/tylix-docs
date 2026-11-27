/**
 * The playground's server side: builds visitors' projects with the real
 * Tylix compiler, in a worker thread (app/services/playground/).
 *
 *   compile(files)   one build: { ok, html, diagnostics, symbols, build, ms }
 *   starterFiles()   the Pixel Tasks project, from content/playground/
 *   iconNames()      every tylix-icons component, for autocomplete
 *   clientVersion()  a hash of public/playground/ (.js, .css), for their URLs
 *
 * One build at a time, in order. A build that runs past BUILD_TIMEOUT_MS
 * kills the worker (a fresh one starts for the next build) and fails with
 * PlaygroundUnavailable; a queue longer than MAX_QUEUE is refused the same
 * way, so a burst of requests can't pile up work.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";

const BUILD_TIMEOUT_MS = 10_000;
const MAX_QUEUE = 24;
const WORKER_URL = new URL("./playground/compileWorker.mjs", import.meta.url);
const STARTER_DIR = path.join(process.cwd(), "content", "playground", "pixel-tasks");

export type Diagnostic = {
    file: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    message: string;
    severity: "error" | "warning";
    origin?: string;
};

export type CompileResult = {
    ok: boolean;
    html?: string;
    diagnostics: Diagnostic[];
    symbols: Record<string, unknown>;
    build: string;
    ms: number;
};

export type ProjectFile = { path: string; content: string };

/** The project itself is wrong (too big, bad paths): the visitor can fix it. */
export class PlaygroundInvalid extends Error {}
/** The server can't build right now (busy, timed out, crashed). */
export class PlaygroundUnavailable extends Error {}

type Job = {
    id: number;
    files: unknown;
    resolve: (r: CompileResult) => void;
    reject: (e: Error) => void;
    timer?: NodeJS.Timeout;
};

type WorkerReply = { id: number; result?: CompileResult; error?: string; invalid?: boolean };

let worker: Worker | null = null;
let current: Job | null = null;
const queue: Job[] = [];
let nextId = 1;

function failCurrent(error: Error) {
    const job = current;
    current = null;
    if (job) {
        clearTimeout(job.timer);
        job.reject(error);
    }
}

function spawn(): Worker {
    const w = new Worker(WORKER_URL);
    w.unref();
    w.on("message", (reply: WorkerReply) => {
        const job = current;
        if (!job || reply.id !== job.id) return;
        clearTimeout(job.timer);
        current = null;
        if (reply.result) job.resolve(reply.result);
        else if (reply.invalid) job.reject(new PlaygroundInvalid(reply.error ?? "That project can't be built."));
        else job.reject(new PlaygroundUnavailable(reply.error ?? "The build failed."));
        pump();
    });
    w.on("error", (err) => {
        console.error("[playground] compiler worker crashed:", err);
        if (worker === w) worker = null;
        failCurrent(new PlaygroundUnavailable("The compiler stopped unexpectedly. Try again."));
        pump();
    });
    w.on("exit", () => {
        if (worker === w) worker = null;
    });
    return w;
}

function pump() {
    if (current || queue.length === 0) return;
    const job = queue.shift()!;
    current = job;
    worker ??= spawn();
    const w = worker;
    job.timer = setTimeout(() => {
        if (current !== job) return;
        void w.terminate();
        if (worker === w) worker = null;
        failCurrent(new PlaygroundUnavailable(`The build took longer than ${BUILD_TIMEOUT_MS / 1000} seconds and was stopped.`));
        pump();
    }, BUILD_TIMEOUT_MS);
    w.postMessage({ id: job.id, files: job.files });
}

export function compile(files: unknown): Promise<CompileResult> {
    if (queue.length >= MAX_QUEUE) {
        return Promise.reject(new PlaygroundUnavailable("The playground is busy. Try again in a few seconds."));
    }
    return new Promise((resolve, reject) => {
        queue.push({ id: nextId++, files, resolve, reject });
        pump();
    });
}

let starterCache: Promise<ProjectFile[]> | null = null;

async function readTree(dir: string, base = dir): Promise<ProjectFile[]> {
    const out: ProjectFile[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...(await readTree(full, base)));
        else out.push({ path: path.relative(base, full).split(path.sep).join("/"), content: await fs.readFile(full, "utf8") });
    }
    return out;
}

export function starterFiles(): Promise<ProjectFile[]> {
    // Re-read in development so edits to the starter show up on reload.
    if (process.env.NODE_ENV !== "production") return readTree(STARTER_DIR);
    starterCache ??= readTree(STARTER_DIR).catch((err) => {
        starterCache = null;
        throw err;
    });
    return starterCache;
}

let iconCache: Promise<string[]> | null = null;

export function iconNames(): Promise<string[]> {
    iconCache ??= fs
        .readFile(path.join(process.cwd(), "node_modules", "tylix-icons", "tylix-components.json"), "utf8")
        .then((text) => Object.keys(JSON.parse(text) as Record<string, string>).sort())
        .catch(() => []);
    return iconCache;
}

let versionCache: Promise<string> | null = null;

async function hashClientFiles(): Promise<string> {
    const dir = path.join(process.cwd(), "public", "playground");
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".js") || n.endsWith(".css")).sort();
    const hash = crypto.createHash("sha256");
    for (const name of names) hash.update(name).update(await fs.readFile(path.join(dir, name)));
    return hash.digest("hex").slice(0, 10);
}

/**
 * The page loads editor.js, workspace.js, highlight.js and playground.css
 * with ?v=<this>.
 * Their names never change, so without it a deploy could pair the new page
 * with the old modules from the browser cache, the CDN or the service worker.
 */
export function clientVersion(): Promise<string> {
    if (process.env.NODE_ENV !== "production") return hashClientFiles();
    versionCache ??= hashClientFiles().catch((err) => {
        versionCache = null;
        throw err;
    });
    return versionCache;
}

/** Builds the starter once at boot, so the first visitor gets a warm compiler. */
export function warmCompiler() {
    void starterFiles()
        .then((files) => compile(files))
        .catch((err) => console.error("[playground] warm-up build failed:", err));
}
