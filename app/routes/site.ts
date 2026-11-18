import type { Router } from "@tylix/core";
import { SiteController } from "../controllers/SiteController.js";
import { warmHighlighter } from "../services/Markdown.js";
import { search } from "../services/Docs.js";

export async function routes(router: Router) {
    const site = new SiteController();

    router.get("/api/docs/nav", (req, res) => site.nav(req, res));
    router.get("/api/docs/page/:slug", (req, res) => site.page(req, res));
    router.get("/api/docs/search", (req, res) => site.search(req, res));
    router.get("/api/site/snippets", (req, res) => site.snippets(req, res));
    router.get("/api/site/changelog", (req, res) => site.changelog(req, res));
    router.get("/api/site/status", (req, res) => site.status(req, res));

    // Render every page once at boot so the first search and page view are fast.
    warmHighlighter();
    void search("tylix").catch((err) => console.error("[docs] warm-up failed:", err));
}
