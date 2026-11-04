import assert from 'node:assert/strict'
import test from 'node:test'
import { PRODUCTS } from '../src/mocks/products.ts'
import { useCatalogStore } from '../src/stores/catalogStore.ts'
import { useFavoriteStore } from '../src/stores/favoriteStore.ts'
import { usePlanStore } from '../src/stores/planStore.ts'
import { useAiPreviewStore } from '../src/stores/aiPreviewStore.ts'
import { useBudgetStore } from '../src/stores/budgetStore.ts'
import { useScanStore } from '../src/stores/scanStore.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import { useUiStore } from '../src/stores/uiStore.ts'

test('stores start with spec M0/M1 defaults', () => {
  assert.equal(useCatalogStore.getState().products, PRODUCTS)
  assert.deepEqual(useCatalogStore.getState().filters, {
    category: 'all',
    room: 'all',
    style: 'all',
    priceRange: 'all',
  })
  assert.deepEqual(useFavoriteStore.getState().items, [])
  assert.deepEqual(usePlanStore.getState().plans, [])
  assert.equal(usePlanStore.getState().activePlanId, null)
  assert.deepEqual(useBudgetStore.getState().budgets, {})
  assert.deepEqual(useScanStore.getState().scans, {})
  assert.deepEqual(useAiPreviewStore.getState().previews, {})
  assert.equal(useSyncStore.getState().token, null)
  assert.equal(useSyncStore.getState().userId, null)
  assert.equal(useSyncStore.getState().pendingRetry, false)
  assert.equal(useUiStore.getState().filterPanelOpen, false)
})
