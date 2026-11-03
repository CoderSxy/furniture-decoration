// src/app.ts
import { PropsWithChildren } from 'react'
import Taro from '@tarojs/taro'
import { useBudgetStore } from './stores/budgetStore'
import { useCatalogStore } from './stores/catalogStore'
import { useFavoriteStore } from './stores/favoriteStore'
import { usePlanStore } from './stores/planStore'
import { useScanStore } from './stores/scanStore'
import { configureStorage, configureStorageFailureHandler } from './utils/storage'

import './app.scss'

configureStorageFailureHandler(() => {
  Taro.nextTick(() => {
    Taro.showToast({ title: '本机保存失败，请到我的页面重试', icon: 'none' })
  })
})

configureStorage({
  getItem: (key) => {
    try {
      const value = Taro.getStorageSync(key)
      if (value === '' || value == null) return null
      return typeof value === 'string' ? value : JSON.stringify(value)
    } catch {
      return null
    }
  },
  setItem: (key, value) => {
    Taro.setStorageSync(key, value)
  },
})

useFavoriteStore.getState().hydrate()
usePlanStore.getState().hydrate()
useBudgetStore.getState().hydrate()
useScanStore.getState().hydrate()
useBudgetStore.getState().ensureForPlans(
  usePlanStore.getState().plans,
  useCatalogStore.getState().products,
)

function App({ children }: PropsWithChildren<any>) {
  return children
}

export default App
