import assert from 'node:assert/strict'
import { beforeEach, afterEach, test, mock } from 'node:test'
import Taro from '@tarojs/taro'
import { useSyncStore } from '../src/stores/syncStore.ts'
import { useFavoriteStore } from '../src/stores/favoriteStore.ts'
import { clearMyDataLocal } from '../src/utils/resetMock.ts'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { runLoginSync, schedulePush, collectSyncItems, applySyncItems } from '../src/utils/syncEngine.ts'
import { recordTombstone, listTombstones } from '../src/utils/tombstones.ts'
import { apiRequest } from '../src/utils/apiClient.ts'

const at = '2026-11-03T12:00:00.000Z'
const fav = (id: string, updatedAt = at) => ({ kind: 'favorite' as const, itemId: id, updatedAt, deleted: false, payload: { productId: id, savedAt: at, updatedAt } })
const response = (items: unknown[]) => ({ statusCode: 200, data: { serverTime: at, items } })
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
beforeEach(() => {
  configureStorage(createMemoryStorage())
  clearMyDataLocal()
  useSyncStore.getState().clearSession()
  useSyncStore.getState().setSession({ token: 'a', userId: 'A' })
  process.env.TARO_APP_API_BASE_URL = 'https://example.com'
})
afterEach(() => { useSyncStore.getState().clearSession(); mock.timers.reset(); delete process.env.TARO_APP_API_BASE_URL })

test('logout and rehydrate preserve ownership; B never uploads A data', async () => {
  useFavoriteStore.getState().replaceAll([fav('private-A').payload])
  useSyncStore.getState().clearSession()
  useSyncStore.getState().hydrate()
  useSyncStore.getState().setSession({ token: 'b', userId: 'B' })
  const uploads: unknown[] = []
  Taro.request = async (o) => { if (o.method === 'PUT') uploads.push(o.data); return response([]) }
  await runLoginSync()
  assert.equal(JSON.stringify(uploads).includes('private-A'), false)
})

test('GET merge does not acknowledge a local tombstone before PUT', async () => {
  recordTombstone('favorite', 'removed', at)
  let uploaded = false
  Taro.request = async (o) => {
    if (o.method === 'PUT') {
      uploaded = o.data.items.some((x) => x.itemId === 'removed' && x.deleted)
      return response(o.data.items)
    }
    return response([fav('removed', '2026-11-03T11:00:00.000Z')])
  }
  await runLoginSync()
  assert.equal(uploaded, true)
  assert.deepEqual(listTombstones(), [])
})

test('PUT preserves additions, edits and deletes made in flight and pushes again', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  useFavoriteStore.getState().replaceAll([fav('edit').payload, fav('delete').payload])
  let finish: (v: unknown) => void = () => {}
  const uploads: any[] = []
  Taro.request = (o) => {
    uploads.push(o.data.items)
    if (uploads.length === 1) return new Promise((resolve) => { finish = resolve })
    return Promise.resolve(response(o.data.items))
  }
  schedulePush(); mock.timers.tick(800); await flush()
  useFavoriteStore.getState().replaceAll([fav('edit', '2026-11-03T12:01:00.000Z').payload, fav('added').payload])
  recordTombstone('favorite', 'delete', '2026-11-03T12:01:00.000Z')
  finish(response(uploads[0])); await flush()
  assert.deepEqual(useFavoriteStore.getState().items.map(x => x.productId).sort(), ['added', 'edit'])
  assert.equal(useFavoriteStore.getState().items.find(x => x.productId === 'edit')?.updatedAt, '2026-11-03T12:01:00.000Z')
  mock.timers.tick(800); await flush()
  assert.equal(uploads.length, 2)
  assert.ok(uploads[1].some(x => x.itemId === 'delete' && x.deleted))
})

test('outer authoritative version replaces future payload time', () => {
  const item = fav('clock', '2099-01-01T00:00:00.000Z'); item.updatedAt = at
  applySyncItems([item])
  assert.equal(collectSyncItems().find(x => x.itemId === 'clock')?.updatedAt, at)
})

test('late GET after logout or timeout cannot apply or launch PUT', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  let finish: (v: unknown) => void = () => {}
  const methods: string[] = []
  Taro.request = (o) => { methods.push(o.method); return new Promise(resolve => { finish = resolve }) }
  const work = runLoginSync()
  mock.timers.tick(8000); await work
  finish(response([fav('late')])); await flush()
  assert.equal(useFavoriteStore.getState().items.length, 0)
  assert.deepEqual(methods, ['GET'])
})

test('an old request 401 cannot clear a new session', async () => {
  let finish: (v: unknown) => void = () => {}
  Taro.request = () => new Promise(resolve => { finish = resolve })
  const work = apiRequest('/api/sync', { method: 'GET' })
  useSyncStore.getState().setSession({ token: 'b', userId: 'B' })
  finish({ statusCode: 401, data: {} })
  await assert.rejects(work)
  assert.equal(useSyncStore.getState().token, 'b')
})

test('late GET/PUT from a logged-out or replaced session cannot touch B', async () => {
  for (const phase of ['GET', 'PUT']) {
    useSyncStore.getState().setSession({ token: `old-${phase}`, userId: 'A' })
    let finish
    let reached
    const ready = new Promise(resolve => { reached = resolve })
    Taro.request = (o) => {
      if (o.method !== phase) return Promise.resolve(response([]))
      reached()
      return new Promise(resolve => { finish = resolve })
    }
    const work = runLoginSync()
    await ready
    useSyncStore.getState().clearSession()
    useSyncStore.getState().setSession({ token: `new-${phase}`, userId: 'B' })
    useFavoriteStore.getState().replaceAll([fav('B-only').payload])
    finish(response([fav('A-late')]))
    await work
    assert.deepEqual(useFavoriteStore.getState().items.map(x => x.productId), ['B-only'])
  }
})

test('a timed-out request returning 401 does not clear the current session', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  let finish
  Taro.request = () => new Promise(resolve => { finish = resolve })
  const work = runLoginSync()
  mock.timers.tick(8000); await work
  finish({ statusCode: 401, data: {} }); await flush()
  assert.equal(useSyncStore.getState().token, 'a')
})

test('a clamped deletion acknowledges the exact submitted tombstone', async () => {
  recordTombstone('favorite', 'future-delete', '2099-01-01T00:00:00.000Z')
  Taro.request = async (o) => o.method === 'GET' ? response([]) : response([{ kind: 'favorite', itemId: 'future-delete', updatedAt: at, deleted: true, payload: null }])
  await runLoginSync()
  assert.deepEqual(listTombstones(), [])
})
