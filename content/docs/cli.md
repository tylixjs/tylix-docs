---
title: CLI
description: The tylix command covers the dev and production servers, builds, migrations, generators, workers and diagnostics.
---

New apps from `create-tylix` already have the CLI. Run it with `npx tylix`, or through the scripts in `package.json`.

## Run

| Command | |
| --- | --- |
| `npx tylix dev [--port 3000]` | Development server with hot reload |
| `npx tylix build` | Production build: pages, TypeScript, the frontend bundle. Checks every `.tyx` file first |
| `npx tylix start [--port 3000] [--workers N\|auto]` | Production server. With workers: one process per core sharing the port, replaced when one crashes |
| `npx tylix check` | Parse and typecheck every `.tyx` file |
| `npx tylix export [--out dir]` | Static site: every page and its assets in `dist/static` |
| `npx tylix doctor` | Check the project, settings (and where each comes from), database and frontend |
| `npx tylix tinker [--eval "..."]` | A REPL with your models, services and routes |

## Database

| Command | |
| --- | --- |
| `npx tylix migrate` | Run new migrations, as one batch |
| `npx tylix migrate:status` | Which migrations have run, and in which batch |
| `npx tylix migrate:rollback [--step=N]` | Undo the last batch, or the last N migrations |
| `npx tylix migrate:reset` | Undo every migration |
| `npx tylix migrate:refresh [--seed]` | Undo and migrate again |
| `npx tylix migrate:fresh [--seed]` | Drop every table and migrate (`--force` in production) |
| `npx tylix db:seed` | Run `app/seeders` |

## Workers

| Command | |
| --- | --- |
| `npx tylix queue:work` | Run queued jobs with retries and backoff. Stops gracefully on SIGTERM |
| `npx tylix queue:failed` · `queue:retry <id\|all>` · `queue:flush` | List, retry or delete failed jobs |
| `npx tylix schedule:work` | Run `app/schedule` tasks |
| `npx tylix channels:work` | WebSocket channel server. Relays `broadcast()` from the app |
| `npx tylix log:tail [channel] [--level=error]` · `log:clear` | Follow or empty the log files |

## Make things

| Command | Creates |
| --- | --- |
| `npx tylix make:feature Invoice title:string total:number` | Model, migration, validator, CRUD API |
| `npx tylix make:migration add_status_to_posts_table status:string:index` | A migration, named for what it does |
| `npx tylix make:model` · `make:controller` · `make:validator` · `make:service` · `make:api` | One piece at a time |
| `npx tylix make:page Reports [--auth]` | A page and its route, in your frontend's own format |
| `npx tylix make:component StatCard` | A component for your frontend |
| `npx tylix make:job SendInvoice` | A background job |
| `npx tylix make:observer Audit --model User` | Model lifecycle hooks, enabled on the model |
| `npx tylix make:trait HasSlug` | Reusable model behaviour |
| `npx tylix make:channel chat` | A channel and a demo page |
| `npx tylix make:mail Welcome` · `make:auth` · `make:icon` | Mail, auth, icons |
| `npx tylix make:permissions` | [Roles and permissions](/docs/permissions) |
| `npx tylix make:pwa` | An [installable app](/docs/pwa) |
| `npx tylix make:queue-retries` | The `available_at` column retries need (apps made before 2.0) |
| `npx tylix field:add` · `field:remove` | Change a feature's fields with a migration |

Fields take modifiers after their type: `slug:string:unique`, `status:string:index:required:default=draft`, `bio:text:nullable`.

## Routes, plugins and deploys

| Command | |
| --- | --- |
| `npx tylix routes:types [--check]` | Write the [typed API client](/docs/typed-api-client). `--check` fails CI when it's stale |
| `npx tylix plugins` | The plugins loaded and what each adds |
| `npx tylix deploy:init <adapter> [--force]` | Deployment files. See [Deployment](/docs/deployment) |

Commands that plugins add run as `tylix <command>`.

## tylix check

`npx tylix check` reports every problem in your `.tyx` pages, components, layouts and capabilities with its file, line and column, and exits with code 1 when there are any.

```bash
npx tylix check                    # pretty output
npx tylix check --format=json      # for scripts
npx tylix check --format=github    # annotations on pull requests
npx tylix check --no-typecheck     # parse only
```

In TypeScript projects it typechecks too.
