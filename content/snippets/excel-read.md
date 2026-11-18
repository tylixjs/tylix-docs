```js
import { toXlsx, fromXlsx, parseCsv, toCsv } from "@tylix/excel"

// One line each way
const buffer = await toXlsx(users)
const rows = await fromXlsx(upload, { sheet: "Contacts" })
// [{ Name: "Ada", Email: "ada@…", Joined: Date }, …]

// CSV: detects , ; tab and |, handles quotes and BOMs
const people = parseCsv(text, { types: true })

// =, +, - and @ at the start of a cell are neutralized
const csv = toCsv(rows, { bom: true })

router.get("/orders/export", async (req, res) => {
  await res.download(ordersExport(await Order.all()), "orders.xlsx")
})
```
