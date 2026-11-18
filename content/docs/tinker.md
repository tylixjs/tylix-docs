---
title: Tinker
description: A REPL with your models, services, database and API loaded. Query data, call your own routes as any user, run jobs and inspect config, or script it all with --eval.
---

```bash
tylix tinker          # or: npm run tinker
```

```text
Tylix Tinker — type help() for commands.
Models loaded: Post, User
Services loaded: Billing

tylix> Post.where("published", true).count()
42
```

Tinker opens a Node REPL inside your project. Before the prompt appears it:

- builds your app's API the way `tylix dev` does, but without the frontend (no pages, no Vite), so every route and middleware is registered;
- connects the database from your config and `.env`;
- imports every file in `app/models` and `app/services` by name;
- adds a set of helpers: `request()`, `routes()`, `db`, `show()`, `info()` and more.

Type `help()` at the prompt for the full list.

If the app can't be built (a broken routes file, say), Tinker still opens with a warning and connects the database directly, so you can use it to find the problem. Only `routes()` and `request()` are unavailable then.

## No `await` needed

Every result is awaited before it's printed, so you see rows instead of `Promise { <pending> }`:

```js
tylix> User.find(1)
User { id: 1, name: 'Ann', email: 'ann@example.com', ... }
```

Assign with `await` when you want to keep a value for later lines:

```js
tylix> const user = await User.first()
tylix> user.email
'ann@example.com'
```

Results are printed in color, four levels deep and up to 50 array items. History is kept between sessions in `.tylix_tinker_history` in the project root. You may want to add it to `.gitignore`.

## Models

Each file in `app/models` is imported, and its export named like the file becomes a global: `app/models/Post.ts` gives you `Post`. The whole ORM is available. See [Database & ORM](/docs/database).

```js
Post.all()
Post.find(1)
Post.create({ title: "Hello", body: "…" })     // fillable fields only
Post.update(1, { title: "Hi" })
Post.delete(1)
Post.where("views", ">", 100).latest().limit(5).get()
Post.whereIn("id", [1, 2, 3]).get()
Post.pluck("title", "id")                      // { 1: "Hello", ... }
Post.paginate({ page: 2, limit: 10 })
User.firstOrCreate({ email: "a@b.com" }, { name: "Ann" })
```

Some helpers tell you about a model:

| Helper | |
| --- | --- |
| `models()` | Every loaded model and its table |
| `info(Post)` | Table, fillable fields, timestamps and row count |
| `methods(Post)` | Static and instance methods, including inherited ORM methods |
| `show(Post.all())` | Print rows as a table. Paginated results print `data` as a table, then `meta` |
| `reload()` | Import `app/models` again after you edit a model, without restarting |

```text
tylix> info(Post)

Post
  table:      posts
  fillable:   title, body, published
  timestamps: yes
  rows:       42
```

`reload()` only re-imports models. Restart Tinker to pick up changes to services or routes.

## Services

Files in `app/services` are imported by name the same way, so `app/services/Billing.ts` exporting `Billing` is available as `Billing`:

```js
tylix> Billing.invoiceTotal(7)
1250
```

A file whose export doesn't match its name is skipped. If a model or service throws while importing, Tinker prints `Could not load model <file>` and loads the rest.

## Your API

`request(method, url, options)` calls your app's own API in-process. Requests go through the same router, middleware, validation and auth as a real one. No server or port is needed, and you don't have to log in.

```js
request("GET", "/api/public/posts")                          // as a guest
request("GET", "/api/posts", { as: 1 })                      // as user 1
request("POST", "/api/posts", { as: user, body: { title: "Hi", body: "…" } })
request("GET", "/api/posts", { headers: { "accept-language": "fr" } })
```

```js
{ status: 201, data: { data: { id: 43, title: 'Hi', ... } } }
```

| Option | |
| --- | --- |
| `as` | A user id or any object with an `id`. The request carries a five-minute access token for that user, signed with your app's `AUTH_SECRET`, which is the same token logging in gives them |
| `body` | The request body, for `POST`, `PUT` and `PATCH` |
| `headers` | Extra request headers |

The URL must be a path starting with `/`. It returns `{ status, data }`.

This is the same requester `@tylix/cli/testing` uses, so a call that works here works the same way in a test.

`routes()` lists every API route the server registers and where it came from, followed by the page routes:

