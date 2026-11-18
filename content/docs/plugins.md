---
title: Plugins
description: Add middleware, routes, log drivers, CLI commands and deployment adapters from one object.
---

```js title="app/plugins/audit.js"
import { definePlugin } from "@tylix/core";

export default definePlugin({
  name: "audit",
  config(config) {
    return { observability: { ...config.observability, slowRequestMs: 500 } };
  },
  register({ use, logger }) {
    use((req, res, next) => next()); // middleware
  },
  routes(router, { auth }) {
    router.get("/api/audit", auth(listAudit));
  },
  boot(app) {},
  close() {},
  logDrivers: { slack: (config) => ({ write(entry) {} }) },
  commands: { "audit:prune": { description: "Delete old rows", run(args) {} } },
  deployAdapters: {
    mycloud: { name: "mycloud", label: "My Cloud", files: () => ({ "mycloud.json": "{}" }) },
  },
});
```

## Hooks

| Hook | Runs |
| --- | --- |
| `config(config)` | Before start. Return changes to the settings |
| `register({ use, logger })` | Add middleware |
| `routes(router, { auth })` | Add routes, after the app's own routes |
| `boot(app)` | Once the server is up |
| `close()` | On shutdown |

A plugin can also add `logDrivers`, `commands` (run as `tylix <name>`) and `deployAdapters`.

## Loading plugins

```ts title="tylix.config.ts"
export default defineConfig({
  plugins: [
    audit(),                          // a plugin object
    "@acme/tylix-plugin",             // a package
    "./plugins/billing.js",           // a file
    ["@acme/tylix-cors", { origin: "https://example.com" }], // with options
  ],
});
```

Files in `app/plugins/` are loaded after those. Plugin routes come after the app's own routes, so the app can override them.

```bash
tylix plugins   # what each plugin adds
```
