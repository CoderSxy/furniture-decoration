// tests/reset-mock.test.ts
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import {
  BUDGETS_STORAGE_KEY,
  FAVORITES_STORAGE_KEY,
  PLANS_STORAGE_KEY,
  SCANS_STORAGE_KEY,
} from '../src/constants/storageKeys.ts'
import { PRODUCTS } from '../src/mocks/products.ts'
import { useBudgetStore } from '../src/stores/budgetStore.ts'
import { useCatalogStore } from '../src/stores/catalogStore.ts'
import { useFavoriteStore } from '../src/stores/favoriteStore.ts'
import { usePlanStore } from '../src/stores/planStore.ts'
import { useScanStore } from '../src/stores/scanStore.ts'
import { resetMockData } from '../src/utils/resetMock.ts'
import { configureStorage, createMemoryStorage, readJSON, retryFailedStorageWrites } from '../src/utils/storage.ts'

describe('resetMockData', { concurrency: false }, () => {
  beforeEach(() => {
    configureStorage(createMemoryStorage())
    useFavoriteStore.setState({ items: [] })
    usePlanStore.setState({ plans: [], activePlanId: null })
    useBudgetStore.setState({ budgets: {} })
    useScanStore.setState({ scans: {} })
  })

  it('clears favorites plans budgets scans and leaves catalog products', () => {
    useFavoriteStore.getState().toggleFavorite('p-sofa-modern-01')
    const created = usePlanStore.getState().createPlan({
      title: '客厅',
      roomType: 'living',
      areaM2: 32,
    })
    assert.equal(created.ok, true)
    if (!created.ok) throw new Error('expected plan')
    useBudgetStore.getState().ensureForPlan(created.plan, PRODUCTS)
    useScanStore.setState({
      scans: {
        [created.plan.id]: {
          planId: created.plan.id,
          source: 'manual',
          widthMm: 1,
          depthMm: 1,
          heightMm: 1,
          photoPaths: [],
          capturedAt: '2026-11-03T00:00:00.000Z',
        },
      },
    })

    const productCount = useCatalogStore.getState().products.length
    resetMockData()

    assert.deepEqual(useFavoriteStore.getState().items, [])
    assert.deepEqual(usePlanStore.getState().plans, [])
    assert.equal(usePlanStore.getState().activePlanId, null)
    assert.deepEqual(useBudgetStore.getState().budgets, {})
    assert.deepEqual(useScanStore.getState().scans, {})
    assert.deepEqual(readJSON(FAVORITES_STORAGE_KEY, ['x']), [])
    assert.deepEqual(readJSON(PLANS_STORAGE_KEY, { keep: true }), {
      plans: [],
      activePlanId: null,
    })
    assert.deepEqual(readJSON(BUDGETS_STORAGE_KEY, { keep: true }), {})
    assert.deepEqual(readJSON(SCANS_STORAGE_KEY, { keep: true }), {})
    assert.equal(useCatalogStore.getState().products.length, productCount)
    assert.equal(useCatalogStore.getState().products, PRODUCTS)
  })
})


it('partial reset failures are recorded and retry persists the cleared state', () => {
  const memory = createMemoryStorage()
  let fail = true
  const writes: string[] = []
  configureStorage({
    getItem: memory.getItem,
    setItem: (key, value) => {
      writes.push(key)
      if (fail && key === PLANS_STORAGE_KEY) throw Error('quota')
      memory.setItem(key, value)
    },
  })
  usePlanStore.setState({ plans: [], activePlanId: 'old' })
  const result = resetMockData()
  assert.deepEqual(result, { ok: false, failedKeys: [PLANS_STORAGE_KEY] })
  assert.deepEqual(writes, [FAVORITES_STORAGE_KEY, PLANS_STORAGE_KEY, BUDGETS_STORAGE_KEY, SCANS_STORAGE_KEY])
  assert.equal(usePlanStore.getState().activePlanId, null)
  fail = false
  assert.deepEqual(retryFailedStorageWrites(), [{ ok: true }])
  assert.deepEqual(readJSON(PLANS_STORAGE_KEY, null), { plans: [], activePlanId: null })
})
