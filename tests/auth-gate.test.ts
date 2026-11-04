import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Taro from '@tarojs/taro'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import { guardAuthenticatedPage, isLoggedIn } from '../src/utils/authGate.ts'

test('guardAuthenticatedPage relaunches login when token missing', () => {
  configureStorage(createMemoryStorage())
  useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
  const calls: string[] = []
  Taro.reLaunch = async ({ url }) => { calls.push(url) }
  assert.equal(isLoggedIn(), false)
  guardAuthenticatedPage()
  assert.deepEqual(calls, ['/pages/login/index'])
  useSyncStore.getState().setSession({ token: 't', userId: 'u' })
  guardAuthenticatedPage()
  assert.deepEqual(calls, ['/pages/login/index'])
})

test('every business page installs useAuthGate and login page does not', () => {
  const pages = [
    'src/pages/catalog/index.tsx',
    'src/pages/catalog/detail.tsx',
    'src/pages/plans/index.tsx',
    'src/pages/plans/detail.tsx',
    'src/pages/budget/index.tsx',
    'src/pages/mine/index.tsx',
    'src/packageScan/pages/scan/index.tsx',
    'src/packagePreview/pages/ai/recommend.tsx',
    'src/packagePreview/pages/preview/index.tsx',
  ]
  for (const file of pages) {
    const src = readFileSync(file, 'utf8')
    assert.ok(src.includes('useAuthGate'), `${file} must call useAuthGate`)
  }
  const login = readFileSync('src/pages/login/index.tsx', 'utf8')
  assert.equal(login.includes('useAuthGate'), false)
  assert.equal(login.includes('getPhoneNumber'), false)
})

test('restored identity isolates data if persisted owner differs from valid Bearer', async () => {
  const { writeJSON } = await import('../src/utils/storage.ts')
  const { restoreSession } = await import('../src/utils/authGate.ts')
  const { useFavoriteStore } = await import('../src/stores/favoriteStore.ts')
  configureStorage(createMemoryStorage())
  useSyncStore.getState().setSession({ token: 'a', userId: 'A' })
  writeJSON('fd:dataOwner', 'B')
  useFavoriteStore.getState().replaceAll([{ productId: 'B-secret', savedAt: '2026-11-03T12:00:00.000Z', updatedAt: '2026-11-03T12:00:00.000Z' }])
  useSyncStore.getState().hydrate()
  process.env.TARO_APP_API_BASE_URL = 'https://example.com'
  Taro.request = async () => ({ statusCode: 200, data: { user: { id: 'A' } } })
  try {
    assert.equal(await restoreSession(), true)
    assert.deepEqual(useFavoriteStore.getState().items, [])
  } finally { delete process.env.TARO_APP_API_BASE_URL }
})
