// src/utils/resetMock.ts
import { useAiPreviewStore } from '../stores/aiPreviewStore'
import { useBudgetStore } from '../stores/budgetStore'
import { useFavoriteStore } from '../stores/favoriteStore'
import { usePlanStore } from '../stores/planStore'
import { useScanStore } from '../stores/scanStore'

import { getFailedStorageWrites } from './storage'
import { clearTombstones } from './tombstones'

export function clearMyDataLocal(): { ok: boolean; failedKeys: string[] } {
  useFavoriteStore.getState().reset()
  usePlanStore.getState().reset()
  useBudgetStore.getState().reset()
  useScanStore.getState().reset()
  useAiPreviewStore.getState().reset()
  clearTombstones()
  const failedKeys = getFailedStorageWrites()
  return { ok: failedKeys.length === 0, failedKeys }
}

export function resetMockData(): { ok: boolean; failedKeys: string[] } {
  return clearMyDataLocal()
}