```text
tylix> routes()
API routes:
  GET     /api/posts       🔒 login required  (feature)
  POST    /api/posts       🔒 login required  (feature)
  GET     /api/public/posts  (app/routes)
  POST    /api/auth/login    (built-in auth)

Page routes:
  GET     /
  GET     /home
  GET     /posts/:id
```

In a React, Vue or Svelte app, page routes come from the router file in `app/views`, and `routes()` points you to it.

## Database

`db` is the connected adapter, for raw SQL:

```js
db.all("SELECT * FROM posts WHERE views > ?", [100])    // many rows
db.get("SELECT * FROM posts WHERE id = ?", [1])         // one row
db.run("UPDATE posts SET published = ? WHERE id = ?", [true, 1])
```

| Helper | |
| --- | --- |
| `tables()` | Tables, or collections on MongoDB, in the connected database |
| `migrate()` | Run pending migrations, like `tylix migrate` |
| `seed()` | Run `app/seeders/DatabaseSeeder.ts` (or `.js`) |

Tinker uses the database your config points to. Check `config()` before you write data, especially with a production `.env`.

## Jobs, cache and mail

```js
dispatch("SendWelcomeEmail", { userId: 1 })                 // queue a job
dispatch("SendWelcomeEmail", { userId: 1 }, { delay: 60 })  // run in a minute
```

`dispatch()` only adds the job to the queue. Run `tylix queue:work` to process it. See [Queues, schedules & channels](/docs/background-jobs).

`cache` is the app cache:

```js
cache.set("stats:home", { posts: 42 }, 60)   // ttl in seconds; leave it out to keep it
cache.get("stats:home")
cache.has("stats:home")
cache.forget("stats:home")
cache.clear("user:")                         // every key starting with user:
cache.remember("stats:home", 60, () => Post.count())
```

`cacheEntries()` lists the rows of the cache table. Use it when `STORE_DRIVER` is `database`.

`mail()` prints the mail driver, sender and SMTP host, and imports the functions from `app/mail/mailer.ts` so you can call them:

```text
tylix> mail()
Driver: log (messages are logged, not sent)
From:   hello@example.com
Mailer: app/mail/mailer.ts
Functions: sendVerificationEmail, sendPasswordResetEmail

tylix> const { mail: mailConfig } = await import("@tylix/shared").then((m) => m.loadConfig(process.cwd(), "typescript"))
tylix> sendPasswordResetEmail(user, "test-token", mailConfig)
```

With the `log` driver the message is written to the log instead of being sent, so this is a safe way to check what an email looks like.

## Project and config

| Helper | |
| --- | --- |
| `config()` | The resolved config: defaults, `tylix.config` and `.env` combined |
| `env()` | Environment variables, without `npm_*` ones |
| `features()` | Each feature's `feature.json` from `app/Features` |
| `pages()` | Page files in `app/pages`, or `app/views/pages` for React, Vue and Svelte apps |

`config()` and `env()` mask secrets. Any value whose name looks like a secret (`AUTH_SECRET`, `DATABASE_PASSWORD`, `apiKey`, `STRIPE_KEY`, `accessToken` and so on) prints as `••••••••`, and so does the password in URLs such as `mongodb://user:••••••••@host`.

## Scripting with `--eval`

`--eval` (or `-e`) runs code with the same models, services and helpers in scope, prints the result and exits. The database connection is closed afterwards.

```bash
tylix tinker --eval 'User.count()'
tylix tinker -e 'Post.where("published", false).pluck("title")'
tylix tinker -e 'request("GET", "/api/posts", { as: 1 })'
```

`await` is implicit for a single expression. For several statements, use `await` and `return` the value you want printed:

```bash
tylix tinker --eval 'const u = await User.first(); return u.email'
```

Nothing is printed when the value is `undefined`. If the code throws, the error goes to stderr and the exit code is 1, so you can use `--eval` in scripts and CI:

```bash
tylix tinker -e 'const n = await Post.count(); if (n === 0) throw new Error("no posts")'
```

Every helper works in `--eval` too. Names a helper adds are available on the lines after it:

```bash
tylix tinker -e 'await mail(); return typeof sendPasswordResetEmail'
```

## Leaving

Type `.exit`, call `exit()` or press `Ctrl+D`. `exit()` closes the database connection first. `.clear` resets a multi-line input you've started.
