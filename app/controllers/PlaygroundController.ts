/**
 * Controller: PlaygroundController
 *
 *   GET  /api/playground/starter    the Pixel Tasks project files
 *   GET  /api/playground/meta       the client modules' version, and icon names for autocomplete
 *   POST /api/playground/compile    { files: [{ path, content }] } -> a build
 *
 * Public: no account needed. A build only parses and generates code on the
 * server (see app/services/playground/compileProject.mjs); the result runs
 * in the visitor's browser, in a sandboxed iframe.
 */

import { createRateLimiter, type TylixRequest, type TylixResponse } from "@tylix/core";
import { clientVersion, compile, iconNames, starterFiles, PlaygroundInvalid, PlaygroundUnavailable } from "../services/Playground.js";

// Auto-run sends a build roughly once per pause in typing.
const limit = createRateLimiter({ max: 90, windowMs: 60_000 }) as (key: string) => { allowed: boolean; retryAfterSeconds: number };

function setHeader(res: TylixResponse, name: string, value: string) {
    res.setHeader(name, value);
}

function clientKey(req: TylixRequest): string {
    const ip = Reflect.get(req, "ip");
    return typeof ip === "string" && ip ? ip : String(req.socket?.remoteAddress ?? "unknown");
}

export class PlaygroundController {
    async starter(_req: TylixRequest, res: TylixResponse) {
        setHeader(res, "Cache-Control", "public, max-age=300");
        return res.json({ data: { name: "pixel-tasks", files: await starterFiles() } });
    }

    async meta(_req: TylixRequest, res: TylixResponse) {
        // Revalidated on every visit: it carries the version the page loads
        // the editor modules with, which changes on deploy.
        setHeader(res, "Cache-Control", "no-cache");
        const [version, icons] = await Promise.all([clientVersion(), iconNames()]);
        return res.json({ data: { version, icons } });
    }

    async compile(req: TylixRequest, res: TylixResponse) {
        const verdict = limit(clientKey(req));
        if (!verdict.allowed) {
            setHeader(res, "Retry-After", String(verdict.retryAfterSeconds));
            res.status(429);
            return res.json({ error: `That's a lot of builds. Try again in ${verdict.retryAfterSeconds} seconds.` });
        }

        try {
            const result = await compile(req.body?.files);
            return res.json({ data: result });
        } catch (err) {
            if (err instanceof PlaygroundInvalid) {
                res.status(422);
                return res.json({ error: err.message });
            }
            if (err instanceof PlaygroundUnavailable) {
                res.status(503);
                return res.json({ error: err.message });
            }
            console.error("[playground] build failed:", err);
            res.status(500);
            return res.json({ error: "The build failed on the server. Try again." });
        }
    }
}
