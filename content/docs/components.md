---
title: Components
description: Reusable pieces of UI with props, their own state and actions, and slots for children.
---

A component is a `.tyx` file that starts with `component <Name>`. It has the same sections as a page: `props`, `state`, `computed`, `action`, `onMount`, `template` and `style`.

```bash
tylix make:component StatCard
```

```tyx title="app/pages/components/StatCard.tyx"
component StatCard

import { IconTrendingUp } from "tylix-icons"

props
  label: string
  value: number
  change: number

computed
  up() {
    return this.change >= 0
  }

template
  <div class="card">
    <p class="label">{{ label }}</p>
    <p class="value">{{ value.toLocaleString() }}</p>
    <p class:up class:down="{{ not up }}">
      <IconTrendingUp /> {{ change }}%
    </p>
  </div>
```

Use it from a page or another component:

```tyx
import StatCard from "./components/StatCard"

template
  <StatCard label="Signups" value="{{ stats.signups }}" change="{{ stats.change }}" />
```

## Props

Props are declared with a type and passed as attributes. A static attribute is a string. Use `{{ }}` to pass any other value:

```tyx
<Avatar name="Ada" size="{{ 48 }}" user="{{ Auth.user }}" />
```

## Slots

Components take children. Inside the component, `<slot />` renders them, `<slot name="x">` renders the children marked `slot="x"`, and content inside `<slot>` is the fallback.

```tyx title="Card.tyx"
component Card

props
  title: string

template
  <article>
    <h2>{{ title }}</h2>
    <slot>No content</slot>
    <footer><slot name="footer" /></footer>
  </article>
```

```tyx
<Card title="Hello">
  <p>Body, with the page's own state: {{ count }}</p>
  <button slot="footer" onclick="{{ count = count + 1 }}">+1</button>
</Card>
```

Slot content belongs to the page that wrote it, so `{{ count }}` above reads the **page's** state, not the card's.

## Icons

`tylix-icons` ships 537 icons as components for every frontend:

```tyx
import { IconBolt, IconGithub, IconSearch } from "tylix-icons"

template
  <IconBolt class="w-4 h-4" />
```

## Packages

Any npm package can ship `.tyx` components. It only needs a `tylix-components.json` manifest that maps each exported name to a `.tyx` file. There's no bundler or `exports` map to configure.
