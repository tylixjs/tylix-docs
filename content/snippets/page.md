```tyx
page Todos

title "Todos"

state
  todos: []
  draft: ""

computed
  remaining() {
    return this.todos.filter(t => not t.done).length
  }

action
  async add() {
    const result = await postApi("todos", { title: this.draft })
    if result.ok {
      this.todos.push(result.data.data)
      this.draft = ""
    }
  }

onMount
  async {
    const result = await getApi("todos")
    this.todos = result.data.data
  }

template
  <form onsubmit.prevent="{{ add() }}">
    <input bind:value="{{ draft }}" placeholder="What needs doing?" />
  </form>

  <p>{{ remaining }} left</p>

{{#each todo in todos}}
  <label class:done="{{ todo.done }}">
    <input type="checkbox" bind:checked="{{ todo.done }}" />
    {{ todo.title }}
  </label>
{{/each}}
```
