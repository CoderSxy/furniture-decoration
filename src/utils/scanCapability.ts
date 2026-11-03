import type { CreateVkSession, VkSessionHandle } from '../types/vk'

export const MIN_VISIONKIT_SDK_VERSION = '2.22.0'

export type ScanCapability = 'visionkit-v2' | 'manual'

export type ProbeResult =
  | { capability: 'manual'; session: null }
  | { capability: 'visionkit-v2'; session: VkSessionHandle }

export type ScanCapabilityDeps = {
  getSdkVersion: () => string
  createVKSession?: CreateVkSession
}

export function parseSdkVersion(version: string): [number, number, number] {
  const parts = String(version ?? '')
    .split('.')
    .map((part) => Number.parseInt(part, 10))
  const n0 = Number.isFinite(parts[0]) ? parts[0] : 0
  const n1 = Number.isFinite(parts[1]) ? parts[1] : 0
  const n2 = Number.isFinite(parts[2]) ? parts[2] : 0
  return [n0, n1, n2]
}

export function compareSdkVersion(a: string, b: string): number {
  const left = parseSdkVersion(a)
  const right = parseSdkVersion(b)
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i]
  }
  return 0
}

export function isVisionKitV2SdkSupported(sdkVersion: string): boolean {
  return compareSdkVersion(sdkVersion, MIN_VISIONKIT_SDK_VERSION) >= 0
}

export function isVkStartError(status: unknown): boolean {
  if (status == null || status === 0 || status === '0' || status === 'success') return false
  return true
}

export function probeScanCapability(deps: ScanCapabilityDeps): Promise<ProbeResult> {
  return new Promise((resolve) => {
    if (!isVisionKitV2SdkSupported(deps.getSdkVersion()) || typeof deps.createVKSession !== 'function') {
      resolve({ capability: 'manual', session: null })
      return
    }
    let session: VkSessionHandle
    try {
      session = deps.createVKSession({ version: 'v2', track: { plane: { mode: 1 } } })
    } catch {
      resolve({ capability: 'manual', session: null })
      return
    }
    try {
      session.start((status) => {
        if (isVkStartError(status)) {
          try {
            session.destroy()
          } catch {
            // ignore destroy errors on fallback
          }
          resolve({ capability: 'manual', session: null })
          return
        }
        resolve({ capability: 'visionkit-v2', session })
      })
    } catch {
      try {
        session.destroy()
      } catch {
        // ignore destroy errors on fallback
      }
      resolve({ capability: 'manual', session: null })
    }
  })
}
