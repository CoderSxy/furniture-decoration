import Taro from '@tarojs/taro'
import { compareSdkVersion } from './scanCapability'

export const MIN_XR_FRAME_SDK_VERSION = '2.32.0'

export type XrCapabilityDeps = {
  getSdkVersion: () => string
}

export function isXrFrameSupported(sdkVersion: string): boolean {
  return compareSdkVersion(sdkVersion, MIN_XR_FRAME_SDK_VERSION) >= 0
}

export function readXrFrameSupport(deps?: XrCapabilityDeps): boolean {
  try {
    const getSdkVersion =
      deps?.getSdkVersion ?? (() => String(Taro.getSystemInfoSync().SDKVersion ?? ''))
    return isXrFrameSupported(getSdkVersion())
  } catch {
    return false
  }
}
