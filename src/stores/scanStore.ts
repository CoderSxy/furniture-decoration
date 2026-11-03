import { create } from 'zustand'
import type { RoomScan } from '../types/domain'

export type ScanState = {
  scans: Record<string, RoomScan>
}

export const useScanStore = create<ScanState>(() => ({
  scans: {},
}))
