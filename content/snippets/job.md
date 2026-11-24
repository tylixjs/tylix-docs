```js
// app/jobs/SendInvoice.js (npx tylix make:job SendInvoice)
export const SendInvoice = {
  tries: 3,
  backoff: [10, 60, 300],
  timeout: 120,
  async handle({ invoiceId }, job) {
    const invoice = await Invoice.find(invoiceId)
    await mail.to(invoice.email).send(new InvoiceMail(invoice))
  },
  async failed(payload, error) {
    Log.channel("billing").error("Invoice not sent", { error })
  },
}

// From a controller
await dispatch("SendInvoice", { invoiceId: 12 }, { delay: 60 })
```
