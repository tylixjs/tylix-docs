---
title: Migrations
description: Create and change tables with indexes, foreign keys and column changes that work on every database, with batches and rollbacks.
---

## Writing a migration

```bash
npx tylix make:migration create_tags_table name:string:unique
npx tylix make:migration add_status_to_posts_table status:string:index:required:default=draft
npx tylix make:migration tune_posts --table=posts      # an empty alterTable
```

The name says what it does: `create_x_table`, `add_y_to_x_table` and `remove_y_from_x_table` fill in the right code.

```ts title="database/migrations/20261118_create_posts_table.ts"
export const up = async (schema) => {
  await schema.createTable("posts", (table) => {
    table.increments("id");
    table.string("title", 200).notNullable();
    table.string("slug").unique();
    table.enum("status", ["draft", "published"]).default("draft").index();
    table.decimal("price", 10, 2).default(0);
    table.foreignId("user_id").constrained().cascadeOnDelete();
    table.timestamps();
    table.index(["status", "created_at"]);
  });
};

export const down = async (schema) => {
  await schema.dropTable("posts");
};
```

## Changing a table

```ts
export const up = async (schema) => {
  await schema.alterTable("posts", (table) => {
    table.string("subtitle").nullable();                // add
    table.string("title", 500).notNullable().change();  // change type, null, default
    table.renameColumn("body", "content");
    table.dropIndex(["status"]);                        // by columns or by name
    table.dropForeign(["user_id"]);
    table.dropColumn("legacy");
  });
};
```

> [!NOTE]
> SQLite can't change a column in place, so `change()` and foreign-key changes rebuild the table and keep its rows, indexes and keys. On MongoDB, indexes, renames and dropped fields apply, and the rest is ignored.

## Running migrations

```bash
npx tylix migrate                     # run new migrations, as one batch
npx tylix migrate:status              # what has run, and in which batch
npx tylix migrate:rollback            # undo the last batch
npx tylix migrate:rollback --step=2   # undo the last two migrations
npx tylix migrate:refresh --seed      # roll everything back, migrate, seed
npx tylix migrate:fresh               # drop every table, migrate (--force in production)
npx tylix db:seed                     # run app/seeders
```

On SQLite and PostgreSQL each migration runs in a transaction, so one that fails changes nothing.

## Reference

### Column types

`increments`, `bigIncrements`, `string(n)`, `char`, `text`, `mediumText`, `longText`, `boolean`, `integer`, `bigInteger`, `smallInteger`, `float`, `decimal(p, s)`, `date`, `datetime`, `timestamp`, `time`, `json`, `uuid`, `binary`, `enum`, `foreignId`, `timestamps()`, `softDeletes()`.

### Modifiers

`nullable()` (the default), `notNullable()`, `default(value)`, `useCurrent()`, `unique()`, `index()`, `primary()`, `unsigned()`, `comment()`, `after()`, `change()`, plus `references`, `on`, `constrained`, `onDelete` and `onUpdate`.

### Table methods

`createTable`, `alterTable`, `dropTable`, `renameTable`, `hasTable`, `hasColumn`, `getColumns`, `getIndexes` and `raw`. Laravel's names (`create`, `table`, `dropIfExists`) work too.

Indexes are named `<table>_<columns>_index`, `_unique` or `_foreign`, so you can drop them by their columns.

### Field modifiers on the CLI

`make:feature`, `field:add` and `make:migration` take modifiers after the type: `unique`, `index`, `required`, `nullable` and `default=<value>`.

```bash
npx tylix field:add Invoice status:string:index:default=draft
npx tylix field:remove Invoice legacy_code
```
