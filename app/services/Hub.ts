/**
 * Reads changelog, status, uptime and announcements for Tylix from the
 * Ashmif Hub public API. The Hub owns this data; the docs site only shows it.
 *
 *   HUB_URL       where the Hub runs          (default http://localhost:3001)
 *   HUB_PRODUCT   the product's slug there    (default tylix)
 *
 * Answers are cached for 60 seconds. If the Hub can't be reached, the last
 * good answer is served (marked stale) rather than an error.
 */

import { renderMarkdown } from "./Markdown.js";

const HUB_URL = (process.env.HUB_URL ?? "http://localhost:3001").replace(/\/$/, "");
const PRODUCT = encodeURIComponent(process.env.HUB_PRODUCT ?? "tylix");
const TTL_MS = 60_000;
const TIMEOUT_MS = 4_000;

type Entry<T> = { at: number; value: T };
const cache = new Map<string, Entry<unknown>>();

export class HubUnavailable extends Error {}

async function fetchJson<T>(pathname: string): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${HUB_URL}${pathname}`, { signal: ctrl.signal, headers: { accept: "application/json" } });
        if (!res.ok) throw new HubUnavailable(`Hub answered ${res.status} for ${pathname}`);
        return (await res.json()) as T;
    } catch (err) {
        if (err instanceof HubUnavailable) throw err;
        throw new HubUnavailable(`Hub unreachable: ${(err as Error).message}`);
    } finally {
        clearTimeout(timer);
    }
}

/** Cached fetch. Returns { value, stale }. Throws only when there's nothing cached. */
async function cached<T>(key: string, load: () => Promise<T>): Promise<{ value: T; stale: boolean }> {
    const hit = cache.get(key) as Entry<T> | undefined;
    if (hit && Date.now() - hit.at < TTL_MS) return { value: hit.value, stale: false };
    try {
        const value = await load();
        cache.set(key, { at: Date.now(), value });
        return { value, stale: false };
    } catch (err) {
        if (hit) return { value: hit.value, stale: true };
        throw err;
    }
}

export interface ChangelogRelease {
    id: number;
    version: string;
    title: string;
    category: string;
    published_at: string;
    html: string;
}

export function changelog() {
    return cached("changelog", async () => {
        const res = await fetchJson<{ data: { id: number; version: string; title: string; body: string; category: string; published_at: string }[] }>(
            `/api/v1/products/${PRODUCT}/changelog?limit=100`,
        );
        const releases: ChangelogRelease[] = [];
        for (const e of res.data) {
            const { html } = await renderMarkdown(e.body ?? "", { anchors: false });
            releases.push({ id: e.id, version: e.version, title: e.title, category: e.category, published_at: e.published_at, html });
        }
        return releases;
    });
}

export interface StatusReport {
    state: "operational" | "outage" | "unknown";
    last_seen_at: string | null;
    uptime_percent: number | null;
    days: { day: string; uptime_percent: number | null; down_minutes: number }[];
    announcements: {
        id: number;
        kind: string;
        title: string;
        html: string;
        phase: "active" | "upcoming" | "resolved";
        starts_at: string | null;
        ends_at: string | null;
    }[];
}

export function status() {
    return cached("status", async (): Promise<StatusReport> => {
        const [s, u, a] = await Promise.all([
            fetchJson<{ status: { state: StatusReport["state"]; last_seen_at: string | null } }>(`/api/v1/products/${PRODUCT}/status`),
            fetchJson<{ uptime: { uptime_percent: number | null; days: StatusReport["days"] } }>(`/api/v1/products/${PRODUCT}/uptime?days=90`),
            fetchJson<{ data: { id: number; kind: string; title: string; body: string; phase: StatusReport["announcements"][number]["phase"]; starts_at: string | null; ends_at: string | null }[] }>(
                `/api/v1/products/${PRODUCT}/announcements`,
            ),
        ]);
        const announcements: StatusReport["announcements"] = [];
        for (const row of a.data) {
            const { html } = await renderMarkdown(row.body ?? "", { anchors: false });
            announcements.push({ id: row.id, kind: row.kind, title: row.title, html, phase: row.phase, starts_at: row.starts_at, ends_at: row.ends_at });
        }
        return {
            state: s.status.state,
            last_seen_at: s.status.last_seen_at,
            uptime_percent: u.uptime.uptime_percent,
            days: u.uptime.days,
            announcements,
        };
    });
}
