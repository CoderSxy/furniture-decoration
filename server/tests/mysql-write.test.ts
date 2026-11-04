import assert from 'node:assert/strict'
import test from 'node:test'
import { writeSyncItem } from '../src/db/syncItemWrite.ts'

test('upsert atomically guards payload and tombstone before advancing version; equal keeps existing', async () => {
  let sql = ''
  let values: unknown[] = []
  const at = new Date('2026-11-03T12:00:00.000Z')
  await writeSyncItem(async (query, params) => { sql = query; values = params }, {
    user_id: 'u', kind: 'favorite', item_id: 'f', payload: null,
    updated_at: at, deleted: 1, created_at: at,
  })
  const update = sql.split('ON DUPLICATE KEY UPDATE')[1].replace(/\s+/g, ' ').trim()
  assert.equal(update, 'payload = IF(VALUES(updated_at) > updated_at, VALUES(payload), payload), deleted = IF(VALUES(updated_at) > updated_at, VALUES(deleted), deleted), updated_at = IF(VALUES(updated_at) > updated_at, VALUES(updated_at), updated_at)')
  assert.deepEqual(values, ['u', 'favorite', 'f', null, at, 1, at])
})
