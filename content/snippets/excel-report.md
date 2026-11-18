```js
// app/exports/OrdersExport.js (tylix make:export Orders)
import { createWorkbook } from "@tylix/excel"

export function ordersExport(orders) {
  const workbook = createWorkbook({ title: "Q3 orders", currency: "EUR" })

  const sheet = workbook.addSheet("Orders", {
    columns: [
      { header: "Order", key: "id" },
      { header: "Customer", key: "customer.name" },
      { header: "Date", key: "createdAt", format: "date" },
      { header: "Status", key: "status" },
      { header: "Total", key: "total", format: "currency", total: "sum" },
    ],
    rows: orders, // header frozen, filters on, columns sized
  })

  sheet.validate("D2:D500", { list: ["Paid", "Pending", "Refunded"] })
  sheet.conditionalFormat("E2:E500", { type: "dataBar", color: "#60a5fa" })
  return workbook
}
```
