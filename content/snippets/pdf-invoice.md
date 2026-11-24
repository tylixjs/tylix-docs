```js
// app/pdfs/InvoicePdf.js (npx tylix make:pdf Invoice)
import { createPdf } from "@tylix/pdf"

export function invoicePdf(invoice) {
  return createPdf({
    title: `Invoice #${invoice.number}`,
    currency: "EUR",
    pageNumbers: true,
    content: [
      { columns: [{ image: "./public/logo.png", width: 90 }, { text: "INVOICE", align: "right", style: "h2" }] },
      { text: ["Billed to ", { text: invoice.customer.name, bold: true }] },
      {
        table: {
          columns: [
            { header: "Item", key: "name", width: "*" },
            { header: "Qty", key: "qty" },
            { header: "Price", key: "price", format: "currency", footer: (rows) => sum(rows, "price") },
          ],
          rows: invoice.items, // your objects, as they are
          zebra: true,
        },
      },
      { qr: `https://acme.dev/pay/${invoice.id}`, size: 72, align: "right" },
    ],
  })
}
```
