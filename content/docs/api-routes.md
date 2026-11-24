---
title: API routes & controllers
description: Register routes in app/routes, handle them in controllers, and protect them with auth in one wrapper.
---

## Defining routes

`app/routes/web.ts` has two exports. Routes in `publicRoutes` are open to everyone. Routes in `protectedRoutes` require a signed-in user.

```ts title="app/routes/web.ts"
import type { Router } from "@tylix/core";
import { InvoiceController } from "../controllers/InvoiceController.js";

export async function publicRoutes(router: Router) {
  router.get("/api/plans", (req, res) => res.json({ data: PLANS }));
}

export async function protectedRoutes(router: Router) {
  const invoices = new InvoiceController();

  router.get("/api/invoices", (req, res) => invoices.index(req, res));
  router.post("/api/invoices", (req, res) => invoices.store(req, res));
  router.get("/api/invoices/:id", (req, res) => invoices.show(req, res));
  router.delete("/api/invoices/:id", (req, res) => invoices.destroy(req, res));
}
```

Every other file in `app/routes` is loaded too. Each exports `routes(router, { auth })`, and `auth(handler)` protects a single route:

```ts title="app/routes/admin.ts"
import type { Router } from "@tylix/core";

export async function routes(router: Router, { auth }) {
  router.get("/api/admin/stats", auth((req, res) => res.json(stats(req.user))));
}
```

The router supports `get`, `post`, `put`, `patch` and `delete`. Routes are looked up by path segment, so the cost doesn't grow with the number of routes. When two routes match, the one registered first wins.

## Controllers

```bash
npx tylix make:controller Invoice
```

```ts title="app/controllers/InvoiceController.ts"
import type { TylixRequest, TylixResponse } from "@tylix/core";
import { Invoice } from "../models/Invoice.js";

export class InvoiceController {
  async show(req: TylixRequest, res: TylixResponse) {
    const invoice = await Invoice.find(req.params.id);
    if (!invoice || invoice.user_id !== req.user?.userId) {
      res.status(404);
      return res.json({ error: "Invoice not found." });
    }
    return res.json({ data: invoice });
  }
}
```

| On `req` | |
| --- | --- |
| `req.params` | Path parameters (`:id`) |
| `req.query` | Query string |
| `req.body` | Parsed JSON body |
| `req.user` | `{ userId, … }` on protected routes |
| `req.id` | The request id, also sent as `X-Request-Id` |

## What every response gets

- Security headers, cross-site write protection and a Content-Security-Policy (`CSP_MODE`).
- Compression for JSON of 1 KB or more, when the client accepts it.
- A request id, carried by every log line written while the request runs.
- A warning in the log when the request is slower than `SLOW_REQUEST_MS`.

## Rate limits

```ts
import { createRateLimiter } from "@tylix/core";

const limit = createRateLimiter({ name: "login", max: 5, windowMs: 60_000, store: "shared" });

if (!(await limit(req.ip)).allowed) {
  res.status(429);
  return res.json({ error: "Too many attempts." });
}
```

With `store: "shared"`, every worker and server counts together through the [shared store](/docs/configuration#scaling-and-observability). Without it, a limiter counts in its own process and answers synchronously.

## Testing routes

```ts title="tests/invoices.test.ts"
import { createTestClient } from "@tylix/cli/testing";

const client = await createTestClient();
const res = await client.get("/api/invoices", { as: user });
```

The test client calls your routes in-process, with no server running.
