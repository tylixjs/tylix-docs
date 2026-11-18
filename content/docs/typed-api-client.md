---
title: Typed API client
description: The routes your app registers become a typed client, so a renamed field or a missing parameter is a type error before it's a bug.
---

`tylix dev` writes the client when it starts, and `tylix routes:types` writes it on demand.

| Frontend | File |
| --- | --- |
| React, Vue, Svelte, Angular | `app/views/api.generated.ts` |
| Native `.tyx` pages | `app/types/api.d.ts` |

```ts
import { routes } from "./api.generated";

const page = await routes.posts.index({ query: { page: 2 } });  // ApiResult<Paginated<Post>>
const post = await routes.posts.show({ id: 7 });                // ApiResult<{ data: Post }>
await routes.posts.update({ id: 7 }, { title: "New title" });   // body typed as PostInput
await routes.login({ email, password });
await routes.$request("DELETE /api/posts/:id", { params: { id: 7 } });
```

- **Feature routes** are typed from their fields.
- **Auth routes** are typed from their request bodies.
- **Other routes** are typed by their method and path parameters.

The client runs on `api()` from `@tylix/client`, so session refresh and the `{ ok, data, error }` results work the same as everywhere else.

## In CI

```bash
tylix routes:types --check
```

This fails when the generated file is stale, meaning someone changed a route and didn't commit the new types.

## Turning it off

```ts title="tylix.config.ts"
export default defineConfig({
  typedRoutes: false,
});
```
