---
title: Queues, schedules & channels
description: Background jobs with retries and backoff, scheduled tasks, live channels over WebSockets, cache and mail.
---

```ts
import { dispatch, broadcast, cache } from "@tylix/core";

await dispatch("SendWelcomeEmail", { userId });       // run by npx tylix queue:work
await broadcast("chat", { text: "Deploy finished" }); // to clients of npx tylix channels:work
const stats = await cache.remember("stats", 60, computeStats);
```

## Jobs

```bash
npx tylix make:job SendInvoice
```

```js title="app/jobs/SendInvoice.js"
export const SendInvoice = {
  tries: 3,                       // attempts in total
  backoff: [10, 60, 300],         // seconds before each retry; or 30, or 'exponential'
  timeout: 120,                   // an attempt that takes longer counts as failed
  async handle(payload, job) {
    /* job.attempt is 1, 2, 3 */
  },
  async failed(payload, error) {
    /* once, after the last attempt */
  },
}
```

```ts
await dispatch("SendInvoice", { invoiceId }, { delay: 60 }); // run in a minute
```

`backoff` can be a number, a list, `"exponential"` or a function `(attempt) => seconds`. Throw a `PermanentJobError` to fail without retrying.

Defaults for every job go in `tylix.config` (`queue: { tries, backoff, timeout }`) or in `QUEUE_TRIES`, `QUEUE_BACKOFF` and `QUEUE_TIMEOUT`.

### Running workers

```bash
npx tylix queue:work          # stops gracefully on SIGTERM
npx tylix queue:failed        # list failed jobs
npx tylix queue:retry all     # or an id
npx tylix queue:flush         # delete failed jobs
```

Workers claim each job atomically, so several workers never run the same job.

## Scheduled tasks

Tasks in `app/schedule.ts` run under `npx tylix schedule:work`.

## Channels

```bash
npx tylix make:channel chat
npx tylix channels:work
```

`make:channel` writes a channel and a demo page. `broadcast()` from anywhere in the app relays through `npx tylix channels:work` to connected browsers.

## Cache and the shared store

```ts
const stats = await cache.remember("stats:home", 60, () => computeStats());
```

The cache, rate limits and channel messages live in one store, so several workers or servers act as one. `STORE_DRIVER` picks it: `database` (default, the app's own database), `redis` (heavy traffic, `REDIS_URL`, `npm install redis`) or `memory` (a single process only).

## Mail

```bash
npx tylix make:mail Welcome
```

`MAIL_DRIVER` picks the transport: `log` (development), `smtp`, `resend`, `sendgrid`, `postmark`, `mailgun` or `ses`. `@tylix/mail` also works in any Node app.
