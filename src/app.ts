import { PropsWithChildren } from 'react'
import Taro from '@tarojs/taro'
import { useFavoriteStore } from './stores/favoriteStore'
import { configureStorage } from './utils/storage'

import './app.scss'

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

function App({ children }: PropsWithChildren<any>) {
  return children
}

export default App
