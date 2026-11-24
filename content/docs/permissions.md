---
title: Roles & permissions
description: Roles, permissions, wildcards, inheritance, denies that always win, teams and expiring grants, with the same answer on the server and in the browser.
---

```bash
npx tylix make:permissions
npm install && npx tylix migrate && npx tylix db:seed
npx tylix permission:assign admin you@example.com
```

This writes `app/permissions` (the instance, its rules and the starting roles), `Role` and `Permission` models, a migration, a seeder, an admin API and, for `.tyx` apps, an admin page at `/admin/access` for creating roles and giving users roles. A change that would remove your own access to that page is refused.

> [!TIP]
> The [Tylix Permissions overview](/permissions) shows the whole model, the React, Vue, Svelte and Angular helpers, and how it compares to spatie/laravel-permission.

## Define roles

```ts
await permissions.sync({
  permissions: ["posts.view", "posts.create", "posts.update", "posts.delete", "users.manage"],
  roles: {
    writer: ["posts.view", "posts.create"],
    editor: { inherits: ["writer"], permissions: ["posts.*", "!posts.delete"] },
    admin: { inherits: ["editor"], permissions: ["users.*"] },
    "super-admin": [],
  },
});
```

`sync()` is declarative and idempotent, so running the seeder again only applies what changed.

## Check access

```ts
await permissions.for(user).assignRole("editor");

await permissions.can(user, "posts.update");  // true, from posts.*
await permissions.can(user, "posts.delete");  // false, denied by the role
await permissions.hasRole(user, "writer");    // true, inherited
```

## Names and wildcards

| Grant | Covers |
| --- | --- |
| `*` | everything |
| `posts.*` | `posts.edit`, `posts.edit.own`, … (one or more segments) |
| `posts.*.own` | `posts.edit.own` (exactly one segment in the middle) |
| `posts.edit,delete` | `posts.edit` and `posts.delete` |
| `!posts.delete` | in a role, a deny |

> [!IMPORTANT]
> A deny always wins over an allow, from any role or direct grant. Only the super-admin role passes everything, denies included.

Concrete names must exist before they're granted, so a typo fails loudly with a `PermissionError` (`code: "PERMISSION_DOES_NOT_EXIST"`). Patterns never need a row.

## Users

```ts
const u = permissions.for(user);

await u.assignRole("admin", { team: "acme" });               // only in team acme
await u.assignRole("support", { expiresAt: "2027-01-01" });  // until then
await u.givePermission("billing.view");
await u.deny("posts.publish");                               // beats every role

await u.can("posts.publish");
await u.canAny(["posts.update", "posts.publish"]);
await u.canAll(["posts.update", "posts.publish"]);
```

## On a page

A `.tyx` page can require permissions, and its template has `can()`, `cannot()`, `canAny()` and `hasRole()`:

```tyx
page Posts

permissions
  posts.view

template
{{#if can("posts.create")}}
  <a href="/posts/new">New post</a>
{{/if}}
```

A page's `permissions` block is enforced: guests go to login, and everyone else without access sees a 403. The browser answers synchronously from `user.access`, which `GET /api/me` carries, using the same rules as the server. `npx tylix dev` marks guarded routes with 🔑 and the permission they need.

## From the terminal

| Command | |
| --- | --- |
| `npx tylix permission:create-role support users.view tickets.* --inherits writer` | Create a role |
| `npx tylix permission:create-permission invoices.export --description "..."` | Create a permission |
| `npx tylix permission:assign admin ada@example.com [--team acme] [--expires 2027-01-01]` | Give a role |
| `npx tylix permission:revoke admin ada@example.com` | Take it back |
| `npx tylix permission:show [user]` | The role × permission matrix, or one user's access |
| `npx tylix permission:sync` | Apply the definition in `app/permissions` |
