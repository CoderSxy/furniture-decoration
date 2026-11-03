import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import { FAVORITES_STORAGE_KEY } from '../src/constants/storageKeys.ts'
import {
  parseFavoriteRecords,
  useFavoriteStore,
} from '../src/stores/favoriteStore.ts'
import { configureStorage, createMemoryStorage, readJSON } from '../src/utils/storage.ts'

describe('favoriteStore', { concurrency: false }, () => {
  beforeEach(() => {
    configureStorage(createMemoryStorage())
    useFavoriteStore.setState({ items: [] })
  })

  it('parseFavoriteRecords drops malformed rows', () => {
    assert.deepEqual(parseFavoriteRecords(null), [])
    assert.deepEqual(parseFavoriteRecords({ productId: 'x' }), [])
    assert.deepEqual(
      parseFavoriteRecords([
        { productId: 'ok', savedAt: '2026-11-03T00:00:00.000Z' },
        { productId: 1, savedAt: '2026-11-03T00:00:00.000Z' },
        { productId: '', savedAt: '2026-11-03T00:00:00.000Z' },
        { productId: 'ok2' },
      ]),
      [{ productId: 'ok', savedAt: '2026-11-03T00:00:00.000Z' }],
    )
  })

  it('toggleFavorite adds then removes and persists fd:favorites', () => {
    useFavoriteStore.getState().toggleFavorite('p-sofa-modern-01')
    assert.equal(useFavoriteStore.getState().isFavorite('p-sofa-modern-01'), true)
    const first = useFavoriteStore.getState().items
    assert.equal(first.length, 1)
    assert.equal(first[0].productId, 'p-sofa-modern-01')
    assert.match(first[0].savedAt, /^\d{4}-\d{2}-\d{2}T/)
    assert.deepEqual(readJSON(FAVORITES_STORAGE_KEY, []), first)

    useFavoriteStore.getState().toggleFavorite('p-sofa-modern-01')
    assert.deepEqual(useFavoriteStore.getState().items, [])
    assert.deepEqual(readJSON(FAVORITES_STORAGE_KEY, []), [])
  })

  it('hydrate restores records after a process restart', () => {
    const memory = createMemoryStorage({
      [FAVORITES_STORAGE_KEY]: JSON.stringify([
        { productId: 'p-bed-modern-03', savedAt: '2026-11-03T08:00:00.000Z' },
      ]),
    })
    configureStorage(memory)
    useFavoriteStore.setState({ items: [] })
    useFavoriteStore.getState().hydrate()
    assert.deepEqual(useFavoriteStore.getState().items, [
      { productId: 'p-bed-modern-03', savedAt: '2026-11-03T08:00:00.000Z' },
    ])
  })
})
