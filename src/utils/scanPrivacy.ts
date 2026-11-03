export type PrivacyBridge = {
  requirePrivacyAuthorize: () => Promise<void>
  authorizeCamera: () => Promise<void>
}

export async function ensureCameraPrivacy(bridge: PrivacyBridge): Promise<boolean> {
  try {
    await bridge.requirePrivacyAuthorize()
    await bridge.authorizeCamera()
    return true
  } catch {
    return false
  }
}
