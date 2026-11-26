import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestClient, type TestClient } from '@tylix/cli/testing'

type File = { path: string; content: string }
type Diag = { file: string; line: number; message: string; severity: string }
type Build = { ok: boolean; html?: string; diagnostics: Diag[]; build: string; ms: number }

let client: TestClient
let starter: File[] = []

before(async () => {
  client = await createTestClient()
  const res = await client.get('/api/playground/starter')
  starter = (res.data as { data: { files: File[] } }).data.files
})
after(async () => {
  await client.close()
})

function edit(path: string, find: string, replace: string): File[] {
  return starter.map((f) => {
    if (f.path !== path) return f
    assert.ok(f.content.includes(find), `${path} should contain ${find}`)
    return { ...f, content: f.content.replace(find, replace) }
  })
}

async function compile(files: unknown) {
  const res = await client.post('/api/playground/compile', { files })
  return { status: res.status, data: res.data as { data?: Build; error?: string } }
}

test('the starter project is Pixel Tasks', () => {
  const paths = starter.map((f) => f.path)
  for (const p of ['app/pages/Home.tyx', 'app/pages/components/TaskCard.tyx', 'app/capabilities/Tasks.tyx', 'public/styles.css']) {
    assert.ok(paths.includes(p), `missing ${p}`)
  }
})

test('the starter builds cleanly into a document with the preview bridge', async () => {
  const { status, data } = await compile(starter)
  assert.equal(status, 200)
  const build = data.data!
  assert.equal(build.ok, true, JSON.stringify(build.diagnostics))
  assert.deepEqual(build.diagnostics, [])
  assert.match(build.html!, /__tylixPlayground/)
  assert.match(build.html!, new RegExp(`var BUILD = "${build.build}"`))
  assert.match(build.html!, /defineCapability\("Tasks"/)
  assert.match(build.html!, /--accent/)
})

test('a syntax error comes back with its file and line, and no document', async () => {
  const files = edit('app/pages/components/TaskCard.tyx', 'return "Todo"\n  }', 'return "Todo"\n')
  const build = (await compile(files)).data.data!
  assert.equal(build.ok, false)
  assert.equal(build.html, undefined)
  const d = build.diagnostics[0]
  assert.equal(d.file, 'app/pages/components/TaskCard.tyx')
  assert.ok(d.line > 1)
})

test('an unknown component tag is a warning that names the file to create', async () => {
  const files = edit('app/pages/components/TaskCard.tyx', '<span class="pill">{{ label }}</span>', '<StatusBadge status="{{ label }}" />')
  const build = (await compile(files)).data.data!
  assert.equal(build.ok, true)
  const w = build.diagnostics.find((x) => x.severity === 'warning')
  assert.ok(w)
  assert.match(w.message, /StatusBadge\.tyx/)
})

test('only tylix-icons can be imported from packages', async () => {
  const files = edit('app/pages/Home.tyx', 'import { IconPlus } from "tylix-icons"', 'import { Thing } from "@tylix/core"')
  const build = (await compile(files)).data.data!
  assert.equal(build.ok, false)
  assert.match(build.diagnostics[0].message, /tylix-icons/)
})

test('paths that leave the project are refused', async () => {
  const { status, data } = await compile([{ path: '../secrets.tyx', content: 'page X' }])
  assert.equal(status, 422)
  assert.match(data.error!, /not a valid file path/)
})

test('oversized projects are refused', async () => {
  const { status } = await compile([...starter, { path: 'big.css', content: 'x'.repeat(70_000) }])
  assert.equal(status, 422)
})
