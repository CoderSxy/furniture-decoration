import assert from 'node:assert/strict'
import test from 'node:test'
import Taro from '@tarojs/taro'
import { loginWithWeChat, logoutSession } from '../src/utils/authSession.ts'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import { LOGIN_PRIVACY_DENIED_TEXT } from '../src/constants/labels.ts'

test('loginWithWeChat requests a fresh code and stores token', async () => {
  configureStorage(createMemoryStorage())
  useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
  process.env.TARO_APP_API_BASE_URL = 'https://example.com'
  let loginCalls = 0
  Taro.requirePrivacyAuthorize = async (option) => { option?.success?.() }
  Taro.login = async () => { loginCalls += 1; return { code: `code-${loginCalls}` } }
  Taro.request = async (options) => {
    assert.equal(options.url, 'https://example.com/api/auth/login')
    assert.equal(options.method, 'POST')
    assert.deepEqual(options.data, { code: 'code-1' })
    return { statusCode: 200, data: { token: 'sid.sig', expiresIn: 2592000, user: { id: 'user-1' } } }
  }
  await loginWithWeChat()
  assert.equal(loginCalls, 1)
  assert.equal(useSyncStore.getState().token, 'sid.sig')
  assert.equal(useSyncStore.getState().userId, 'user-1')
  delete process.env.TARO_APP_API_BASE_URL
})

test('privacy denial stays on login page', async () => {
  configureStorage(createMemoryStorage())
  useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
  Taro.lastToast = ''
  Taro.showToast = async ({ title }) => { Taro.lastToast = title }
  Taro.requirePrivacyAuthorize = async () => { throw new Error('deny') }
  let loginCalls = 0
  Taro.login = async () => { loginCalls += 1; return { code: 'x' } }
  await assert.rejects(() => loginWithWeChat())
  assert.equal(Taro.lastToast, LOGIN_PRIVACY_DENIED_TEXT)
  assert.equal(loginCalls, 0)
  assert.equal(useSyncStore.getState().token, null)
})

test('logoutSession clears token even if network fails', async () => {
  configureStorage(createMemoryStorage())
  process.env.TARO_APP_API_BASE_URL = 'https://example.com'
  useSyncStore.getState().setSession({ token: 'sid.sig', userId: 'user-1' })
  Taro.request = async () => { throw new Error('offline') }
  await logoutSession()
  assert.equal(useSyncStore.getState().token, null)
  delete process.env.TARO_APP_API_BASE_URL
})
