---
title: Validation
description: Write the rules once. The API enforces them and the browser shows the same errors before the request is sent.
---

```ts title="app/validators/SignupValidator.ts"
import { validate, required, isEmail, minLength } from "@tylix/shared/validation";

export function validateSignup(input: unknown) {
  return validate(input, {
    email: [required, isEmail],
    password: [required, minLength(8)],
  });
}
```

`validate` returns `{ valid, errors }`, where `errors` maps each field to its messages.

## On the server

```ts
const result = validateSignup(req.body);
if (!result.valid) {
  res.status(422);
  return res.json({ errors: result.errors });
}
```

Generated features do exactly this: `npx tylix make:feature` writes a validator from the fields you list, and `required` fields are enforced on create and update.

## In the browser

Validators import nothing server-only, so pages can use the same file. The Starter App's login and register forms import the app's own `AuthValidator`:

```tyx
page Register

action
  submit() {
    const result = validateSignup({ email: this.email, password: this.password })
    if not result.valid {
      this.errors = result.errors
      return null
    }
    // …send it
  }
```

> [!TIP]
> Showing the server's `errors` object with the same markup as your client-side errors means a rule you forgot in the browser still shows up correctly. The two paths can't drift apart.
