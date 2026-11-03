// src/utils/resetMock.ts
import { useBudgetStore } from '../stores/budgetStore'
import { useFavoriteStore } from '../stores/favoriteStore'
import { usePlanStore } from '../stores/planStore'
import { useScanStore } from '../stores/scanStore'

import { getFailedStorageWrites } from './storage'

export function resetMockData(): { ok: boolean; failedKeys: string[] } {
  useFavoriteStore.getState().reset()
  usePlanStore.getState().reset()
  useBudgetStore.getState().reset()
  useScanStore.getState().reset()
  const failedKeys = getFailedStorageWrites()
  return { ok: failedKeys.length === 0, failedKeys }
}
