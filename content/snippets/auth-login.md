```js
import { verifyPassword } from "@tylix/auth/password"

export async function POST(request) {
  const { email, password } = await request.json()
  const user = await db.users.findByEmail(email)

  // null for unknown users: the same scrypt work, so timing reveals nothing
  if (!(await verifyPassword(password, user?.passwordHash ?? null))) {
    return Response.json({ error: "Wrong email or password" }, { status: 401 })
  }

  const { cookies } = await auth.signIn(request, user.id)
  return jsonWithCookies({ ok: true }, { cookies })
}
```
