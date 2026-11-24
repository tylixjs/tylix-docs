---
title: Routing & layouts
description: The file is the route. Dynamic segments, layouts, the not-found page and the loading indicator.
---

## File-based routes

Every `.tyx` file in `app/pages` is a page, and its path is its URL:

| File | URL |
| --- | --- |
| `app/pages/Home.tyx` | `/` |
| `app/pages/About.tyx` | `/about` |
| `app/pages/posts/Index.tyx` | `/posts` |
| `app/pages/posts/[id].tyx` | `/posts/:id` |
| `app/pages/users/[id]/Profile.tyx` | `/users/:id/profile` |

Segments are lower-cased, `Index` maps to its folder, and `Home.tyx` also answers `/`. Static routes always win over dynamic ones, so `posts/create.tyx` is never captured by `posts/[id].tyx`.

```bash
npx tylix make:page Reports          # app/pages/Reports.tyx → /reports
npx tylix make:page Reports --auth   # only for signed-in users
```

## Route parameters

A dynamic segment arrives as a prop with the same name:

```tyx title="app/pages/posts/[id].tyx"
page PostDetail

props
  id: string

state
  post: null

onMount
  async {
    const result = await useApi(`/api/public/posts/${this.id}`)
    if result.ok {
      this.post = result.data
      document.title = result.data.title
    }
  }

template
{{#if post}}
  <h1>{{ post.title }}</h1>
{{/if}}
```

## Layouts

`_layout.tyx` wraps every page in its folder and below. The page renders where the layout puts `data-tylix-slot`:

```tyx title="app/pages/_layout.tyx"
component SiteLayout

import SiteHeader from "./components/SiteHeader"
import SiteFooter from "./components/SiteFooter"

template
  <div class="shell">
    <SiteHeader />
    <main data-tylix-slot="true"></main>
    <SiteFooter />
  </div>
```

The closest layout wins. A page in `app/pages/admin/` uses `app/pages/admin/_layout.tyx` if there is one, never that and the root layout together.

## Not found

`app/pages/_not-found.tyx` renders, with a 404 status, for any URL that matches no page. It's never a route itself.

## Loading indicator

`app/loading.tyx` shows while a page makes requests (`useApi`, capabilities, `prefetch`). Tylix gives it one prop, `loading`:

| Field | |
| --- | --- |
| `loading.active` | Requests in flight |
| `loading.progress` | 0 to 100 |
| `loading.visible` | `true` while something is loading |

Pages also get a branded loading screen while they start. It waits 150ms before showing, so fast loads never flash it.
