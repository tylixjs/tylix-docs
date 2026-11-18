```js
const u = permissions.for(user)

await u.assignRole("editor")
await u.assignRole("admin", { team: "acme" })              // only in team acme
await u.assignRole("support", { expiresAt: "2027-01-01" }) // until then
await u.deny("posts.publish")                              // beats every role

await u.can("posts.update")    // true, from posts.*
await u.can("posts.delete")    // false, the editor role denies it
await u.hasRole("writer")      // true, inherited
await u.authorize("users.manage", { team: "acme" }) // throws a 403 when not
```
