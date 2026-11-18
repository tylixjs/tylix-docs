/**
 * Controller: SiteController
 *
 *   GET /api/docs/nav              sidebar sections
 *   GET /api/docs/page/:slug       one rendered page (html, toc, prev/next)
 *   GET /api/docs/search?q=        ranked hits across every page
 *   GET /api/site/changelog        releases, from the Hub
 *   GET /api/site/status           state, 90-day uptime, announcements, from the Hub
 *
 * All public and read-only.
 */

import type { TylixRequest, TylixResponse } from "@tylix/core";
import { getDoc, getNav, getSnippets, search } from "../services/Docs.js";
import { changelog, status } from "../services/Hub.js";

function setHeader(res: TylixResponse, name: string, value: string) {
    const r = res as any;
    if (typeof r.setHeader === "function") r.setHeader(name, value);
    else if (typeof r.header === "function") r.header(name, value);
}

export class SiteController {
    async nav(_req: TylixRequest, res: TylixResponse) {
        setHeader(res, "Cache-Control", "public, max-age=60");
        return res.json({ data: await getNav() });
    }

    async page(req: TylixRequest, res: TylixResponse) {
        const doc = await getDoc(String(req.params.slug ?? "").toLowerCase());
        if (!doc) {
            res.status(404);
            return res.json({ error: "That page doesn't exist." });
        }
        setHeader(res, "Cache-Control", "public, max-age=60");
        return res.json({ data: doc });
    }

    async search(req: TylixRequest, res: TylixResponse) {
        const q = String(req.query?.q ?? "").slice(0, 100);
        return res.json({ data: await search(q) });
    }

    async snippets(_req: TylixRequest, res: TylixResponse) {
        setHeader(res, "Cache-Control", "public, max-age=300");
        return res.json({ data: await getSnippets() });
    }

    async changelog(_req: TylixRequest, res: TylixResponse) {
        try {
            const { value, stale } = await changelog();
            setHeader(res, "Cache-Control", "public, max-age=30");
            return res.json({ data: value, stale });
        } catch {
            res.status(503);
            return res.json({ error: "The changelog is unavailable right now." });
        }
    }

    async status(_req: TylixRequest, res: TylixResponse) {
        try {
            const { value, stale } = await status();
            setHeader(res, "Cache-Control", "public, max-age=30");
            return res.json({ data: value, stale });
        } catch {
            res.status(503);
            return res.json({ error: "Status is unavailable right now." });
        }
    }
}
