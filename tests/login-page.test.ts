import assert from 'node:assert/strict'
import test from 'node:test'
import Taro from '@tarojs/taro'
import LoginPage from '../src/pages/login/index.tsx'
import { mount, textContent, nodes, tick } from './mount.mjs'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'

test('login page shows WeChat copy and blocks missing API base', async () => {
  configureStorage(createMemoryStorage())
  useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
  delete process.env.TARO_APP_API_BASE_URL
  Taro.lastToast = ''
  Taro.lastReLaunch = ''
  Taro.showToast = async ({ title }) => { Taro.lastToast = title }
  Taro.reLaunch = async ({ url }) => { Taro.lastReLaunch = url }
  const page = mount(LoginPage)
  try {
    assert.match(textContent(page.tree), /微信登录/)
    assert.match(textContent(page.tree), /不获取手机号/)
    nodes(page.tree, (node) => node.props?.onClick && textContent(node).includes('微信登录'))[0].props.onClick()
    await tick(); page.flush()
    assert.equal(Taro.lastToast, '未配置服务地址，无法登录')
    assert.equal(Taro.lastReLaunch, '')
  } finally {
    page.unmount()
  }
})

test('successful WeChat login relaunches catalog', async () => {
  configureStorage(createMemoryStorage())
  useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
  process.env.TARO_APP_API_BASE_URL = 'https://example.com'
  Taro.lastReLaunch = ''
  Taro.lastToast = ''
  Taro.showToast = async ({ title }) => { Taro.lastToast = title }
  Taro.reLaunch = async ({ url }) => { Taro.lastReLaunch = url }
  Taro.requirePrivacyAuthorize = async (option) => { option?.success?.() }
  Taro.login = async () => ({ code: 'fresh-code' })
  Taro.request = async () => ({
    statusCode: 200,
    data: { token: 'sid.sig', expiresIn: 2592000, user: { id: 'user-1' } },
  })
  const page = mount(LoginPage)
  try {
    nodes(page.tree, (node) => node.props?.onClick && textContent(node).includes('微信登录'))[0].props.onClick()
    await tick(); page.flush()
    await tick(); page.flush()
    assert.equal(Taro.lastReLaunch, '/pages/catalog/index')
    assert.equal(useSyncStore.getState().token, 'sid.sig')
  } finally {
    page.unmount()
    delete process.env.TARO_APP_API_BASE_URL
  }
})

test('login page with existing token relaunches catalog', async () => {
  configureStorage(createMemoryStorage())
  useSyncStore.setState({ token: 't', userId: 'u', loggedInAt: '2026-11-03T12:00:00.000Z', pendingRetry: false })
  Taro.lastReLaunch = ''
  Taro.reLaunch = async ({ url }) => { Taro.lastReLaunch = url }
  const page = mount(LoginPage)
  try {
    Taro.testShow?.()
    await tick(); page.flush()
    assert.equal(Taro.lastReLaunch, '/pages/catalog/index')
  } finally {
    page.unmount()
  }
})
