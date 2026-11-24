---
title: Configuration
description: Settings live in .env and tylix.config. Every value is documented in the generated .env, and npx tylix doctor shows where each one came from.
---

Tylix reads settings from two places:

- **`.env`** for values that change per environment (ports, credentials, secrets).
- **`tylix.config.ts`** for how the app behaves (logging channels, queue defaults, plugins, PWA, export).

```bash
npx tylix doctor
```

`doctor` prints every setting along with its source: `.env`, `tylix.config`, or the built-in default.

## tylix.config

```ts title="tylix.config.ts"
import { defineConfig } from "@tylix/shared";

export default defineConfig({
  auth: {
    tokenExpiresInSeconds: 15 * 60,
    checkBreachedPasswords: false,
  },
  logging: {
    channels: {
      payments: { driver: "daily", path: "storage/logs/payments.log", level: "warning" },
    },
  },
  queue: { tries: 3, backoff: "exponential" },
  plugins: [],
});
```

## Common environment variables

### App

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `APP_ENV` | `production` | `local`, `staging` or `production` |
| `APP_URL` | | Public URL. Used for email links and redirects, and trusted for browser writes |
| `APP_DEBUG` | `false` | Shows error details in responses. Never turn it on in production |
| `AUTO_PORT` | `false` | Move to the next free port when `PORT` is taken |
| `TRUST_PROXY` | `false` | Only behind a reverse proxy you control |
| `MAX_BODY_BYTES` | `4194304` | Largest request body (bigger requests get a 413) |

### Database

| Variable | |
| --- | --- |
| `DATABASE_DRIVER` | `sqlite`, `postgres`, `mysql`, `mariadb`, `cockroach`, `mongodb` |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME` | Where the database is |
| `DATABASE_USER`, `DATABASE_PASSWORD` | Credentials |
| `DATABASE_URL`, `DATABASE_SSL=true` | Connect PostgreSQL or CockroachDB to a hosted cluster |

### Security

| Variable | |
| --- | --- |
| `AUTH_SECRET` | 32+ random characters. `openssl rand -base64 48` |
| `TRUSTED_ORIGINS` | Extra origins allowed to send browser writes, comma separated |
| `CSP_MODE` | `off`, `report-only` or `enforce`. Empty: off in development, report-only in production |

### Scaling and observability

| Variable | Default | |
| --- | --- | --- |
| `WORKERS` | `auto` | Processes `npx tylix start` runs, sharing the port |
| `STORE_DRIVER` | `database` | `database`, `redis` or `memory`: where cache, rate limits and channel messages live |
| `REDIS_URL` | | When `STORE_DRIVER=redis` |
| `LOG_LEVEL`, `LOG_FORMAT` | `info`, auto | `json` in production, `pretty` in development |
| `SLOW_REQUEST_MS` / `SLOW_QUERY_MS` | `1000` / `200` | Log a warning above these. `0` turns it off |
| `METRICS`, `METRICS_TOKEN` | `false` | Prometheus at `/metrics` |

### Mail

| Variable | |
| --- | --- |
| `MAIL_DRIVER` | `log`, `smtp`, `resend`, `sendgrid`, `postmark`, `mailgun`, `ses` |
| `MAIL_FROM` | Sender address |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_SECURE` | SMTP |
| `MAIL_API_KEY`, `MAIL_DOMAIN`, `MAIL_REGION` | API drivers |

> [!WARNING]
> Keep `.env` out of version control. The generated `.gitignore` already excludes it. Commit `.env.example` instead.
