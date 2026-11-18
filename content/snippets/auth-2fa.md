```js
import { generateTotpSecret, totpUri, verifyTotp, generateRecoveryCodes } from "@tylix/auth"

// Enrol: show the URI as a QR code, store the secret sealed
const secret = generateTotpSecret()
const uri = totpUri({ secret, issuer: "Acme", account: user.email })
await db.users.update(user.id, { totp: await auth.sealer.seal(secret, { purpose: "totp" }) })

// Verify: the same code can't be used twice
const { valid, step } = await verifyTotp(code, await auth.sealer.unseal(user.totp, { purpose: "totp" }), {
  lastUsedStep: user.totpStep,
})
if (valid) await db.users.update(user.id, { totpStep: step })

const { codes, hashes } = await generateRecoveryCodes() // show once, store hashes
```
