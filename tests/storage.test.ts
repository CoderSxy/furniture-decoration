import assert from 'node:assert/strict'
import test from 'node:test'
import { FAVORITES_STORAGE_KEY } from '../src/constants/storageKeys.ts'
import {
  configureStorage,
  createMemoryStorage,
  readJSON,
  writeJSON,
} from '../src/utils/storage.ts'

test('favorites key is fd:favorites', () => {
  assert.equal(FAVORITES_STORAGE_KEY, 'fd:favorites')
})

test('memory storage round-trips JSON and recovers from bad payloads', () => {
  const memory = createMemoryStorage()
  configureStorage(memory)
  writeJSON(FAVORITES_STORAGE_KEY, [{ productId: 'p-1', savedAt: '2026-11-03T00:00:00.000Z' }])
  assert.deepEqual(readJSON(FAVORITES_STORAGE_KEY, []), [
    { productId: 'p-1', savedAt: '2026-11-03T00:00:00.000Z' },
  ])

  configureStorage(createMemoryStorage({ [FAVORITES_STORAGE_KEY]: '{not-json' }))
  assert.deepEqual(readJSON(FAVORITES_STORAGE_KEY, []), [])

  configureStorage(createMemoryStorage({ [FAVORITES_STORAGE_KEY]: '' }))
  assert.deepEqual(readJSON(FAVORITES_STORAGE_KEY, [{ keep: true }]), [{ keep: true }])
})
