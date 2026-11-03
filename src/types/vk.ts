export type VkPlaneMode = 1

export type VkSessionOptions = {
  version: 'v2'
  track: { plane: { mode: VkPlaneMode } }
}

export type VkHit = {
  transform: ArrayLike<number>
}

export type VkSessionHandle = {
  start: (callback: (status: unknown) => void) => void
  destroy: () => void
  hitTest: (x: number, y: number) => VkHit[]
}

export type CreateVkSession = (options: VkSessionOptions) => VkSessionHandle
