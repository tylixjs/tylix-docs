```js
// app/api/auth/[...auth]/route.js: refresh, logout, sessions, devices
import { nextAuthHandlers } from "@tylix/auth/next"
export const { GET, POST, DELETE } = nextAuthHandlers(auth)

// middleware.js: a stateless check that runs on the edge
import { nextMiddleware } from "@tylix/auth/next"
export default nextMiddleware(auth, { protect: ["/dashboard"], loginPath: "/login" })

// Server Components and Server Actions
import { headers } from "next/headers"
const session = await auth.getSession(await headers())
```
