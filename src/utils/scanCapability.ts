import { ensureCameraPrivacy, type PrivacyBridge } from './scanPrivacy'
import type { CreateVkSession, VkSessionHandle } from '../types/vk'

export const MIN_VISIONKIT_SDK_VERSION = '2.22.0'

export type ScanCapability = 'visionkit-v2' | 'manual'

export type ProbeResult =
  | { capability: 'manual'; session: null }
  | { capability: 'visionkit-v2'; session: VkSessionHandle }

export type ScanCancellationSignal = {
  readonly aborted: boolean
  addEventListener: (type: 'abort', listener: () => void, options?: { once?: boolean }) => void
  removeEventListener: (type: 'abort', listener: () => void) => void
}

// WeChat JS does not guarantee a browser AbortController global.
export function createScanCancellation() {
  let aborted = false
  const listeners = new Set<() => void>()
  const signal: ScanCancellationSignal = {
    get aborted() { return aborted },
    addEventListener: (_type, listener) => { listeners.add(listener) },
    removeEventListener: (_type, listener) => { listeners.delete(listener) },
  }
  return {
    signal,
    abort() {
      if (aborted) return
      aborted = true
      for (const listener of [...listeners]) listener()
      listeners.clear()
    },
  }
}

export type ScanCapabilityDeps = {
  timeoutMs?: number
  signal?: ScanCancellationSignal
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

const released = new WeakSet<VkSessionHandle>()

export function releaseScanSession(session: VkSessionHandle | null): void {
  if (!session || released.has(session)) return
  released.add(session)
  try { session.destroy() } catch { /* Release is best effort and idempotent. */ }
}

export async function prepareScanSession(
  deps: ScanCapabilityDeps & { privacy: PrivacyBridge },
): Promise<ProbeResult> {
  if (deps.signal?.aborted || !isVisionKitV2SdkSupported(deps.getSdkVersion()) || !deps.createVKSession) {
    return { capability: 'manual', session: null }
  }
  if (!await ensureCameraPrivacy(deps.privacy, () => deps.signal?.aborted ?? false) || deps.signal?.aborted) {
    return { capability: 'manual', session: null }
  }
  return probeScanCapability(deps)
}

export function probeScanCapability(deps: ScanCapabilityDeps): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let session: VkSessionHandle | null = null
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (success: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      deps.signal?.removeEventListener('abort', abort)
      if (success && session) resolve({ capability: 'visionkit-v2', session })
      else {
        releaseScanSession(session)
        resolve({ capability: 'manual', session: null })
      }
    }
    const abort = () => finish(false)
    try {
      if (deps.signal?.aborted || !isVisionKitV2SdkSupported(deps.getSdkVersion()) || !deps.createVKSession) {
        finish(false)
        return
      }
      session = deps.createVKSession({ version: 'v2', track: { plane: { mode: 1 } } })
      deps.signal?.addEventListener('abort', abort, { once: true })
      timer = setTimeout(abort, deps.timeoutMs ?? 8000)
      session.start((status) => finish(!isVkStartError(status)))
    } catch {
      finish(false)
    }
  })
}
