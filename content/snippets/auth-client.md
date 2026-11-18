```js
import { createAuthClient } from "@tylix/auth/client"

const client = createAuthClient({ onSignOut: () => location.assign("/login") })

// Concurrent 401s share one refresh, then every request is replayed
const projects = await client.fetch("/api/projects")

// Every open tab hears about it
await client.signOut({ everywhere: true })
```
