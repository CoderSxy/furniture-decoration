export const API_BASE_URL_ENV = 'TARO_APP_API_BASE_URL'

export function getApiBaseUrl(): string | undefined {
  const value = process.env.TARO_APP_API_BASE_URL
  if (typeof value !== 'string') return undefined
  const trimmed = value.replace(/\/$/, '')
  return trimmed.length > 0 ? trimmed : undefined
}
