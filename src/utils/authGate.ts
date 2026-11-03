import Taro from '@tarojs/taro'
import { useSyncStore } from '../stores/syncStore'
import { claimBusinessData } from './businessData'
import { apiRequest } from './apiClient'
import { loginPageUrl } from './navigation'

export function isLoggedIn(): boolean {
  const token = useSyncStore.getState().token
  return useSyncStore.getState().verified && typeof token === 'string' && token.length > 0
}

export function guardAuthenticatedPage(): void {
  if (!isLoggedIn()) {
    Taro.reLaunch({ url: loginPageUrl() })
  }
}

export async function restoreSession(): Promise<boolean> {
  const { token, userId, generation } = useSyncStore.getState()
  if (!token || !userId) return false
  useSyncStore.setState({ verified: false })
  try {
    const result = await apiRequest<{ user: { id: string } }>('/api/auth/session', { method: 'GET' })
    if (generation !== useSyncStore.getState().generation) return false
    if (result.user?.id !== userId) throw new Error('身份不匹配')
    claimBusinessData(userId)
    useSyncStore.setState({ verified: true })
    return true
  } catch {
    if (generation === useSyncStore.getState().generation) useSyncStore.getState().clearSession()
    return false
  }
}
