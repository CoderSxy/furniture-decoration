import assert from 'node:assert/strict'
import { test, afterEach, mock } from 'node:test'
import Taro from '@tarojs/taro'
import { useSyncStore } from '../src/stores/syncStore.ts'
import { useFavoriteStore } from '../src/stores/favoriteStore.ts'
import { clearMyDataCloud } from '../src/utils/resetMock.ts'
import { schedulePush } from '../src/utils/syncEngine.ts'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
function setup() {
  configureStorage(createMemoryStorage())
  useSyncStore.getState().setSession({ token: 'a', userId: 'A' })
  useFavoriteStore.getState().replaceAll([{ productId: 'local', savedAt: '2026-11-03T12:00:00.000Z', updatedAt: '2026-11-03T12:00:00.000Z' }])
  process.env.TARO_APP_API_BASE_URL = 'https://example.com'
  Taro.showToast = async ({ title }) => { Taro.lastToast = title }
  Taro.lastToast = ''
}
afterEach(() => { useSyncStore.getState().clearSession(); mock.timers.reset(); delete process.env.TARO_APP_API_BASE_URL })

test('clear needs explicit whole-account confirmation; failures preserve local data', async () => {
  for (const result of ['network', 'invalid', 'confirmed']) {
    setup()
    Taro.request = async (o) => {
      assert.equal(o.method, 'DELETE')
      if (result === 'network') throw new Error('offline')
      return { statusCode: 200, data: result === 'confirmed' ? { cleared: true, items: [] } : { items: [] } }
    }
    await clearMyDataCloud()
    assert.equal(useFavoriteStore.getState().items.length, result === 'confirmed' ? 0 : 1)
    assert.equal(Taro.lastToast === '已清除', result === 'confirmed')
  }
})

test('clear drains an in-flight PUT and cancels queued work before DELETE', async () => {
  setup(); mock.timers.enable({ apis: ['setTimeout'] })
  let finish
  const methods: string[] = []
  Taro.request = (o) => {
    methods.push(o.method)
    if (o.method === 'PUT') return new Promise(resolve => { finish = () => resolve({ statusCode: 200, data: { items: o.data.items } }) })
    return Promise.resolve({ statusCode: 200, data: { cleared: true, items: [] } })
  }
  schedulePush(); mock.timers.tick(800); await flush()
  schedulePush()
  const work = clearMyDataCloud(); await flush()
  assert.deepEqual(methods, ['PUT'])
  finish(); await work
  mock.timers.tick(800); await flush()
  assert.deepEqual(methods, ['PUT', 'DELETE'])
  assert.equal(useFavoriteStore.getState().items.length, 0)
})
