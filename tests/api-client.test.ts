import assert from 'node:assert/strict'
import test from 'node:test'
import Taro from '@tarojs/taro'
import { apiRequest, getApiBaseUrl } from '../src/utils/apiClient.ts'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import { FAVORITES_STORAGE_KEY } from '../src/constants/storageKeys.ts'

test('apiRequest uses env base, sends bearer, and 401 clears only auth', async () => {
  configureStorage(createMemoryStorage({
    [FAVORITES_STORAGE_KEY]: JSON.stringify([{ productId: 'p-sofa-modern-01', savedAt: '2026-11-03T00:00:00.000Z', updatedAt: '2026-11-03T00:00:00.000Z' }]),
  }))
  useSyncStore.setState({ token: 'sid.sig', userId: 'user-1', loggedInAt: '2026-11-03T12:00:00.000Z', pendingRetry: false })
  process.env.TARO_APP_API_BASE_URL = 'https://example.com/'
  assert.equal(getApiBaseUrl(), 'https://example.com')
  const calls: Array<{ url: string; header?: Record<string, string> }> = []
  Taro.request = async (options) => {
    calls.push(options)
    return {
      statusCode: 401,
      data: { error: { code: 'UNAUTHORIZED', message: '请重新登录' } },
    }
  }
  Taro.lastReLaunch = ''
  Taro.reLaunch = async ({ url }) => { Taro.lastReLaunch = url }
  await assert.rejects(() => apiRequest('/api/sync', { method: 'GET' }))
  assert.equal(calls[0].url, 'https://example.com/api/sync')
  assert.equal(calls[0].header?.Authorization, 'Bearer sid.sig')
  assert.equal(useSyncStore.getState().token, null)
  assert.equal(Taro.lastReLaunch, '/pages/login/index')
  const { readJSON } = await import('../src/utils/storage.ts')
  assert.equal(readJSON(FAVORITES_STORAGE_KEY, []).length, 1)
  delete process.env.TARO_APP_API_BASE_URL
})

test('apiRequest refuses to send when base URL is missing', async () => {
  delete process.env.TARO_APP_API_BASE_URL
  let sent = 0
  Taro.request = async () => { sent += 1; return { statusCode: 200, data: {} } }
  await assert.rejects(() => apiRequest('/api/auth/login', { method: 'POST', data: { code: 'x' } }))
  assert.equal(sent, 0)
})
