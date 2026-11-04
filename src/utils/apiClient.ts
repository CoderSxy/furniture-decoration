import Taro from '@tarojs/taro'
import { LOGIN_MISSING_BASE_TEXT } from '../constants/labels'
import { useSyncStore } from '../stores/syncStore'
import { loginPageUrl } from './navigation'

export const API_BASE_URL_ENV = 'TARO_APP_API_BASE_URL'

export function getApiBaseUrl(): string | undefined {
  const value = process.env.TARO_APP_API_BASE_URL
  if (typeof value !== 'string') return undefined
  const trimmed = value.replace(/\/$/, '')
  return trimmed.length > 0 ? trimmed : undefined
}

export type ApiRequestOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  isActive?: () => boolean
}

export class ApiClientError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const base = getApiBaseUrl()
  if (!base) {
    throw new Error(LOGIN_MISSING_BASE_TEXT)
  }
  const { token, generation } = useSyncStore.getState()
  const header: Record<string, string> = {}
  if (token) header.Authorization = `Bearer ${token}`
  const res = await Taro.request({
    url: `${base}${path}`,
    method: options.method,
    data: options.data,
    header,
  })
  if (options.isActive && !options.isActive()) throw new ApiClientError('STALE_SESSION', '请求已失效')
  if (res.statusCode === 401 && path !== '/api/auth/login') {
    if (useSyncStore.getState().generation === generation) {
    useSyncStore.getState().clearSession()
    Taro.reLaunch({ url: loginPageUrl() })
    }
    throw new ApiClientError('UNAUTHORIZED', '请重新登录')
  }
  if (res.statusCode != null && res.statusCode >= 400) {
    const error = (res.data as { error?: { code?: string; message?: string } } | undefined)?.error
    throw new ApiClientError(error?.code ?? 'INTERNAL', error?.message ?? '请求失败')
  }
  return res.data as T
}
