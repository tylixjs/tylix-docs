---
title: Authentication
description: Every app ships with login, registration, social sign-in, email verification and password reset, on sessions you can revoke.
---

Since 2.1 every Tylix app includes authentication. The installer generates the models, controller, validator and mailer, plus login, register, password reset and dashboard pages for your frontend.

> [!TIP]
> For what the engine does under the hood, and how to use it outside Tylix, see the [Tylix Auth overview](/auth).

An app created before 2.1 gets it with `tylix make:auth` followed by `tylix migrate`. Everyone signs in once more, because refresh tokens from the old `refresh_tokens` table aren't carried over.

## Routes

```text
POST   /api/register
POST   /api/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/logout-all
GET    /api/auth/verify-email
POST   /api/auth/resend-verification
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/change-password
GET    /api/auth/sessions
DELETE /api/auth/sessions/:id
GET    /api/me
GET    /api/auth/providers
GET    /api/auth/oauth/:provider
GET    /api/auth/oauth/:provider/callback
```

## Sessions

- Short-lived JWT access tokens (15 minutes by default, `auth.tokenExpiresInSeconds`) and **rotating refresh tokens**, stored server-side as HMACs.
- `httpOnly` cookies with `__Host-` and `__Secure-` prefixes on HTTPS, and a refresh cookie scoped to the auth routes.
- Sessions stay in sync across tabs and survive server rendering.
- Logout, "sign out everywhere" and password resets take effect **immediately**.

### Token theft detection

Every refresh rotates the refresh token. If an old one is replayed, meaning someone holds a copy, the whole session ends. A short grace period keeps parallel tabs from tripping it.

## Social sign-in

Create an OAuth app with each provider and add its credentials to `.env`:

```dotenv title=".env"
# callback: <APP_URL>/api/auth/oauth/google/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# callback: <APP_URL>/api/auth/oauth/github/callback
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

The "Continue with Google / GitHub" buttons appear only for providers that are configured. Every flow uses PKCE and encrypted state cookies. An email counts as verified only when the provider vouches for it.

## Protecting things

On the server, put routes in `protectedRoutes` or wrap them with `auth()` (see [API routes](/docs/api-routes)). `req.user.userId` is the signed-in user.

On a `.tyx` page, wait for the `Auth` capability:

```tyx
page Billing

needs
  Auth

onMount
  async {
    if not Auth.user {
      window.location.href = "/login"
    }
  }
```

## Passwords and brute force

- scrypt with OWASP parameters, automatic rehash upgrades and Unicode normalization.
- Constant-time work for unknown accounts, so timing doesn't reveal who has one.
- Limits per account and IP, per account and per IP, shared by every worker. They can't be used to lock someone else out.
- An optional Have I Been Pwned check: `auth.checkBreachedPasswords: true` in `tylix.config`.

## Two-factor

`@tylix/auth` includes TOTP (RFC 6238) with replay protection and hashed recovery codes. Store the secret sealed, and remember the last step used so a code can't be replayed:

```ts
import { generateTotpSecret, totpUri, verifyTotp, generateRecoveryCodes } from "@tylix/auth";

const secret = generateTotpSecret();
const uri = totpUri({ secret, issuer: "Acme", account: user.email }); // show as a QR code

const { valid, step } = await verifyTotp(code, secret, { lastUsedStep: user.totp_step });
const { codes, hashes } = await generateRecoveryCodes(); // show codes once, store hashes
```

## Outside Tylix

The engine is [`@tylix/auth`](/auth), which works in **any** framework: Next.js, Nuxt, SvelteKit, Remix, Astro, Hono, Express, Fastify and Koa, on Node, Bun, Deno, Cloudflare Workers and the edge. It also does TOTP two-factor with recovery codes.
