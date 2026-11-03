import Taro from '@tarojs/taro'
import {
  LOGIN_CODE_EXPIRED_TEXT,
  LOGIN_FAILED_TEXT,
  LOGIN_PRIVACY_DENIED_TEXT,
} from '../constants/labels'
import { useSyncStore } from '../stores/syncStore'
import { apiRequest } from './apiClient'

export async function loginWithWeChat(): Promise<{ token: string; userId: string; previousUserId: string | null }> {
  const previousUserId = useSyncStore.getState().userId
  try {
    await Taro.requirePrivacyAuthorize()
  } catch {
    Taro.showToast({ title: LOGIN_PRIVACY_DENIED_TEXT, icon: 'none' })
    throw new Error('privacy')
  }
  const { code } = await Taro.login()
  try {
    const res = await apiRequest<{ token: string; user: { id: string } }>('/api/auth/login', {
      method: 'POST',
      data: { code },
    })
    useSyncStore.getState().setSession({ token: res.token, userId: res.user.id })
    return { token: res.token, userId: res.user.id, previousUserId }
  } catch (error) {
    const codeName = (error as { code?: string }).code
    Taro.showToast({
      title: codeName === 'INVALID_CODE' ? LOGIN_CODE_EXPIRED_TEXT : LOGIN_FAILED_TEXT,
      icon: 'none',
    })
    throw error
  }
}

export async function logoutSession(): Promise<void> {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' })
  } catch {
    // 无论 204 还是网络失败都清本地 token
  }
  useSyncStore.getState().clearSession()
}
