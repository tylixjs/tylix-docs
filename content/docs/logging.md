---
title: Logging & observability
description: Laravel-style log channels, request ids, slow-request and slow-query warnings, Prometheus metrics and health checks.
---

## Log channels

```ts
import { Log } from "@tylix/core";

Log.info("Invoice sent", { invoiceId: 12 });
Log.warning("Disk almost full", { pct: 91 });
Log.channel("payments").error("Charge failed", { error });
Log.stack(["daily", "slack"]).critical("Payments are down");
Log.withContext({ tenant: 3 }); // added to every later entry
```

The eight levels are `debug`, `info`, `notice`, `warning`, `error`, `critical`, `alert` and `emergency`.

The default `stack` channel writes to the console and to a daily file, `storage/logs/tylix-2026-11-15.log`:

```text
[2026-11-15 10:22:01] production.ERROR: Charge failed {"orderId":7} {"requestId":"4d36..."}
[stacktrace]
Error: card declined
    at ...
```

### Configuring channels

```ts title="tylix.config.ts"
logging: {
  default: "stack",                                                   // LOG_CHANNEL
  channels: {
    stack: { driver: "stack", channels: ["console", "daily"] },      // LOG_STACK
    daily: { driver: "daily", path: "storage/logs/tylix.log", days: 14 }, // LOG_DAILY_DAYS
    payments: { driver: "single", path: "storage/logs/payments.log", level: "warning" },
    slack: { driver: "custom", via: (config) => ({ write(entry) { /* send it */ } }) },
  },
}
```

The drivers are `stack`, `single`, `daily`, `console`, `stderr`, `null` and `custom`, plus any registered with `Log.extend("name", factory)` or added by a plugin.

```bash
npx tylix log:tail payments --level=error
npx tylix log:clear
```

## Requests

- Every request gets an id (`X-Request-Id`), and log lines written while it runs carry it.
- Logs are JSON lines in production and readable lines in development (`LOG_FORMAT`).
- Requests slower than `SLOW_REQUEST_MS` and queries slower than `SLOW_QUERY_MS` are logged as warnings.

## Metrics and health

```ts
import { metrics, addReadinessCheck } from "@tylix/core";

metrics.counter("invoices_sent_total", "Invoices sent").inc();
addReadinessCheck("payments", () => paymentsApi.ping());
```

| Endpoint | |
| --- | --- |
| `/health` | Always on: the process is alive |
| `/ready` | Always on: every readiness check passes |
| `/metrics` | Prometheus format, with `METRICS=true`. Guarded by `METRICS_TOKEN` (`Authorization: Bearer …`), or local-only without it |
