---
title: Deployment
description: Build, migrate and start. Workers share the port, and adapters generate the files for Docker, Fly, Render, Railway, PM2 and static hosts.
---

## Running in production

```bash
npm run build
npx tylix migrate
npx tylix start --workers auto
```

- One process per CPU core, sharing the port. A worker that crashes is replaced.
- `STORE_DRIVER=database` (the default) or `redis` shares the cache, rate limits and channel messages between workers and servers.
- `/health` and `/ready` for load balancers, and `/metrics` for Prometheus with `METRICS=true`.
- JSON logs carrying each request's `X-Request-Id`, and warnings for slow requests and slow queries.

Every setting is documented in the generated `.env`, and `npx tylix doctor` shows each value and where it came from.

> [!WARNING]
> Set `AUTH_SECRET` to 32+ random characters, keep `APP_DEBUG=false`, and set `APP_URL` to your public URL. Turn on `TRUST_PROXY` only behind a proxy you control.

## Deployment adapters

```bash
npx tylix deploy:init              # list the adapters
npx tylix deploy:init fly          # Dockerfile + fly.toml (web and queue processes)
```

| Kind | Adapters | Runs |
| --- | --- | --- |
| Server | `docker`, `fly`, `render`, `railway`, `pm2` | `npx tylix start` |
| Static | `netlify`, `vercel`, `github-pages`, `cloudflare-pages` | publishes `npx tylix export` |

Existing files are kept unless you pass `--force`. Plugins can add adapters.

## Static sites

```bash
npx tylix build && npx tylix export     # → dist/static
```

`npx tylix export` runs the production app on a private port and renders `/`, every page without parameters, and every page linked from them. It then writes the HTML, the scripts, styles and images they use, `public/`, and a `404.html`.

Pages with parameters go in `export.paths`:

```ts title="tylix.config.ts"
export: {
  paths: async () => (await Post.all()).map((post) => `/posts/${post.id}`),
  exclude: ["/dashboard"],
}
```

> [!NOTE]
> API routes aren't exported, so a page that loads data in the browser still needs the backend.
