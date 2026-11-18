---
title: Upgrading from 1.x
description: Moving an app from Tylix 1.x to 2.x. Two commands, and nothing you have to rewrite.
---

```bash
npm install @tylix/cli@^2 @tylix/core@^2 @tylix/orm@^2 @tylix/shared@^2
npx tylix make:queue-retries && npx tylix migrate
```

Upgrade any other `@tylix/*` package you use to `^2` as well. The second line runs once: it adds the `available_at` column that job delays need.

## What changed

### `app/frontend` is now `app/views`

This applies to React, Vue, Svelte and Angular apps. Nothing has to move: when only `app/frontend` exists, every command uses it. To rename it, also change `app/frontend` in your `package.json` scripts and your Tailwind `content` globs.

### Logs also go to files

The default `stack` channel writes to the console **and** to `storage/logs/tylix-<date>.log`. Add `storage/logs/*.log` to `.gitignore`, or set `LOG_STACK=console` where files aren't wanted (containers, read-only disks).

### Jobs

Jobs keep running once each, as before, unless a job or `queue` in `tylix.config` sets `tries`. Until the `available_at` migration runs, retries happen immediately and `dispatch(..., { delay })` throws.

### Migrations

Migrations you already have run unchanged, and columns are still nullable unless you say `notNullable()`. The `migrations` table gets a `batch` column the first time `tylix migrate` runs.

### Typed API client

`tylix dev` now writes a typed client (`app/views/api.generated.ts`, or `app/types/api.d.ts` for native pages). Set `typedRoutes: false` in `tylix.config` to turn that off.

### create-tylix

There is no Blank template any more: `--template blank` creates the Starter App. Since 2.1 every app includes authentication and a database, so `--auth no` and `--database none` no longer apply.
