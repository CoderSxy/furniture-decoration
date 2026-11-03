import Taro from '@tarojs/taro'
import type { CreateVkSession } from '../types/vk'
import type { PrivacyBridge } from './scanPrivacy'

export function readSdkVersion(): string {
  try {
    const info = Taro.getSystemInfoSync()
    return typeof info.SDKVersion === 'string' && info.SDKVersion.length > 0
      ? info.SDKVersion
      : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export function getCreateVkSession(): CreateVkSession | undefined {
  const taro = Taro as unknown as { createVKSession?: CreateVkSession }
  if (typeof taro.createVKSession === 'function') {
    return (options) => taro.createVKSession!(options)
  }
  const wxObj = (globalThis as { wx?: { createVKSession?: CreateVkSession } }).wx
  if (wxObj && typeof wxObj.createVKSession === 'function') {
    return (options) => wxObj.createVKSession!(options)
  }
  return undefined
}

export function createWeappPrivacyBridge(): PrivacyBridge {
  return {
    requirePrivacyAuthorize: () =>
      new Promise((resolve, reject) => {
        const api = Taro as unknown as {
          requirePrivacyAuthorize?: (option: { success: () => void; fail: () => void }) => void
        }
        if (typeof api.requirePrivacyAuthorize !== 'function') {
          resolve()
          return
        }
        api.requirePrivacyAuthorize({
          success: () => resolve(),
          fail: () => reject(new Error('privacy-denied')),
        })
      }),
    authorizeCamera: () => Taro.authorize({ scope: 'scope.camera' }).then(() => undefined),
  }
}
