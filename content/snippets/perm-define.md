```js
// app/permissions/index.js (tylix make:permissions)
import { createPermissions, ormStore } from "@tylix/permissions"

export const permissions = createPermissions({
  store: ormStore({ Model }),
  superAdmin: "super-admin",
  defaultRoles: ["member"],
})

// Declarative and idempotent: safe to run in every seed
await permissions.sync({
  permissions: ["posts.view", "posts.create", "posts.update", "posts.delete", "users.manage"],
  roles: {
    member: ["posts.view"],
    writer: ["posts.create"],
    editor: { inherits: ["writer"], permissions: ["posts.*", "!posts.delete"] },
    admin: { inherits: ["editor"], permissions: ["users.*"] },
    "super-admin": [],
  },
})
```
