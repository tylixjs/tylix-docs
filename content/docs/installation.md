---
title: Installation
description: Create a Tylix app with one command and have it running on localhost in under a minute.
---

## Requirements

- **Node.js 22.13** or later
- npm or pnpm
- A database server if you choose one. SQLite needs nothing installed.

## Create an app

```bash
npm create tylix@latest
```

The installer asks a few questions:

| Question | Options |
| --- | --- |
| Frontend | **Tylix** (`.tyx` pages), React, Vue, Svelte, Angular |
| Language | JavaScript or TypeScript |
| Database | SQLite, PostgreSQL, MySQL, MariaDB, CockroachDB, MongoDB |
| Styling | Tailwind CSS or plain CSS |
| Installable app | Adds a [PWA](/docs/pwa): manifest, service worker, offline page (also `--pwa`) |
| Package manager | npm or pnpm |

Every app is the full **Starter App**: a landing page, posts, a dashboard and authentication (login, registration, Google and GitHub sign-in, email verification and password reset).

> [!TIP]
> Pick **SQLite** while you explore. It's a single file and needs no server. Switching later is one line in `.env`, because every driver speaks the same ORM.

## Start the development server

```bash
cd my-app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Saving a file shows up in the browser without restarting anything:

- **Pages, components, styles** and `app/index.html` reload the open tab.
- A **new or deleted page** is routed straight away.
- **Backend files** (controllers, models, routes, `.env`, `tylix.config`) restart the server, and the tab reloads once it's back.
- React, Vue, Svelte and Angular frontends hot-reload through Vite.

## Add your first feature

```bash
npx tylix make:feature Todo title:string:required done:boolean:default=false
npx tylix migrate
```

That writes a model, a migration, a validator and a CRUD API under `/api/todos`, and it works straight away:

```bash
curl localhost:3000/api/todos
```

## Check your setup

```bash
npx tylix doctor
```

`doctor` checks the project, your settings (and where each value came from), the database connection and the frontend. Run it first whenever something looks off.

## Next steps

- Take a tour of the [project structure](/docs/project-structure).
- Learn how [pages](/docs/pages) work.
