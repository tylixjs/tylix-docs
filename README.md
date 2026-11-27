# tylix-docs

A Tylix app: Tylix (.tyx pages) pages on a Tylix backend (API, database, auth, mail, jobs).

## Run it

```sh
npm run dev        # http://localhost:3000, reloads on save
npm test           # API tests in tests/
npm run doctor     # checks config, database, migrations and frontend
npm run tinker     # a REPL with your models, services and request()
npm run build      # typecheck and production bundles
npm start          # production server (after build and migrate)
```

## Layout

```
app/pages/            .tyx pages (the file name is the URL) and components/
app/routes/           API routes (web.ts); everything under /api/
app/controllers/      request handlers
app/models/           one class per table
app/services/         business logic shared by controllers and jobs
app/middleware/       functions that run around requests
app/validators/       rules for incoming data
app/jobs/             background work (tylix queue:work)
app/observers/        code that runs when models change
app/traits/           reusable model behaviour
app/mail/             mailables and the mailer
app/Features/         CRUD features made by tylix make:feature
app/schedule.ts         scheduled tasks (tylix schedule:work)
app/seeders/          sample data (tylix db:seed)
database/migrations/  schema changes (tylix migrate)
tests/                API tests
public/               static files, served as-is
```

Each folder has a README saying what goes there and which command makes it.

## Make things

```sh
tylix make:feature Invoice title:string total:number   # model, migration, CRUD API
tylix make:page Reports --auth                          # a page and its route
tylix make:component StatCard
tylix make:service Billing
tylix make:controller Invoice
tylix make:job SendInvoice                              # background job
tylix make:observer Audit --model User                  # model lifecycle hooks
tylix make:trait HasSlug                                # reusable model behaviour
tylix make:channel chat                                 # live channel + demo page
```

## Playground (/playground)

A guided Tylix project (Pixel Tasks) people edit in the browser, built by the
real compiler and previewed live, with ten challenges in two tracks: beginner
(first edit to a share link) and intermediate (computed values, `{{#if}}`,
two-way binding, slots, a capability of your own). Each step's check reads
the compiler's outline of the files and a snapshot the preview sends.

```
content/playground/pixel-tasks/        the starter project (edit it like any Tylix app)
app/pages/Playground.tyx               the page: workspace UI, state, challenges progress
public/playground/editor.js            code editor (highlighting, completion, error marks)
public/playground/highlight.js         .tyx / CSS / JSON highlighter
public/playground/playground.css       the playground's styles (scoped under .pg-root)
public/playground/workspace.js         saving, share links, challenge text and checks
app/pages/components/BadgeIcon.tyx     a badge's icon, by the name workspace.js gives it
app/services/Playground.ts             build queue around a worker thread
app/services/playground/               compileProject.mjs (the build), compileWorker.mjs,
                                       previewBridge.js (injected into every preview)
app/controllers/PlaygroundController.ts  GET starter, GET meta, POST compile
```

The page loads the modules and the stylesheet in public/playground/ with
`?v=<hash>` from GET meta (never cached), so a deploy can't pair the new page
with old modules or styles from the browser cache, Cloudflare or the service
worker. Only the few rules needed before that loads (loading screen, hiding
the workspace) live in app/tailwind-input.css. The rules are scoped under
`.pg-root`, which outranks Tailwind utilities: put responsive display rules
in playground.css rather than `hidden md:flex` on a `pg-` element.

The gutters between the panels are drag handles (code | preview, and the
console's height; arrow keys when focused, double-click to reset). The sizes
are saved with the project in this browser. Keep that
in mind when adding a module: import siblings with the caller's query, as
editor.js does for highlight.js.

Builds only parse and generate code on the server; nothing a visitor writes
runs there. The result runs in a `sandbox="allow-scripts"` iframe (opaque
origin, no access to the site's cookies or storage) and reports its console
and a small DOM outline back with `postMessage`. Projects are saved in the
visitor's browser; share links carry the whole project, compressed, in the
URL hash. Limits: 40 files, 60 KB a file, 200 KB a project, 90 builds a
minute per IP, 10 seconds a build.

`node --import tsx --test --test-force-exit tests/playground.test.ts` runs the
API tests (the test client keeps the process open, hence `--test-force-exit`).
