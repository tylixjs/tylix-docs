---
title: PDF documents
description: Invoices, reports and certificates from plain objects, with tables that span pages, charts, QR codes, Unicode fonts and HTML. In any JavaScript runtime.
---

`@tylix/pdf` builds PDFs from plain JavaScript objects. You describe the content; it lays out the pages, wraps text, breaks tables across pages and numbers them. It runs in Node, Deno, Bun, edge runtimes and the browser, with no dependencies.

```bash
npm install @tylix/pdf
npx tylix make:pdf Invoice   # app/pdfs/InvoicePdf.js
```

## A first document

```js title="app/pdfs/InvoicePdf.js"
import { createPdf } from "@tylix/pdf";

export function invoicePdf(invoice) {
  return createPdf({
    title: `Invoice #${invoice.number}`,
    pageNumbers: true,
    content: [
      { h1: `Invoice #${invoice.number}` },
      { text: ["Billed to ", { text: invoice.customer.name, bold: true }] },
      {
        table: {
          columns: [
            { header: "Item", key: "name", width: "*" },
            { header: "Qty", key: "qty" },
            { header: "Price", key: "price", format: "currency" },
          ],
          rows: invoice.items,
          zebra: true,
        },
      },
      { qr: `https://acme.dev/pay/${invoice.id}`, size: 72, align: "right" },
    ],
  });
}
```

## Sending it

```js title="app/routes/web.ts"
router.get("/api/invoices/:id/pdf", async (req, res) => {
  const invoice = await Invoice.find(req.params.id);
  await res.download(invoicePdf(invoice), `invoice-${invoice.number}.pdf`);
});
```

| Method | |
| --- | --- |
| `toBuffer()` | `Buffer` in Node, `Uint8Array` elsewhere |
| `save(path)` | Node, Deno, Bun |
| `send(res, name)` | Node, Express and Tylix responses |
| `toResponse(name)` | a fetch `Response`: Hono, Next.js routes, Workers |
| `toBlob()`, `download(name)`, `open()` | the browser |
| `toDataUrl()` | anywhere |

`send`, `toResponse` and `download` set `Content-Type` and a `Content-Disposition` that keeps non-ASCII names intact. Pass `{ inline: true }` to show the PDF instead of downloading it.

A PDF can also be a mail attachment: `{ filename: "invoice.pdf", content: invoicePdf(invoice) }`. In the browser, `.tyx` pages import the package from `/_tylix/pdf/index.js`.

## Content

`content` is a list of nodes. A string is a paragraph and an array is a stack.

```js
"A plain paragraph."
{ h1: "Title" }                                   // h1 to h6
{ text: ["Mixed ", { text: "bold", bold: true }, " and ", { text: "a link", link: "https://tylix.dev" }] }
{ text: "Justified…", align: "justify", style: "muted" }
{ ul: ["One", "Two", ["Three", { ul: ["Nested"] }]] }
{ ol: ["First", "Second"], type: "lower-alpha" }
{ columns: [{ image: "logo", width: 60 }, { text: "INVOICE", align: "right" }], gap: 16 }
{ box: ["A callout"], padding: 12, background: "#eff6ff", radius: 6 }
{ hr: true }  { spacer: 24 }  { pageBreak: true }
{ toc: true }                                     // a clickable table of contents
```

Every node takes `margin`, `padding`, `background`, `border`, `radius`, `width`, `id`, `pageBreak`, `unbreakable` and `keepWithNext`. `absolute: [x, y]` puts a node at a fixed spot, for stamps and signatures.

## Tables

```js
{
  table: {
    columns: [
      { header: "#", key: "id", width: 40 },
      { header: "Customer", key: "customer.name", width: "*" },
      { header: "Date", key: "date", format: "date" },
      { header: "Total", key: "total", format: "currency", footer: (rows) => sum(rows, "total") },
      { header: "Status", value: (row) => ({ text: row.status, color: row.paid ? "#16a34a" : "#dc2626" }) },
    ],
    rows: orders,
    borders: "horizontal",     // grid, outer, none
    emptyText: "No orders yet",
  },
}
```

- **Widths:** points, `"25%"`, `"*"` or `"2*"` to share what's left, or `"auto"` (the default).
- **Formats:** `currency`, `number`, `integer`, `decimal`, `percent`, `date`, `datetime`, `time`, or a function. They follow the document's `locale`, `currency` and `timeZone`, and number columns are right-aligned.
- **Page breaks:** the header repeats on every page and tall rows split. `dontBreakRows: true` keeps each row on one page.

## Images, SVG, charts and codes

```js
{ image: "./logo.png", width: 120 }        // path, URL, data: URL or bytes
{ svg: "<svg viewBox='0 0 24 24'>…</svg>", width: 24 }
{ chart: "line", data: series, height: 220 } // any @tylix/charts type
{ qr: "https://tylix.dev", size: 96 }
{ barcode: "400638133393", type: "ean13" }   // code128, ean13, upca, ean8, code39
{ html: "<h2>Terms</h2><p>Payment is due in <b>30 days</b>.</p>" }
```

## Pages, headers and fonts

```js
createPdf({
  size: "A4",                     // A0–A6, B4, B5, Letter, Legal, Tabloid or [w, h]
  margins: [56, 48],              // points, or "2cm", "0.75in"
  header: (page) => (page.page > 1 ? { text: "Acme Report", align: "right" } : null),
  footer: { text: "Page {page} of {pages}", align: "center" },
  watermark: "DRAFT",
  fonts: { Inter: { normal: "./fonts/Inter-Regular.ttf", bold: "./fonts/Inter-Bold.ttf" } },
  fallbackFonts: ["NotoSansJP"],
  defaultStyle: { font: "Inter", size: 11 },
});
```

Helvetica, Times and Courier need no files but only cover Western European text. TrueType fonts are subset to the glyphs you use, so a large CJK font adds only a few kilobytes.

> [!NOTE]
> Arabic, Hebrew and Indic scripts need shaping and right-to-left layout, which isn't done yet. The package writes PDFs; it doesn't read, merge, fill or encrypt existing ones.
