export type PrivacyBridge = {
  requirePrivacyAuthorize: () => Promise<void>
  authorizeCamera: () => Promise<void>
}

export async function ensureCameraPrivacy(bridge: PrivacyBridge, isCancelled: () => boolean = () => false): Promise<boolean> {
  try {
    if (isCancelled()) return false
    await bridge.requirePrivacyAuthorize()
    if (isCancelled()) return false
    await bridge.authorizeCamera()
    return true
  } catch {
    return false
  }
}
