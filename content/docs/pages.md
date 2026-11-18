---
title: Pages
description: A .tyx page holds its state, derived values, actions, lifecycle and template in one file, compiled to direct DOM updates without a virtual DOM.
---

A page starts with `page <Name>`, then lists its sections. Only `template` is required.

```tyx title="app/pages/Todos.tyx"
page Todos

import TodoItem from "./components/TodoItem"

title "Todos"

uses
  Auth

state
  todos: []
  draft: ""

computed
  remaining() {
    return this.todos.filter(t => not t.done).length
  }

action
  async add() {
    const result = await postApi("todos", { title: this.draft })
    if result.ok {
      this.todos.push(result.data.data)
      this.draft = ""
    }
  }

onMount
  async {
    const result = await getApi("todos")
    this.todos = result.data.data
  }

template
  <form onsubmit.prevent="{{ add() }}">
    <input bind:value="{{ draft }}" placeholder="What needs doing?" />
  </form>
  <p>{{ remaining }} left, signed in as {{ Auth.user.name }}</p>
{{#each todo in todos}}
  <TodoItem todo="{{ todo }}" />
{{/each}}
```

## Sections

| Section | What it holds |
| --- | --- |
| `import` | Components from files (`./components/Card`) or packages (`{ IconPlus } from "tylix-icons"`) |
| `title` | The document title, e.g. `title "Dashboard"` |
| `props` | Values passed in: route parameters on a page, attributes on a component |
| `uses` | [Capabilities](/docs/capabilities) the page reads, such as `Auth` or `Theme` |
| `needs` | Capabilities whose `init` must finish before `onMount` runs |
| `background` | Capabilities to start loading without waiting for them |
| `permissions` | Permission names the viewer must have, e.g. `posts.view` |
| `state` | Reactive fields with their initial values |
| `computed` | Getters derived from state, recomputed when what they read changes |
| `action` | Methods, used by the template and by each other |
| `onMount` | Runs in the browser once the page is on screen |
| `template` | The markup. See [template syntax](/docs/templates) |
| `style` | CSS for this page |

## State

Each line is `name: initial value`. Assigning to `this.name` in an action updates every place in the template that reads it, and nothing else.

```tyx
state
  count: 0
  user: null
  filters: { status: "open", tags: [] }
```

Objects and arrays are reactive too: `this.todos.push(todo)` and `this.filters.status = "done"` both update the page.

## Computed values

A computed value is a function that returns something derived from state. The template reads it like a field: `{{ remaining }}`, not `{{ remaining() }}`.

```tyx
computed
  visible() {
    return this.todos.filter(t => this.query is "" or t.title has this.query)
  }
```

## Actions

Actions are methods. They can be `async`, call each other through `this`, and be called from the template.

```tyx
action
  toggle(todo) {
    todo.done = not todo.done
  }

  async remove(todo) {
    await deleteApi(`todos/${todo.id}`)
    this.todos = this.todos.filter(t => t.id is not todo.id)
  }
```

## Readable operators

`.tyx` scripts are JavaScript or TypeScript, with a few words you can use in place of symbols:

| Write | Means |
| --- | --- |
| `a is b` / `a is not b` | `a === b` / `a !== b` |
| `not a` | `!a` |
| `a and b` / `a or b` | `a && b` / `a \|\| b` |
| `list has x` | the list or string contains `x` |
| `if cond { … }` | `if (cond) { … }`, with no parentheses needed |

The symbols work too, so you can use whichever reads better.

## Calling the API

Pages have `useApi(url, options)` plus the shorthands `getApi`, `postApi`, `putApi` and `deleteApi`. Each returns `{ ok, status, data, error }` and never throws, and the session refreshes itself when the access token expires.

```tyx
const result = await useApi("/api/me")
if result.ok {
  this.user = result.data
} else if result.status is 401 {
  window.location.href = "/login"
}
```

> [!TIP]
> In TypeScript projects, `tylix dev` writes `app/types/api.d.ts` from your routes, so these calls are typed. See [Typed API client](/docs/typed-api-client).
