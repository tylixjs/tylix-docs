---
title: Capabilities
description: Shared, reactive state for .tyx pages, such as Auth.user and Theme.mode. One instance per tab, available to any page or component that asks.
---

A capability is a singleton with state, actions and an `init` block. Pages and components opt in with `uses`, then read it by name.

```tyx title="app/capabilities/Theme.tyx"
capability Theme

state
  mode: "light"

action
  toggle() {
    this.mode = this.mode is "dark" ? "light" : "dark"
    document.documentElement.classList.toggle("dark", this.mode is "dark")
    localStorage.setItem("theme", this.mode)
  }

init
  async {
    const saved = localStorage.getItem("theme")
    this.mode = saved ?? "light"
  }
```

```tyx
component ThemeButton

uses
  Theme

template
  <button onclick="{{ Theme.toggle() }}">
{{#if Theme.mode is "dark"}}Light mode{{#else}}Dark mode{{/if}}
  </button>
```

Every page and component that uses `Theme` sees the same `mode`, and changing it updates all of them.

## When init runs

A capability is created the first time something on the page refers to it, and its `init` runs then. How a page refers to it decides whether the page waits:

| Section | Behaviour |
| --- | --- |
| `uses` | Read it. The page renders straight away, and the capability's state fills in when `init` finishes |
| `needs` | Wait. `onMount` runs only after the capability's `init` has finished |
| `background` | Start it now without waiting, so it's warm by the time something needs it |

```tyx
page Dashboard

needs
  Auth

background
  Analytics

onMount
  async {
    // Auth.user is already known here
    if not Auth.user {
      window.location.href = "/login"
    }
  }
```

## Capabilities in the Starter App

| Capability | |
| --- | --- |
| `Auth` | `Auth.user`, `Auth.login()`, `Auth.logout()` |
| `Theme` | `Theme.mode`, `Theme.toggle()` |
| `Pwa` | `Pwa.installable`, `Pwa.updateAvailable`, `Pwa.online`, `Pwa.install()`, `Pwa.update()` |
| `Mail`, `Analytics`, `Notifications`, `Users`, `Posts` | Examples to adapt or delete |
