```tyx
page Posts

// Enforced: guests go to login, everyone else without it sees a 403
permissions
  posts.view

template
  <h1>Posts</h1>
{{#if can("posts.create")}}
  <a href="/posts/new">New post</a>
{{/if}}
{{#if hasRole("admin")}}
  <a href="/admin/access">Manage access</a>
{{/if}}
```
