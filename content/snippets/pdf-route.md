```js
// Download it
router.get("/invoices/:id/pdf", async (req, res) => {
  const invoice = await Invoice.find(req.params.id)
  await res.download(invoicePdf(invoice), `invoice-${invoice.number}.pdf`)
})

// Attach it to a mail: @tylix/mail renders it for you
await mailer.send({
  to: customer.email,
  subject: "Your invoice",
  view: "invoice",
  attachments: [{ filename: "invoice.pdf", content: invoicePdf(invoice) }],
})

// Or anywhere else
await pdf.toResponse("a.pdf") // Hono, Next.js, Workers
await pdf.download("a.pdf")   // the browser
```
