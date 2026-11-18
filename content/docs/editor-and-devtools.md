---
title: Editor & DevTools
description: A VS Code extension and language server for .tyx, an error overlay that points at the exact line, and a browser panel to inspect live state.
---

## VS Code

Install **Tylix (.tyx)** (`tylix.tyx-language`) from the Extensions view. It adds:

- Highlighting and snippets for `.tyx` files.
- A language server with errors as you type, type checking, completion (members, capabilities, imported components), hover, go to definition and an outline.
- The **Tylix Dark** and **Tylix Light** color themes. The code on this site uses them.
- A Tylix file icon and a folder icon theme for `pages`, `components`, `capabilities`, `controllers`, `models` and more.

## Other editors

`@tylix/language-server` runs over stdio:

```bash
tylix-language-server --stdio
```

Its README covers Neovim and Helix setup. Files that don't start with `page`, `component` or `capability` are left alone.

## Error overlay

Under `tylix dev`, a compile error opens a page showing:

- the failing file (the component or capability itself, not the page that used it);
- the line and column, underlined;
- every other problem in that file;
- an **Open in editor** link.

It reloads by itself when you save a fix. Uncaught errors and unhandled rejections in the browser show in a dismissible overlay.

## Tylix DevTools

A Chrome and Firefox extension (Chrome Web Store: *Tylix DevTools*). It adds a **Tylix** panel that shows the live page, layout, components and capabilities. You can:

- edit state and watch the page update;
- run actions;
- highlight a component on the page.

It works on pages served by `tylix dev` and asks for no site permissions. Production pages don't install the hook it uses.
