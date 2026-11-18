# Routes

web.ts is loaded at startup: publicRoutes(router) is open to everyone, protectedRoutes(router) requires a logged-in user (the framework adds the check). Any other file here that exports routes(router) is mounted too.

Command: `tylix make:api Invoice`

API routes live under /api/. Pages are served by the frontend.
