import Taro from '@tarojs/taro'
import { useSyncStore } from '../stores/syncStore'
import { loginPageUrl } from './navigation'

export function isLoggedIn(): boolean {
  const token = useSyncStore.getState().token
  return typeof token === 'string' && token.length > 0
}

export function guardAuthenticatedPage(): void {
  if (!isLoggedIn()) {
    Taro.reLaunch({ url: loginPageUrl() })
  }
}
