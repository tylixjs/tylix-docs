```jsx
import { PermissionsProvider, Can, useCan } from "@tylix/permissions/react"

export function App({ user }) {
  return (
    <PermissionsProvider user={user}>
      <Can permission="posts.create"><NewPostButton /></Can>
      <Can role="admin" fallback={<p>Admins only.</p>}><AdminPanel /></Can>
    </PermissionsProvider>
  )
}

// Synchronous: reads user.access, with the server's matching rules
const canPublish = useCan("posts.publish")
```
