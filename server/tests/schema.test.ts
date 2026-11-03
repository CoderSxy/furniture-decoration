import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const SQL = readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf8')

test('schema defines users and sync_items with locked columns', () => {
  assert.match(SQL, /CREATE TABLE[\s\S]*users/i)
  assert.match(SQL, /openid VARCHAR\(64\)/)
  assert.match(SQL, /UNIQUE/)
  assert.equal(/phone/i.test(SQL), false)
  assert.equal(/session_key/i.test(SQL), false)
  assert.equal(/nickname/i.test(SQL), false)
  assert.match(SQL, /CREATE TABLE[\s\S]*sync_items/i)
  assert.match(SQL, /ENUM\('favorite','plan','budget','scan','aiPreview','preference'\)/)
  assert.match(SQL, /PRIMARY KEY \(user_id, kind, item_id\)/)
  assert.match(SQL, /ON DELETE CASCADE/)
  assert.match(SQL, /utf8mb4/)
})
