// src/utils/resetMock.ts
import { useBudgetStore } from '../stores/budgetStore'
import { useFavoriteStore } from '../stores/favoriteStore'
import { usePlanStore } from '../stores/planStore'
import { useScanStore } from '../stores/scanStore'

export function resetMockData(): void {
  useFavoriteStore.getState().reset()
  usePlanStore.getState().reset()
  useBudgetStore.getState().reset()
  useScanStore.getState().reset()
}
