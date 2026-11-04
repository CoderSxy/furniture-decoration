import { useAiPreviewStore } from '../stores/aiPreviewStore'
import { useBudgetStore } from '../stores/budgetStore'
import { useFavoriteStore } from '../stores/favoriteStore'
import { usePlanStore } from '../stores/planStore'
import { useScanStore } from '../stores/scanStore'
import { clearTombstones } from './tombstones'
import { getFailedStorageWrites, readJSON, writeJSON } from './storage'

const OWNER_KEY = 'fd:dataOwner'

export function resetBusinessData(): void {
  useFavoriteStore.getState().reset()
  usePlanStore.getState().reset()
  useBudgetStore.getState().reset()
  useScanStore.getState().reset()
  useAiPreviewStore.getState().reset()
  clearTombstones()
}

export function claimBusinessData(userId: string): void {
  const owner = readJSON<string | null>(OWNER_KEY, null)
  if (owner !== userId) {
    // Unknown legacy ownership is also isolated; never adopt another account's data.
    resetBusinessData()
    if (getFailedStorageWrites().length > 0) throw new Error('无法清理旧用户数据')
    if (!writeJSON(OWNER_KEY, userId).ok) throw new Error('无法保存数据归属')
  }
}

export function migrateBusinessOwner(userId: string | null): void {
  if (userId && readJSON(OWNER_KEY, null) == null) {
    if (!writeJSON(OWNER_KEY, userId).ok) throw new Error('无法保存数据归属')
  }
}
