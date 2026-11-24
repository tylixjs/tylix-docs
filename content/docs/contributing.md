---
title: Contributing
description: How to run Tylix from source, the test suites, and how releases are made.
---

```bash
git clone https://github.com/Mbiyrukzz/tylix.git
cd tylix
npm install
npm test
```

Contributions, ideas and bug reports are welcome.

## Test suites

| Command | |
| --- | --- |
| `npm test` | Unit tests for every package |
| `npm run test:e2e -- <url>` | Browser checks against a running app |
| `npm run test:e2e:frontends` | Scaffolds the React, Vue, Svelte, Angular and native starters from this checkout, then runs the browser checks against each under `npx tylix dev` and `npx tylix start` (`--only react,vue` picks some) |
| `npm run test:compat` | Each frontend adapter against the oldest and newest framework major it supports |
| `npm run test:editor` | Builds the VS Code extension, runs its grammar tests and the LSP protocol test |
| `npm run verify` | The release check: unit tests, then the frontend matrix |
| `npm run bench` | Compares the server with Node, Fastify, Hono and Express |

## Releases

```bash
npm run release -- <version> bump|dry|publish
```

Every package is versioned and published together.

## Improving these docs

Each page has an **Edit this page on GitHub** link at the bottom. Pages are Markdown files in `content/docs`, and the sidebar order is in `content/docs/nav.json`.
