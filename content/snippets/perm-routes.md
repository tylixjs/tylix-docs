```js
// Tylix, Express, Connect
router.post("/api/posts", permissions.middleware("posts.create"), handler)
router.get("/admin", permissions.middleware({ role: "admin" }), handler)

// "May they edit *this* post?": a rule on top of stored permissions
permissions.rule("posts.update", ({ user, resource, granted }) =>
  granted || resource.authorId === user.id)

router.put("/api/posts/:id", permissions.guard(update, "posts.update", {
  resource: (req) => Post.find(req.params.id),
}))

// Hono, Next.js, SvelteKit, Workers: null when allowed
const denied = await permissions.guardRequest(user, "posts.create")
if (denied) return denied
```
