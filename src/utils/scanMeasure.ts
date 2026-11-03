import type { RoomScan } from '../types/domain'

export const DEFAULT_ROOM_HEIGHT_MM = 2800
export const MAX_SCAN_PHOTOS = 3

export type Vec3 = { x: number; y: number; z: number }

export function metersToMm(meters: number): number {
  return Math.round(meters * 1000)
}

export function translationFromHitTransform(transform: ArrayLike<number>): Vec3 | null {
  if (transform.length < 16) return null
  const x = Number(transform[12])
  const y = Number(transform[13])
  const z = Number(transform[14])
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
  return { x, y, z }
}

export function distanceMeters(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export function distanceMmBetweenTransforms(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
): number | null {
  const pa = translationFromHitTransform(a)
  const pb = translationFromHitTransform(b)
  if (!pa || !pb) return null
  const mm = metersToMm(distanceMeters(pa, pb))
  if (!(mm > 0)) return null
  return mm
}

export type ManualScanDraft = {
  planId: string
  widthText: string
  depthText: string
  heightText: string
  photoPaths: string[]
}

export type ManualScanError =
  | 'invalid-plan'
  | 'invalid-width'
  | 'invalid-depth'
  | 'invalid-height'
  | 'invalid-photos'

export const MANUAL_SCAN_ERRORS: Record<ManualScanError, string> = {
  'invalid-plan': '缺少方案，无法采集',
  'invalid-width': '长度必须大于 0',
  'invalid-depth': '宽度必须大于 0',
  'invalid-height': '层高必须大于 0',
  'invalid-photos': '参考图最多 3 张',
}

export function parsePositiveMm(text: string): number | null {
  const value = Number(String(text).trim())
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

export function validateManualScan(draft: ManualScanDraft): ManualScanError | 'ok' {
  if (typeof draft.planId !== 'string' || draft.planId.length === 0) return 'invalid-plan'
  if (parsePositiveMm(draft.widthText) == null) return 'invalid-width'
  if (parsePositiveMm(draft.depthText) == null) return 'invalid-depth'
  if (parsePositiveMm(draft.heightText) == null) return 'invalid-height'
  if (!Array.isArray(draft.photoPaths) || draft.photoPaths.length > MAX_SCAN_PHOTOS) {
    return 'invalid-photos'
  }
  if (draft.photoPaths.some((item) => typeof item !== 'string' || item.length === 0)) {
    return 'invalid-photos'
  }
  return 'ok'
}

export function appendPhotoPaths(current: string[], incoming: string[]): string[] {
  const next = [...current]
  for (const path of incoming) {
    if (typeof path !== 'string' || path.length === 0) continue
    if (next.includes(path)) continue
    if (next.length >= MAX_SCAN_PHOTOS) break
    next.push(path)
  }
  return next
}

export function buildManualScan(draft: ManualScanDraft, capturedAt: string): RoomScan {
  const widthMm = parsePositiveMm(draft.widthText)
  const depthMm = parsePositiveMm(draft.depthText)
  const heightMm = parsePositiveMm(draft.heightText)
  return {
    planId: draft.planId,
    source: 'manual',
    widthMm: widthMm ?? 0,
    depthMm: depthMm ?? 0,
    heightMm: heightMm ?? 0,
    photoPaths: draft.photoPaths.slice(0, MAX_SCAN_PHOTOS),
    capturedAt,
  }
}

export function buildVisionKitScan(input: {
  planId: string
  widthMm: number
  depthMm: number
  heightMm: number
  capturedAt: string
}): RoomScan {
  return {
    planId: input.planId,
    source: 'visionkit-v2',
    widthMm: input.widthMm,
    depthMm: input.depthMm,
    heightMm: input.heightMm,
    photoPaths: [],
    capturedAt: input.capturedAt,
  }
}

export type MeasurePhase = 'width-a' | 'width-b' | 'depth-a' | 'depth-b' | 'height'

export type MeasureState = {
  phase: MeasurePhase
  widthMm: number | null
  depthMm: number | null
  heightMm: number
  pending: ArrayLike<number> | null
}

export function createMeasureState(heightMm = DEFAULT_ROOM_HEIGHT_MM): MeasureState {
  return {
    phase: 'width-a',
    widthMm: null,
    depthMm: null,
    heightMm,
    pending: null,
  }
}

export function measureHint(phase: MeasurePhase): string {
  if (phase === 'width-a') return '点击地面第一点，测量长度'
  if (phase === 'width-b') return '再点击地面第二点，完成长度'
  if (phase === 'depth-a') return '点击地面第一点，测量宽度'
  if (phase === 'depth-b') return '再点击地面第二点，完成宽度'
  return '确认层高后保存'
}

export function canSaveMeasure(state: MeasureState): boolean {
  return (
    state.phase === 'height' &&
    state.widthMm != null &&
    state.widthMm > 0 &&
    state.depthMm != null &&
    state.depthMm > 0 &&
    state.heightMm > 0
  )
}

export function applyHit(
  state: MeasureState,
  transform: ArrayLike<number>,
): { state: MeasureState; error?: 'no-distance' } {
  if (state.phase === 'height') return { state }
  if (state.phase === 'width-a' || state.phase === 'depth-a') {
    return {
      state: {
        ...state,
        pending: transform,
        phase: state.phase === 'width-a' ? 'width-b' : 'depth-b',
      },
    }
  }
  if (state.pending == null) return { state, error: 'no-distance' }
  const mm = distanceMmBetweenTransforms(state.pending, transform)
  if (mm == null) return { state, error: 'no-distance' }
  if (state.phase === 'width-b') {
    return {
      state: {
        ...state,
        widthMm: mm,
        pending: null,
        phase: 'depth-a',
      },
    }
  }
  return {
    state: {
      ...state,
      depthMm: mm,
      pending: null,
      phase: 'height',
    },
  }
}

export type PageRect = { left: number; top: number; width: number; height: number }

export function normalizePageTap(
  pageX: number,
  pageY: number,
  rect: PageRect,
): { x: number; y: number } | null {
  if (!(rect.width > 0) || !(rect.height > 0)) return null
  const x = (pageX - rect.left) / rect.width
  const y = (pageY - rect.top) / rect.height
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  }
}
