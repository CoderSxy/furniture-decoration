// tests/storage.test.ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BUDGETS_STORAGE_KEY,
  FAVORITES_STORAGE_KEY,
  PLANS_STORAGE_KEY,
  SCANS_STORAGE_KEY,
} from '../src/constants/storageKeys.ts'
import {
  configureStorage,
  createMemoryStorage,
  readJSON,
  writeJSON,
} from '../src/utils/storage.ts'

test('favorites key is fd:favorites', () => {
  assert.equal(FAVORITES_STORAGE_KEY, 'fd:favorites')
})

test('plans key is fd:plans', () => {
  assert.equal(PLANS_STORAGE_KEY, 'fd:plans')
})

test('budgets key is fd:budgets', () => {
  assert.equal(BUDGETS_STORAGE_KEY, 'fd:budgets')
})

test('scans key is fd:scans', () => {
  assert.equal(SCANS_STORAGE_KEY, 'fd:scans')
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
