```js
// auth.js: works in Next.js, Hono, Express, SvelteKit, Workers…
import { createAuth, sqlAdapter } from "@tylix/auth/web"

export const auth = createAuth({
  secret: process.env.AUTH_SECRET, // openssl rand -base64 48
  adapter: sqlAdapter({
    dialect: "postgres",
    query: (sql, params) => pool.query(sql, params),
  }),
  accessTokenTtl: "15m",
  sessionTtl: "30d",
  idleTimeout: "14d",
  onEvent: (event) => audit.log(event), // reuse_detected, revoked, …
})
```
