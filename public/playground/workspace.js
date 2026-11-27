// Everything the playground page needs that isn't UI: saving to this
// browser, share links, the file tree, and the challenges with their
// checks. The page (app/pages/Playground.tyx) owns the state; these are
// plain functions over it.

const STORAGE_KEY = "tylix-playground:v1";

// ── Saving (this browser only) ──────────────────────────────────────────

export function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && Array.isArray(data.files) ? data : null;
  } catch {
    return null;
  }
}

export function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ── Share links: the files, deflated, in the URL hash ──────────────────
// Nothing is uploaded: the link itself holds the project.

function toBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeProject(files) {
  const json = JSON.stringify({ v: 1, files: files.map((f) => [f.path, f.content]) });
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream === "undefined") return "j" + toBase64Url(bytes);
  return "z" + toBase64Url(await pipe(bytes, new CompressionStream("deflate-raw")));
}

export async function decodeProject(code) {
  const kind = code[0];
  let bytes = fromBase64Url(code.slice(1));
  if (kind === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
  else if (kind !== "j") throw new Error("Unknown link format");
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || !Array.isArray(data.files)) throw new Error("No files in the link");
  return data.files
    .filter((f) => Array.isArray(f) && typeof f[0] === "string" && typeof f[1] === "string")
    .slice(0, 40)
    .map(([path, content]) => ({ path, content }));
}

export function sharedCodeFromHash(hash = location.hash) {
  const m = /^#p=([A-Za-z0-9_-]+)$/.exec(hash);
  return m ? m[1] : null;
}

// ── New files ───────────────────────────────────────────────────────────

export function validNewPath(path, files) {
  const p = path.trim().replace(/^\/+/, "");
  if (!p) return { error: "Give the file a name." };
  if (!/^(?:[A-Za-z0-9_][A-Za-z0-9_.\-]*\/)*[A-Za-z0-9_][A-Za-z0-9_.\-]*$/.test(p) || p.split("/").includes("..")) {
    return { error: "Use letters, numbers, dots, dashes and / for folders." };
  }
  if (!/\.(tyx|css|json|md)$/.test(p)) return { error: "Playground files end in .tyx, .css, .json or .md." };
  if (files.some((f) => f.path === p)) return { error: `${p} already exists.` };
  if (files.length >= 40) return { error: "A playground project can have up to 40 files." };
  return { path: p };
}

// A sensible first version of a new file, so it builds straight away.
export function newFileTemplate(path) {
  const base = path.split("/").pop().replace(/\.\w+$/, "");
  const name = base.replace(/(^|[-_\s]+)(\w)/g, (_, __, c) => c.toUpperCase()).replace(/[^A-Za-z0-9_]/g, "") || "Thing";
  if (path.startsWith("app/capabilities/") && path.endsWith(".tyx")) {
    return `capability ${name}\n\nstate\n  items: []\n\naction\n  add(item) {\n    this.items.push(item)\n  }\n`;
  }
  if (path.startsWith("app/pages/components/") && path.endsWith(".tyx")) {
    return `component ${name}\n\nprops\n  text: string\n\ntemplate\n  <span class="${base.toLowerCase()}">{{ text }}</span>\n`;
  }
  if (path.endsWith(".tyx")) return `component ${name}\n\ntemplate\n  <div></div>\n`;
  if (path.endsWith(".css")) return `/* ${base} */\n`;
  if (path.endsWith(".json")) return "{}\n";
  return "";
}

// ── Challenges ──────────────────────────────────────────────────────────
//
// Each step has a check(ctx) that looks at the code and at the live
// preview. ctx is:
//   files      { [path]: text }        the project now
//   starter    { [path]: text }        the project as it started
//   ok         the last build succeeded
//   symbols    the compiler's outline of every file
//   base       the preview's first snapshot after the last build
//   snapshot   the preview's latest snapshot: { title, headings, tasks,
//              text, inputs, classes } (see previewBridge.js)
//   events     { shared }              things done in the playground UI
// A step that passes once stays done.

function accent(css) {
  return /--accent\s*:\s*([^;]+);/.exec(css ?? "")?.[1]?.trim().toLowerCase() ?? "";
}

function newComponents(ctx) {
  return Object.keys(ctx.files)
    .filter((p) => p.startsWith("app/pages/components/") && p.endsWith(".tyx") && !(p in ctx.starter))
    .map((p) => ({ path: p, name: /^\s*component\s+([A-Za-z_$][\w$]*)/.exec(ctx.files[p])?.[1] }))
    .filter((c) => c.name);
}

