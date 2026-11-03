import { isValidScanDimension } from '../utils/domainLimits'
import { MAX_SCAN_PHOTOS } from '../utils/scanMeasure'
import { create } from 'zustand'
import { SCANS_STORAGE_KEY } from '../constants/storageKeys'
import type { RoomScan } from '../types/domain'
import { readJSON, writeJSON } from '../utils/storage'

function parsePhotoPaths(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((item): item is string => typeof item === 'string')
}

function parseScan(key: string, input: unknown): RoomScan | null {
  if (input == null || typeof input !== 'object') return null
  const row = input as Record<string, unknown>
  if (typeof row.planId !== 'string' || row.planId.length === 0 || row.planId !== key) return null
  if (row.source !== 'visionkit-v2' && row.source !== 'manual') return null
  if (!isValidScanDimension(row.widthMm)) return null
  if (!isValidScanDimension(row.depthMm)) return null
  if (!isValidScanDimension(row.heightMm)) return null
  if (!Array.isArray(row.photoPaths) || row.photoPaths.length > MAX_SCAN_PHOTOS ||
    row.photoPaths.some((path) => typeof path !== 'string' || path.length === 0)) return null
  if (typeof row.capturedAt !== 'string' || row.capturedAt.length === 0) return null
  return {
    planId: row.planId,
    source: row.source,
    widthMm: row.widthMm,
    depthMm: row.depthMm,
    heightMm: row.heightMm,
    photoPaths: parsePhotoPaths(row.photoPaths),
    capturedAt: row.capturedAt,
  }
}

export function parsePersistedScans(input: unknown): Record<string, RoomScan> {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return {}
  const result: Record<string, RoomScan> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const scan = parseScan(key, value)
    if (scan) result[key] = scan
  }
  return result
}

function persist(scans: Record<string, RoomScan>): void {
  writeJSON(SCANS_STORAGE_KEY, scans)
}

export type ScanState = {
  scans: Record<string, RoomScan>
  hydrate: () => void
  reset: () => void
  upsert: (scan: RoomScan) => void
}

export const useScanStore = create<ScanState>((set, get) => ({
  scans: {},
  hydrate: () => {
    set({ scans: parsePersistedScans(readJSON<unknown>(SCANS_STORAGE_KEY, null)) })
  },
  reset: () => {
    persist({})
    set({ scans: {} })
  },
  upsert: (scan) => {
    const valid = parseScan(scan.planId, scan)
    if (!valid) return
    const scans = { ...get().scans, [valid.planId]: valid }
    persist(scans)
    set({ scans })
  },
}))

export function selectScanByPlanId(state: ScanState, planId: string): RoomScan | undefined {
  return state.scans[planId]
}

export function getByPlanId(planId: string): RoomScan | undefined {
  return selectScanByPlanId(useScanStore.getState(), planId)
}
