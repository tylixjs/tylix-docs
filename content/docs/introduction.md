---
title: Introduction
description: Tylix is a batteries-included full-stack JavaScript framework. The server, the database, authentication and the tooling are already wired together.
---

Modern web development often means assembling a dozen libraries before the first feature ships. With Tylix they already work together: a reactive page compiler (or the frontend you already know), a server with authentication and an ORM, background work, observability, and a generator-first CLI.

```bash
npm create tylix@latest
```

## What you get

- **Pages your way.** Write reactive `.tyx` pages compiled without a virtual DOM, or use **React, Vue, Svelte or Angular** on the same backend. Every frontend renders on the server.
- **Authentication in every app.** Login, registration, Google and GitHub sign-in, email verification and password reset, with revocable sessions and token-theft detection.
- **One ORM, six databases.** SQLite, PostgreSQL, MySQL, MariaDB, CockroachDB and MongoDB, with migrations, observers, traits and pagination.
- **Validation once.** The same rules run in the API and in the browser.
- **A typed API client** generated from your routes, so a renamed field is a type error, not a production bug.
- **Background work.** Queues with retries and backoff, scheduled tasks, live channels and mail.
- **Production built in.** Workers sharing one port, health and readiness checks, Prometheus metrics, request ids and Laravel-style log channels.
- **Generators for everything.** `tylix make:feature` writes a model, migration, validator and CRUD API you can call right away.

## A taste

A native Tylix page holds its state, derived values, actions and template in one file:

```tyx title="app/pages/Counter.tyx"
page Counter

state
  count: 0

computed
  doubled() {
    return this.count * 2
  }

action
  increment() {
    this.count++
  }

template
  <div>
    <h1>Counter</h1>
    <p>Count: {{ count }}, doubled: {{ doubled }}</p>
    <button onclick="{{ increment }}">Increment</button>
  </div>
```

Save it and visit `/counter`. The file is the route, there is nothing to register, and the browser updates as you type.

## Is Tylix for me?

Tylix fits teams that want one coherent stack rather than a framework plus twenty decisions. It works well when you:

- build a product with accounts, data and background work, not only static pages;
- want Laravel-style productivity (generators, migrations, queues, mail) in JavaScript;
- want to keep a frontend you already know. React, Vue, Svelte and Angular are first-class.

> [!NOTE]
> Tylix is **stable (2.1)** and follows [semantic versioning](https://semver.org). 2.x releases add features and fix bugs without breaking your app. Anything that would break it waits for 3.0. See the [changelog](/changelog).

## Next steps

- [Install Tylix](/docs/installation) and create your first app.
- Learn the [.tyx page format](/docs/pages).
- Generate a [feature](/docs/cli#make-things) and explore the [ORM](/docs/database).
