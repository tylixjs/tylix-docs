---
title: Template syntax
description: Interpolation, conditionals, lists, two-way binding, class and style directives, event modifiers, promises and slots.
---

Templates are HTML with `{{ }}` for expressions and `{{# }}` for blocks. Expressions can read state, computed values, props, capabilities and loop variables.

## Text and attributes

```tyx
<p>{{ user.name }}</p>
<a href="{{ `/posts/${post.id}` }}">{{ post.title }}</a>
<img src="{{ post.cover }}" alt="" />
```

Text is always escaped. To render HTML you trust, use `{{@html}}`. Scripts inside it never run.

```tyx
<article>{{@html post.bodyHtml}}</article>
```

## Conditionals

```tyx
{{#if loading}}
  <p>Loading…</p>
{{#else if error}}
  <p class="error">{{ error }}</p>
{{#else}}
  <PostList posts="{{ posts }}" />
{{/if}}
```

## Lists

```tyx
{{#each item, i in items}}
  <li>{{ i + 1 }}. {{ item.title }}</li>
{{#else}}
  <li>Nothing here yet.</li>
{{/each}}
```

The `{{#else}}` branch renders when the list is empty.

## Events

```tyx
<button onclick="{{ save() }}">Save</button>
<button onclick="{{ count = count + 1 }}">+1</button>
<input oninput="{{ search($event.target.value) }}" />
```

### Modifiers

```tyx
<form onsubmit.prevent="{{ save() }}">
<a onclick.prevent.stop="{{ open() }}">
<input onkeydown.enter="{{ add() }}" onkeydown.esc="{{ cancel() }}" />
<textarea onkeydown.ctrl.enter="{{ send() }}"></textarea>
```

| Kind | Modifiers |
| --- | --- |
| Behaviour | `prevent` `stop` `self` `once` `capture` `passive` |
| System keys | `ctrl` `shift` `alt` `meta` |
| Keys | `enter` `esc` `space` `tab` `up` `down` `left` `right` `delete` `backspace` |

## Two-way binding

```tyx
<input bind:value="{{ query }}" />
<input type="number" bind:value="{{ qty }}" />            <!-- stores numbers -->
<select bind:value="{{ country }}">…</select>
<input type="checkbox" bind:checked="{{ agree }}" />
<input type="radio" value="s" bind:group="{{ size }}" />
<input type="checkbox" value="a" bind:group="{{ tags }}" /> <!-- an array of checked values -->
```

`bind:value` works on text inputs, number inputs, `textarea`, `select` and `select multiple`.

## Classes and styles

```tyx
<li class="item" class:active="{{ id is selected }}" class:done>…</li>
<div style:color="{{ color }}" style:--gap="{{ gap }}" style:fontSize="{{ size }}"></div>
```

`class:done` on its own is shorthand for `class:done="{{ done }}"`. These directives work alongside a dynamic `class` or `style` attribute.

## Promises

```tyx
{{#await loadPosts()}}
  <p>Loading…</p>
{{#then posts}}
{{#each p in posts}}<h2>{{ p.title }}</h2>{{/each}}
{{#catch error}}
  <p>{{ error.message }}</p>
{{/await}}

{{#await stats then s}}{{ s.total }}{{/await}}
```

## Literal code

Inside `<pre>`, `{{ }}` is printed as-is and whitespace is kept, which is handy for showing template code:

```tyx
<pre>{{#each post in posts}}
  {{ post.title }}
{{/each}}</pre>
```
