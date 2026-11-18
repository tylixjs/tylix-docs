```ts
// app/models/Todo.ts
import { Model, Searchable, use } from "@tylix/orm";
import { TodoObserver } from "../observers/TodoObserver.js";

export class Todo extends use(Model, Searchable({ fields: ["title"] })) {
    static table = "todos";
    static fillable = ["title", "done", "user_id"];
    static observers = [TodoObserver];
}

// Anywhere on the server
const open = await Todo.where("done", false).latest().limit(10).get();
const page = await Todo.paginate({ page: 2, limit: 20 });
const found = await Todo.search("invoice");
```
