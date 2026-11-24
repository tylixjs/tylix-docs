---
title: Project structure
description: Where everything lives in a Tylix app. Each folder has a README saying what goes there and which command makes it.
---

```text
app/
├── controllers/      request handlers
├── models/           one class per table
├── routes/           API routes (web.ts and any other file)
├── services/         business logic
├── middleware/
├── validators/       rules shared with the frontend
├── jobs/             background work
├── observers/        code that runs when models change
├── traits/           reusable model behaviour
├── mail/
├── seeders/
├── plugins/          plugins loaded at start
├── capabilities/     shared state for .tyx pages (Auth, Theme, …)
├── pages/            native .tyx pages
├── views/            React, Vue, Svelte or Angular
│   ├── pages/
│   ├── providers/
│   ├── services/
│   └── api.generated.ts   typed API client
├── index.html        the document every page renders into
└── loading.tyx       the loading indicator

database/migrations/
storage/logs/         daily log files
tests/
public/               served as-is: images, fonts, favicon
tylix.config.ts
.env
```

## The parts that matter first

### `app/pages`

Native `.tyx` pages. The file path is the URL: `app/pages/posts/[id].tyx` answers `/posts/:id`. See [routing](/docs/routing).

### `app/routes`

API routes. `web.ts` exports `publicRoutes` and `protectedRoutes`. Every other file in the folder exports `routes(router, { auth })` and is loaded at start. See [API routes](/docs/api-routes).

### `app/models` and `database/migrations`

One model class per table, and the migrations that create and change those tables. `npx tylix make:feature` writes both.

### `app/capabilities`

Shared, reactive state for `.tyx` pages, such as `Auth.user` or `Theme.mode`. A page opts in with `uses`. See [capabilities](/docs/capabilities).

### `tylix.config.ts` and `.env`

Settings. Every value is documented in the generated `.env`, and `npx tylix doctor` prints each one along with where it came from. See [configuration](/docs/configuration).

> [!NOTE]
> Apps made before 2.0 keep React, Vue, Svelte or Angular code in `app/frontend`. When only `app/frontend` exists, every command uses it, so nothing has to move.
