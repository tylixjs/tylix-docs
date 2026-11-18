---
title: Excel & CSV
description: Styled .xlsx exports from an array of objects, real reports with totals, dropdowns and conditional formatting, and imports back into objects.
---

`@tylix/excel` writes Excel files from your data and reads your data from Excel files. It runs in Node, Deno, Bun, edge runtimes and the browser, with no dependencies.

```bash
npm install @tylix/excel
tylix make:export Orders   # app/exports/OrdersExport.js
```

## One line each way

```js
import { toXlsx, fromXlsx } from "@tylix/excel";

const buffer = await toXlsx(users);           // header row from the keys, sized columns, filters
const rows = await fromXlsx("./import.xlsx"); // [{ Name: "Ada", Email: "…", Joined: Date }, …]
```

Headers are bold and shaded, the header row is frozen with filter buttons, columns fit their content and dates are real Excel dates.

## A report

```js title="app/exports/OrdersExport.js"
import { createWorkbook } from "@tylix/excel";

export function ordersExport(orders) {
  const workbook = createWorkbook({ title: "Q3 orders", creator: "Acme", currency: "EUR" });

  const sheet = workbook.addSheet("Orders", {
    columns: [
      { header: "Order", key: "id" },
      { header: "Customer", key: "customer.name" },
      { header: "Date", key: "createdAt", format: "date" },
      { header: "Status", key: "status" },
      { header: "Total", key: "total", format: "currency", total: "sum" },
      { header: "Margin", key: "margin", format: "percent", total: "average" },
    ],
    rows: orders,
  });

  sheet.validate("D2:D500", { list: ["Paid", "Pending", "Refunded"] });
  sheet.conditionalFormat("E2:E500", { type: "dataBar", color: "#60a5fa" });
  sheet.print = { orientation: "landscape", fitToWidth: true, repeatHeader: true };
  return workbook;
}
```

```js title="app/routes/web.ts"
router.get("/api/orders/export", async (req, res) => {
  await res.download(ordersExport(await Order.all()), "orders.xlsx");
});
```

- `total` adds a totals row: `"sum"`, `"average"`, `"count"`, `"min"`, `"max"`, a label or `{ formula }`.
- `table: true` makes the data an Excel table with banded rows.
- `freeze: false`, `autoFilter: false` and `autoWidth: false` turn the defaults off.
- Several sheets at once: `toXlsx({ Customers: customers, Orders: { rows, columns } })`.

## Cells and styles

```js
sheet.set("A1", "Hello", { bold: true, size: 14 });
sheet.set("B1", 1250.5, { format: "currency" });
sheet.set("D1", { formula: "SUM(B1:B10)" });
sheet.set("E1", { text: "Docs", link: "https://tylix.dev" });
sheet.merge("A1:D1", "Quarterly report", { bold: true, align: "center" });
sheet.column("B").width = 30;
sheet.freeze("B2");
sheet.addImage("./logo.png", { at: "H2", width: 120 });
```

Styles are plain objects: `bold`, `italic`, `underline`, `font`, `size`, `color`, `fill`, `align`, `wrap`, `border` and `format`. Named formats include `integer`, `decimal`, `currency`, `accounting`, `percent`, `date`, `datetime`, `time` and `text`; any Excel format code works too. Identical styles share one entry, so styling every cell doesn't grow the file.

## Validation and conditional formatting

```js
sheet.validate("C2:C100", { list: ["Low", "Medium", "High"] });
sheet.validate("E2:E100", { type: "whole", min: 0, max: 100, error: "Enter 0–100" });
sheet.conditionalFormat("B2:B100", { operator: ">", value: 1000, style: { fill: "#dcfce7" } });
sheet.conditionalFormat("A2:F100", { formula: '$D2="Overdue"', style: { fill: "#fee2e2" } });
sheet.conditionalFormat("E2:E100", { type: "colorScale" });
```

## Reading

```js
import { readWorkbook, fromXlsx } from "@tylix/excel";

const rows = await fromXlsx(file, { sheet: "Orders" });

const workbook = await readWorkbook(file); // path, URL, bytes, Blob, .xlsx or .csv
const sheet = workbook.sheet("Orders");
sheet.get("B2");                  // number, string, boolean, Date or null
sheet.toObjects({ headerRow: 2 });
```

Numbers in date formats become `Date` objects (`raw: true` keeps serials), errors become `{ error: "#N/A" }`, and formulas give the result Excel last saved.

## CSV

```js
import { parseCsv, toCsv } from "@tylix/excel";

parseCsv(text, { types: true });      // detects , ; tab and |
toCsv(rows, { bom: true });           // RFC 4180, opens correctly in Excel
```

> [!IMPORTANT]
> `toCsv` prefixes cells starting with `=`, `+`, `-` or `@` with `'`, so a spreadsheet can't run a formula a user typed. Keep it on for anything users can edit.

## Output

`toBuffer()`, `save(path)` (`.xlsx` or `.csv`), `send(res, name)`, `toResponse(name)`, and in the browser `toBlob()` and `download(name)`. A workbook can be a mail attachment's `content`, and `.tyx` pages import the package from `/_tylix/excel/index.js`.

> [!NOTE]
> Formulas are calculated by Excel when the file is opened. Charts, pivot tables, comments, sheet protection and `.xls` aren't supported, and reading keeps values, not cell styles.
