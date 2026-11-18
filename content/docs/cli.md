---
title: CLI
description: The tylix command covers the dev and production servers, builds, migrations, generators, workers and diagnostics.
---

New apps from `create-tylix` already have the CLI. Run it with `npx tylix`, or through the scripts in `package.json`.

## Run

| Command | |
| --- | --- |
| `tylix dev [--port 3000]` | Development server with hot reload |
| `tylix build` | Production build: pages, TypeScript, the frontend bundle. Checks every `.tyx` file first |
| `tylix start [--port 3000] [--workers N\|auto]` | Production server. With workers: one process per core sharing the port, replaced when one crashes |
| `tylix check` | Parse and typecheck every `.tyx` file |
| `tylix export [--out dir]` | Static site: every page and its assets in `dist/static` |
| `tylix doctor` | Check the project, settings (and where each comes from), database and frontend |
| `tylix tinker [--eval "..."]` | A REPL with your models, services and routes |

## Database

| Command | |
| --- | --- |
| `tylix migrate` | Run new migrations, as one batch |
| `tylix migrate:status` | Which migrations have run, and in which batch |
| `tylix migrate:rollback [--step=N]` | Undo the last batch, or the last N migrations |
| `tylix migrate:reset` | Undo every migration |
| `tylix migrate:refresh [--seed]` | Undo and migrate again |
| `tylix migrate:fresh [--seed]` | Drop every table and migrate (`--force` in production) |
| `tylix db:seed` | Run `app/seeders` |

## Workers

| Command | |
| --- | --- |
| `tylix queue:work` | Run queued jobs with retries and backoff. Stops gracefully on SIGTERM |
| `tylix queue:failed` · `queue:retry <id\|all>` · `queue:flush` | List, retry or delete failed jobs |
| `tylix schedule:work` | Run `app/schedule` tasks |
| `tylix channels:work` | WebSocket channel server. Relays `broadcast()` from the app |
| `tylix log:tail [channel] [--level=error]` · `log:clear` | Follow or empty the log files |

## Make things

| Command | Creates |
| --- | --- |
| `tylix make:feature Invoice title:string total:number` | Model, migration, validator, CRUD API |
| `tylix make:migration add_status_to_posts_table status:string:index` | A migration, named for what it does |
| `tylix make:model` · `make:controller` · `make:validator` · `make:service` · `make:api` | One piece at a time |
| `tylix make:page Reports [--auth]` | A page and its route, in your frontend's own format |
| `tylix make:component StatCard` | A component for your frontend |
| `tylix make:job SendInvoice` | A background job |
| `tylix make:observer Audit --model User` | Model lifecycle hooks, enabled on the model |
| `tylix make:trait HasSlug` | Reusable model behaviour |
| `tylix make:channel chat` | A channel and a demo page |
| `tylix make:mail Welcome` · `make:auth` · `make:icon` | Mail, auth, icons |
| `tylix make:permissions` | [Roles and permissions](/docs/permissions) |
| `tylix make:pwa` | An [installable app](/docs/pwa) |
| `tylix make:queue-retries` | The `available_at` column retries need (apps made before 2.0) |
| `tylix field:add` · `field:remove` | Change a feature's fields with a migration |

Fields take modifiers after their type: `slug:string:unique`, `status:string:index:required:default=draft`, `bio:text:nullable`.

## Routes, plugins and deploys

| Command | |
| --- | --- |
| `tylix routes:types [--check]` | Write the [typed API client](/docs/typed-api-client). `--check` fails CI when it's stale |
| `tylix plugins` | The plugins loaded and what each adds |
| `tylix deploy:init <adapter> [--force]` | Deployment files. See [Deployment](/docs/deployment) |

Commands that plugins add run as `tylix <command>`.

## tylix check

`tylix check` reports every problem in your `.tyx` pages, components, layouts and capabilities with its file, line and column, and exits with code 1 when there are any.

```bash
tylix check                    # pretty output
tylix check --format=json      # for scripts
tylix check --format=github    # annotations on pull requests
tylix check --no-typecheck     # parse only
```

In TypeScript projects it typechecks too.
