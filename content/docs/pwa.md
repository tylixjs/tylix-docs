---
title: Installable apps (PWA)
description: Make any Tylix app installable and offline-ready, for every frontend, with an update and install prompt.
---

Choose **Installable app** when creating the project (or pass `--pwa`), or add it later:

```bash
tylix make:pwa
```

That adds icons, an offline page, the `pwa` config and an update and install prompt.

```ts title="tylix.config.ts"
export default defineConfig({
  pwa: {
    name: "Acme",
    shortName: "Acme",
    themeColor: "#0034CA",
    backgroundColor: "#ffffff",
  },
});
```

Tylix serves the manifest and the service worker. Icons and `offline.html` live in `public/`.

> [!IMPORTANT]
> Pages are never cached, because they can hold a signed-in user's data. Visitors who are offline get `public/offline.html` instead.

## On a .tyx page

The `Pwa` capability exposes the state:

```tyx
component InstallButton

uses
  Pwa

template
{{#if Pwa.installable}}
  <button onclick="{{ Pwa.install() }}">Install the app</button>
{{/if}}
{{#if Pwa.updateAvailable}}
  <button onclick="{{ Pwa.update() }}">Reload for the new version</button>
{{/if}}
{{#if not Pwa.online}}
  <p>You're offline</p>
{{/if}}
```

| Field | |
| --- | --- |
| `Pwa.supported` | The browser supports service workers |
| `Pwa.installable` | The install prompt is available |
| `Pwa.installed` | Running as an installed app |
| `Pwa.updateAvailable` | A new version is waiting |
| `Pwa.offlineReady` | Assets are cached for offline use |
| `Pwa.online` | The browser has a connection |

React, Vue, Svelte and Angular starters get the same prompt as a component.
