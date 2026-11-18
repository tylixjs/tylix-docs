import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestClient, type TestClient } from '@tylix/cli/testing'

// Runs against the database in .env. Point tests at their own database
// with a separate env file, e.g. DATABASE_FILENAME=database.test.sqlite.

let client: TestClient
before(async () => {
  client = await createTestClient()
})
after(async () => {
  await client.close()
})

test('an unknown API route answers 404', async () => {
  const res = await client.get('/api/does-not-exist')
  assert.equal(res.status, 404)
})

test('public posts are open to everyone', async () => {
  const res = await client.get('/api/public/posts')
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.data))
})

test('the current user needs a login', async () => {
  const res = await client.get('/api/me')
  assert.equal(res.status, 401)
})

// With a user in the database, call routes as them:
//   const user = await User.first()
//   const res = await client.get('/api/me', { as: user })
//   assert.equal(res.status, 200)