function newActions(ctx) {
  const outline = ctx.symbols?.["app/capabilities/Tasks.tyx"]?.symbols ?? [];
  const original = new Set(["add", "remove", "count"]);
  return outline.filter((s) => s.kind === "action" && !original.has(s.name)).map((s) => s.name);
}

// Names declared in a file's outline (from the compiler) of one kind.
function declared(ctx, path, kind) {
  return (ctx.symbols?.[path]?.symbols ?? []).filter((s) => s.kind === kind).map((s) => s.name);
}

// Computed values added to Home.tyx (the starter has visible).
function newComputed(ctx) {
  return declared(ctx, "app/pages/Home.tyx", "computed").filter((n) => n !== "visible");
}

// Template files (pages and components), not capabilities.
function templateFiles(ctx) {
  return Object.entries(ctx.files).filter(([p]) => p.endsWith(".tyx") && !p.startsWith("app/capabilities/"));
}

function count(text, needle) {
  return (text ?? "").split(needle).length - 1;
}

function readsInTemplate(text, name) {
  return new RegExp(`\\{\\{[^}]*\\b${name}\\b[^}]*\\}\\}`).test(text ?? "");
}

// State fields of Home.tyx that an input binds to, other than the starter's draft.
function boundFields(ctx) {
  const home = ctx.files["app/pages/Home.tyx"] ?? "";
  const state = new Set(declared(ctx, "app/pages/Home.tyx", "state"));
  return [...home.matchAll(/bind:value="\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}"/g)].map((m) => m[1]).filter((n) => n !== "draft" && state.has(n));
}

function slotComponents(ctx) {
  return newComponents(ctx).filter((c) => /<slot[\s/>]/.test(ctx.files[c.path]));
}

// Capabilities the learner made, with their state and actions.
function newCapabilities(ctx) {
  return Object.keys(ctx.files)
    .filter((p) => p.startsWith("app/capabilities/") && p.endsWith(".tyx") && !(p in ctx.starter))
    .map((p) => ({ path: p, outline: ctx.symbols?.[p] }))
    .filter((c) => c.outline?.kind === "capability" && c.outline.name)
    .map((c) => ({
      path: c.path,
      name: c.outline.name,
      state: c.outline.symbols.filter((s) => s.kind === "state").map((s) => s.name),
      actions: c.outline.symbols.filter((s) => s.kind === "action").map((s) => s.name),
    }));
}

