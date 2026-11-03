import assert from 'node:assert/strict'
import test from 'node:test'
import Taro from '@tarojs/taro'
import MinePage from '../src/pages/mine/index.tsx'
import { mount, textContent, nodes, tick } from './mount.mjs'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import {
  CLEAR_MY_DATA_TEXT,
  LOGOUT_BUTTON_TEXT,
  MINE_NOTE_TEXT,
} from '../src/constants/labels.ts'

test('mine page shows logout, clear-my-data, and openid privacy copy', async () => {
  configureStorage(createMemoryStorage())
  useSyncStore.getState().setSession({ token: 't', userId: 'u' })
  const page = mount(MinePage)
  try {
    const text = textContent(page.tree)
    assert.match(text, new RegExp(LOGOUT_BUTTON_TEXT))
    assert.match(text, new RegExp(CLEAR_MY_DATA_TEXT))
    assert.equal(text.includes(MINE_NOTE_TEXT), true)
    assert.equal(text.includes('重置 mock'), false)
    assert.match(text, /不获取手机号|不收集手机号/)
  } finally {
    page.unmount()
  }
})

test('logout keeps favorites and relaunches login', async () => {
  configureStorage(createMemoryStorage())
  const { useFavoriteStore } = await import('../src/stores/favoriteStore.ts')
  useFavoriteStore.getState().toggleFavorite('p-sofa-modern-01')
  useSyncStore.getState().setSession({ token: 't', userId: 'u' })
  Taro.request = async () => ({ statusCode: 204, data: '' })
  Taro.lastReLaunch = ''
  Taro.reLaunch = async ({ url }) => { Taro.lastReLaunch = url }
  const page = mount(MinePage)
  try {
    nodes(page.tree, (node) => node.props?.onClick && textContent(node).includes('退出登录'))[0].props.onClick()
    await tick(); page.flush()
    assert.equal(useSyncStore.getState().token, null)
    assert.equal(useFavoriteStore.getState().items.length, 1)
    assert.equal(Taro.lastReLaunch, '/pages/login/index')
  } finally {
    page.unmount()
  }
})

test('clear-my-data is disabled when logged out', async () => {
  configureStorage(createMemoryStorage())
  useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
  Taro.lastToast = ''
  Taro.showToast = async ({ title }) => { Taro.lastToast = title }
  const page = mount(MinePage)
  try {
    const btn = nodes(
      page.tree,
      (node) => node.props?.onClick && textContent(node).includes(CLEAR_MY_DATA_TEXT),
    )[0]
    assert.match(String(btn.props.className), /mine-reset--disabled/)
    btn.props.onClick()
    await tick(); page.flush()
    assert.equal(Taro.lastToast, '请先登录')
  } finally {
    page.unmount()
  }
})
