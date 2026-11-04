import assert from 'node:assert/strict'
import test from 'node:test'
import { TOMBSTONES_STORAGE_KEY } from '../src/constants/storageKeys.ts'
import {
  dropAckedTombstones,
  listTombstones,
  recordTombstone,
} from '../src/utils/tombstones.ts'
import { configureStorage, createMemoryStorage, readJSON } from '../src/utils/storage.ts'

test('tombstones persist until the server snapshot acks a newer or equal deleted item', () => {
  configureStorage(createMemoryStorage())
  recordTombstone('favorite', 'p-sofa-modern-01', '2026-11-03T12:00:00.000Z')
  assert.deepEqual(listTombstones(), [
    { kind: 'favorite', itemId: 'p-sofa-modern-01', updatedAt: '2026-11-03T12:00:00.000Z' },
  ])
  dropAckedTombstones([
    {
      kind: 'favorite',
      itemId: 'p-sofa-modern-01',
      updatedAt: '2026-11-03T11:59:59.000Z',
      deleted: true,
      payload: null,
    },
  ])
  assert.equal(listTombstones().length, 1)
  dropAckedTombstones([
    {
      kind: 'favorite',
      itemId: 'p-sofa-modern-01',
      updatedAt: '2026-11-03T12:00:00.000Z',
      deleted: true,
      payload: null,
    },
  ])
  assert.deepEqual(listTombstones(), [])
  assert.deepEqual(readJSON(TOMBSTONES_STORAGE_KEY, null), [])
})