export const CHALLENGES = [
  {
    id: "customize",
    title: "Customize the dashboard",
    level: "beginner",
    intro: "Make Pixel Tasks yours. Every change you make is compiled by the real Tylix compiler and shows up in the preview.",
    badge: { id: "first-build", name: "First Build", icon: "paint" },
    steps: [
      {
        id: "heading",
        text: "Change the heading in Home.tyx to your own name.",
        file: "app/pages/Home.tyx",
        hint: 'In app/pages/Home.tyx, find the state section and change the value of heading:\n\nstate\n  heading: "Ada\'s Tasks"',
        check: (ctx) => ctx.ok && !!ctx.snapshot?.headings?.[0] && ctx.snapshot.headings[0] !== "Pixel Tasks",
      },
      {
        id: "accent",
        text: "Pick a new accent colour in public/styles.css.",
        file: "public/styles.css",
        hint: "At the top of public/styles.css, change --accent to any colour you like:\n\n:root {\n  --accent: #e8590c;\n}",
        check: (ctx) => ctx.ok && accent(ctx.files["public/styles.css"]) !== "" && accent(ctx.files["public/styles.css"]) !== accent(ctx.starter["public/styles.css"]),
      },
    ],
  },
  {
    id: "create-task",
    title: "Create a task",
    level: "beginner",
    intro: "Tasks live in a capability: shared state that every page and component can use. Add to it from the code, then from the app.",
    badge: { id: "state-keeper", name: "State Keeper", icon: "layers" },
    steps: [
      {
        id: "seed",
        text: "Add a fourth task to the starting list in Tasks.tyx.",
        file: "app/capabilities/Tasks.tyx",
        hint: 'In app/capabilities/Tasks.tyx, add an object to the tasks list. Mind the comma after the one before it:\n\n    { id: 3, title: "Pick a colour palette", status: "todo" },\n    { id: 4, title: "Learn Tylix", status: "doing" }',
        check: (ctx) => ctx.ok && (ctx.base?.tasks?.length ?? 0) >= 4,
      },
      {
        id: "form",
        text: "Type a task into the form in the preview and press Add.",
        hint: "The form calls the addTask action in Home.tyx, which calls Tasks.add(). Watch the console: add() logs every new task.",
        check: (ctx) => ctx.ok && !!ctx.base && (ctx.snapshot?.tasks?.length ?? 0) > ctx.base.tasks.length,
      },
    ],
  },
  {
    id: "component",
    title: "Build a component",
    level: "beginner",
    intro: "Components are .tyx files in app/pages/components/. Each one has its own props, state and template, and any page can use it.",
    badge: { id: "component-crafter", name: "Component Crafter", icon: "puzzle" },
    steps: [
      {
        id: "file",
        text: "Create app/pages/components/StatusBadge.tyx with the New file button.",
        hint: 'Click + in Files and name it app/pages/components/StatusBadge.tyx. Then give it a status prop:\n\ncomponent StatusBadge\n\nprops\n  status: string\n\ntemplate\n  <span class="pill">{{ status }}</span>',
        check: (ctx) => newComponents(ctx).length > 0,
      },
      {
        id: "use",
        text: "Use your component in TaskCard.tyx in place of the status pill.",
        file: "app/pages/components/TaskCard.tyx",
        hint: 'In TaskCard.tyx, replace the <span class="pill"> line with:\n\n    <StatusBadge status="{{ label }}" />\n\nComponents in app/pages/components/ are found by name, so no import is needed.',
        check: (ctx) => ctx.ok && newComponents(ctx).some((c) => Object.entries(ctx.files).some(([p, text]) => p !== c.path && p.endsWith(".tyx") && new RegExp(`<${c.name}[\\s/>]`).test(text))),
      },
    ],
  },
  {
    id: "interactive",
    title: "Make it interactive",
    level: "beginner",
    intro: "Give every task a button that moves it along: Todo, then In progress, then Done.",
    badge: { id: "live-wire", name: "Live Wire", icon: "bolt" },
    steps: [
      {
        id: "action",
        text: "Add an advance(task) action to Tasks.tyx.",
        file: "app/capabilities/Tasks.tyx",
        hint: 'Add this under the other actions in Tasks.tyx:\n\n  advance(task) {\n    if task.status is "todo" {\n      task.status = "doing"\n    } else if task.status is "doing" {\n      task.status = "done"\n    } else {\n      task.status = "todo"\n    }\n  }',
        check: (ctx) => ctx.ok && newActions(ctx).length > 0,
      },
      {
        id: "button",
        text: "Add a button to TaskCard.tyx that calls it.",
        file: "app/pages/components/TaskCard.tyx",
        hint: 'In TaskCard.tyx, next to the delete button:\n\n    <button type="button" onclick="{{ Tasks.advance(task) }}">Next</button>',
        check: (ctx) => ctx.ok && newActions(ctx).some((name) => Object.entries(ctx.files).some(([p, text]) => p.endsWith(".tyx") && !p.startsWith("app/capabilities/") && new RegExp(`Tasks\\.${name}\\s*\\(`).test(text))),
      },
      {
        id: "click",
        text: "Click your button in the preview and watch a task change status.",
        hint: "Every part of the page that reads that task updates on its own: the card, the counters and the filters.",
        check: (ctx) => {
          if (!ctx.ok || !ctx.base || !ctx.snapshot) return false;
          const before = new Map(ctx.base.tasks.map((t) => [t.id, t.status]));
          return ctx.snapshot.tasks.some((t) => before.has(t.id) && before.get(t.id) !== t.status);
        },
      },
    ],
  },
  {
    id: "ship",
    title: "Ship your project",
    level: "beginner",
    intro: "Finish it off and show someone what you made.",
    badge: { id: "shipper", name: "Shipped", icon: "rocket" },
    steps: [
      {
        id: "title",
        text: "Give the browser tab a name: change the title line in Home.tyx.",
        file: "app/pages/Home.tyx",
        hint: 'Near the top of Home.tyx:\n\ntitle "Ada\'s Pixel Tasks"',
        check: (ctx) => ctx.ok && !!ctx.snapshot?.title && ctx.snapshot.title !== "Pixel Tasks",
      },
      {
        id: "share",
        text: "Click Share to copy a link to your project.",
        hint: "The link holds your whole project, compressed. Nothing is uploaded, and anyone who opens it gets their own copy to play with.",
        check: (ctx) => !!ctx.events?.shared,
      },
    ],
  },

  // ── Intermediate: the same app, with the ideas real projects lean on ──
  {
    id: "computed",
    title: "Work it out with computed",
    level: "intermediate",
    intro: "A computed value is worked out from other state and stays up to date on its own. Home.tyx already has one, visible. Add your own: a progress percentage.",
    badge: { id: "calculated", name: "Calculated", icon: "calculator" },
    steps: [
      {
        id: "define",
        text: "Add a progress() computed value to Home.tyx that returns the percentage of tasks that are done.",
        file: "app/pages/Home.tyx",
        hint: 'Under computed in Home.tyx, after visible():\n\n  progress() {\n    if Tasks.tasks.length is 0 {\n      return 0\n    }\n    return Math.round(Tasks.count("done") / Tasks.tasks.length * 100)\n  }',
        check: (ctx) => ctx.ok && newComputed(ctx).length > 0,
      },
      {
        id: "show",
        text: "Show it in the template as a percentage, like “33% done”.",
        file: "app/pages/Home.tyx",
        hint: 'Read a computed value like state, without (). Change the tagline:\n\n  <p class="tagline">{{ progress }}% done</p>\n\nstyles.css has a .progress bar ready if you want one:\n\n  <div class="progress"><span style:width="{{ progress + \'%\' }}"></span></div>',
        check: (ctx) =>
          ctx.ok &&
          newComputed(ctx).some((name) => readsInTemplate(ctx.files["app/pages/Home.tyx"], name)) &&
          /\d\s*%/.test(ctx.snapshot?.text ?? ""),
      },
    ],
  },
  {
    id: "conditional",
    title: "Show and hide with #if",
    level: "intermediate",
    intro: "{{#if}} renders part of a template only while something is true, and {{#else}} covers the rest. Celebrate when every task is done.",
    badge: { id: "decider", name: "Decider", icon: "flag" },
    steps: [
      {
        id: "block",
        text: "Add an {{#if}} block to Home.tyx that shows a message when every task is done.",
        file: "app/pages/Home.tyx",
        hint: 'A computed value keeps the template tidy:\n\n  allDone() {\n    return Tasks.tasks.length > 0 and Tasks.count("done") is Tasks.tasks.length\n  }\n\nThen, above the stats section:\n\n{{#if allDone}}\n    <p class="banner">All done! Time for a break.</p>\n{{/if}}',
        check: (ctx) =>
          ctx.ok &&
          templateFiles(ctx).reduce((n, [, text]) => n + count(text, "{{#if"), 0) >
            Object.entries(ctx.starter).filter(([p]) => p.endsWith(".tyx")).reduce((n, [, text]) => n + count(text, "{{#if"), 0),
      },
      {
        id: "see",
        text: "Finish every task in the preview and watch your message appear.",
        hint: "Use the Next button from Make it interactive, or delete tasks until only done ones are left. The block appears the moment its condition is true and goes away when it isn't.",
        check: (ctx) => {
          const tasks = ctx.snapshot?.tasks ?? [];
          return ctx.ok && !!ctx.base && tasks.length > 0 && tasks.every((t) => t.status === "done") && ctx.snapshot.text !== ctx.base.text;
        },
      },
    ],
  },
  {
    id: "binding",
    title: "Search with two-way binding",
    level: "intermediate",
    intro: "bind:value keeps an input and a state field in step, both ways. The add form already uses it for draft. Use it for a search box.",
    badge: { id: "two-way", name: "Two-Way", icon: "search" },
    steps: [
      {
        id: "field",
        text: "Add a query state field to Home.tyx and a search input bound to it.",
        file: "app/pages/Home.tyx",
        hint: 'In state:\n\n  query: ""\n\nAbove the filters in the template:\n\n    <input class="search" bind:value="{{ query }}" placeholder="Search tasks" />',
        check: (ctx) => ctx.ok && boundFields(ctx).length > 0,
      },
      {
        id: "filter",
        text: "Make visible() keep only the tasks whose title contains the query.",
        file: "app/pages/Home.tyx",
        hint: 'has means "contains", for strings and lists:\n\n  visible() {\n    const q = this.query.trim().toLowerCase()\n    return Tasks.tasks.filter(t => (this.filter is "all" or t.status is this.filter) and t.title.toLowerCase() has q)\n  }',
        check: (ctx) => ctx.ok && boundFields(ctx).some((name) => new RegExp(`this\\.${name}\\b`).test(ctx.files["app/pages/Home.tyx"])),
      },
      {
        id: "type",
        text: "Type in the search box in the preview and watch the list narrow.",
        hint: "Each keystroke updates query, visible is worked out again, and only the cards that changed are touched.",
        check: (ctx) =>
          ctx.ok &&
          !!ctx.base &&
          boundFields(ctx).length > 0 &&
          (ctx.snapshot?.inputs ?? []).some((v) => v.trim() !== "") &&
          (ctx.snapshot?.tasks?.length ?? 0) < ctx.base.tasks.length,
      },
    ],
  },
  {
    id: "slots",
    title: "Wrap content with slots",
    level: "intermediate",
    intro: "A component can take children. <slot /> marks where they go, so one component can frame anything you put inside it.",
    badge: { id: "frame-maker", name: "Frame Maker", icon: "window" },
    steps: [
      {
        id: "panel",
        text: "Create app/pages/components/Panel.tyx with a title prop and a <slot />.",
        hint: 'Click + in Files and name it app/pages/components/Panel.tyx:\n\ncomponent Panel\n\nprops\n  title: string\n\ntemplate\n  <section class="panel">\n    <h2>{{ title }}</h2>\n    <slot />\n  </section>',
        check: (ctx) => ctx.ok && slotComponents(ctx).length > 0,
      },
      {
        id: "wrap",
        text: "Wrap the add form in Home.tyx with your component.",
        file: "app/pages/Home.tyx",
        hint: 'Put an opening tag before the <form> and a closing one after </form>:\n\n    <Panel title="New task">\n      <form class="add" ...>\n        ...\n      </form>\n    </Panel>\n\nThe form still calls addTask on the page: slot content belongs to the page that wrote it.',
        check: (ctx) =>
          ctx.ok &&
          slotComponents(ctx).some((c) =>
            templateFiles(ctx).some(([p, text]) => p !== c.path && new RegExp(`<${c.name}[\\s>][\\s\\S]*?</${c.name}>`).test(text)),
          ),
      },
    ],
  },
  {
    id: "capability",
    title: "Make your own capability",
    level: "intermediate",
    intro: "Tasks is a capability: state that every page and component shares. Make one of your own for a display setting, and use it from the page.",
    badge: { id: "architect", name: "Architect", icon: "cube" },
    steps: [
      {
        id: "create",
        text: "Create app/capabilities/Prefs.tyx with a compact state field and an action that flips it.",
        hint: "Click + in Files and name it app/capabilities/Prefs.tyx:\n\ncapability Prefs\n\nstate\n  compact: false\n\naction\n  toggle() {\n    this.compact = not this.compact\n  }",
        check: (ctx) => ctx.ok && newCapabilities(ctx).some((c) => c.state.length > 0 && c.actions.length > 0),
      },
      {
        id: "use",
        text: "Use it in Home.tyx: add it under uses, a button that calls its action, and a class: that reads its state.",
        file: "app/pages/Home.tyx",
        hint: 'uses\n  Tasks\n  Prefs\n\n  <main class="app" class:is-compact="{{ Prefs.compact }}">\n\nNext to the heading:\n\n      <button type="button" class="chip" onclick="{{ Prefs.toggle() }}">Compact</button>',
        check: (ctx) =>
          ctx.ok &&
          newCapabilities(ctx).some((c) =>
            templateFiles(ctx).some(
              ([p, text]) =>
                declared(ctx, p, "uses").includes(c.name) &&
                c.actions.some((a) => new RegExp(`${c.name}\\.${a}\\s*\\(`).test(text)) &&
                c.state.some((f) => new RegExp(`${c.name}\\.${f}\\b`).test(text)),
            ),
          ),
      },
      {
        id: "click",
        text: "Click your button in the preview and watch the page change.",
        hint: "Every page and component that uses Prefs reads the same compact field, so they all change together.",
        check: (ctx) => ctx.ok && !!ctx.base && !!ctx.snapshot && newCapabilities(ctx).length > 0 && ctx.snapshot.classes !== ctx.base.classes,
      },
    ],
  },
];

// Challenge text without the functions, for the page's reactive state.
export function challengeSummaries() {
  return CHALLENGES.map((c) => ({
    id: c.id,
    title: c.title,
    intro: c.intro,
    level: c.level,
    badge: c.badge,
    steps: c.steps.map((s) => ({ id: s.id, text: s.text, hint: s.hint, file: s.file ?? "" })),
  }));
}

// Runs the checks of every unlocked challenge. Returns the step keys
// ("challenge/step") that pass now; the caller keeps the ones already done.
export function evaluate(ctx, doneKeys, unlockedCount) {
  const passing = [];
  CHALLENGES.slice(0, unlockedCount).forEach((c) => {
    for (const s of c.steps) {
      const key = `${c.id}/${s.id}`;
      if (doneKeys.includes(key)) continue;
      try {
        if (s.check(ctx)) passing.push(key);
      } catch {
        // a check that can't read something just hasn't passed yet
      }
    }
  });
  return passing;
}
