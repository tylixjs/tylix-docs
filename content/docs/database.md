---
title: Database & ORM
description: Models, a query builder, observers and traits, on SQLite, PostgreSQL, MySQL, MariaDB, CockroachDB and MongoDB.
---

## Drivers

Pick one with `DATABASE_DRIVER` in `.env`. The same models and queries work on every driver.

| Driver | Uses | Notes |
| --- | --- | --- |
| `sqlite` | `node:sqlite` | A file, with nothing to install |
| `postgres` | `pg` | `DATABASE_URL`, `DATABASE_SSL=true` for hosted clusters |
| `cockroach` | `pg` | Ids count 1, 2, 3 and come back as numbers, as on PostgreSQL |
| `mysql` | `mysql2` | |
| `mariadb` | `mysql2` | |
| `mongodb` | `mongodb` | SQL-shaped calls are translated |

## Models

```ts title="app/models/Post.ts"
import { Model } from "@tylix/orm";

export class Post extends Model {
  static table = "posts";
  static fillable = ["title", "body", "user_id"];
}
```

Only the `fillable` columns can be set through `create` and `update`.

## Queries

```ts
const post = await Post.create({ title: "Hello", body: "…", user_id: 1 });
const found = await Post.find(7);
const all = await Post.all();

const recent = await Post.where("user_id", 1).latest().limit(10).get();
const published = await Post.where("published", true)
  .orderBy("created_at", "DESC")
  .limit(10)
  .get();

const first = await Post.query().where("slug", "hello").first();

await Post.update(7, { title: "New title" });
await Post.delete(7);
```

### Pagination

```ts
const page = await Post.paginate({ page: 2, limit: 20, where: { user_id: 1 } });
// { data: [...], meta: { page: 2, total: 134, totalPages: 7, ... } }
```

### Atomic updates

`updateWhere` changes rows only if they still match, and returns how many it changed. It's ideal for claiming work exactly once:

```ts
const claimed = await Job.updateWhere({ id, status: "pending" }, { status: "processing" }); // 1 or 0
```

## Observers

Observers run code when a model changes: `creating`/`created`, `updating`/`updated` and `deleting`/`deleted`.

```bash
tylix make:observer Audit --model Post
```

```ts
export class Post extends Model {
  static table = "posts";
  static observers = [AuditObserver];
}
```

## Traits

Traits are reusable model behaviour, mixed in with `use`:

```ts
import { Model, Searchable, use } from "@tylix/orm";

class Post extends use(Model, Searchable({ fields: ["title", "body"] })) {
  static table = "posts";
}

const results = await Post.search("tylix");
```

```bash
tylix make:trait HasSlug
```

## Query timing

```ts
import { onQuery } from "@tylix/orm";

onQuery(({ driver, sql, durationMs }) => {
  /* log, measure */
});
```

The CLI uses this for slow-query warnings (`SLOW_QUERY_MS`) and metrics. Nothing is timed while no one listens.

## Exploring data

```bash
tylix tinker
```

```js
> await Post.where("published", true).count()
42
```

`tinker` is a REPL with your models, services and routes loaded. `--eval "..."` runs one expression and exits.
