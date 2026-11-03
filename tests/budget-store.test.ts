// tests/budget-store.test.ts
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { BUDGETS_STORAGE_KEY } from '../src/constants/storageKeys.ts'
import { PRODUCTS } from '../src/mocks/products.ts'
import {
  parsePersistedBudgets,
  selectBudgetByPlanId,
  useBudgetStore,
} from '../src/stores/budgetStore.ts'
import type { Budget, Plan } from '../src/types/domain.ts'
import { configureStorage, createMemoryStorage, readJSON } from '../src/utils/storage.ts'

const NOW = '2026-11-03T08:00:00.000Z'

function samplePlan(patch: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-living',
    title: '客厅翻新',
    roomType: 'living',
    areaM2: 32,
    stage: 'measure',
    productIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  }
}

const validBudget: Budget = {
  planId: 'plan-living',
  totalFen: 2560000,
  spentByCategory: {
    furniture: 0,
    material: 896000,
    labor: 640000,
    other: 1024000,
  },
}

describe('budgetStore', { concurrency: false }, () => {
  beforeEach(() => {
    configureStorage(createMemoryStorage())
    useBudgetStore.setState({ budgets: {} })
  })

  it('parsePersistedBudgets drops malformed rows and key mismatches', () => {
    assert.deepEqual(parsePersistedBudgets(null), {})
    assert.deepEqual(parsePersistedBudgets([]), {})
    const parsed = parsePersistedBudgets({
      'plan-living': validBudget,
      'plan-mismatch': { ...validBudget, planId: 'other' },
      'plan-bad-total': { ...validBudget, planId: 'plan-bad-total', totalFen: -1 },
      'plan-missing-cat': {
        planId: 'plan-missing-cat',
        totalFen: 100,
        spentByCategory: { furniture: 1, material: 1, labor: 1 },
      },
    })
    assert.deepEqual(Object.keys(parsed), ['plan-living'])
    assert.deepEqual(parsed['plan-living'], validBudget)
  })

  it('ensureForPlan creates area-based budget and updates furniture after products change', () => {
    const created = useBudgetStore.getState().ensureForPlan(samplePlan(), PRODUCTS)
    assert.equal(created.totalFen, 2560000)
    assert.equal(created.spentByCategory.furniture, 0)
    assert.deepEqual(readJSON(BUDGETS_STORAGE_KEY, {}), {
      'plan-living': created,
    })

    const withItem = useBudgetStore.getState().ensureForPlan(
      samplePlan({ productIds: ['p-sofa-modern-01'] }),
      PRODUCTS,
    )
    assert.equal(withItem.spentByCategory.furniture, 299900)
    assert.equal(selectBudgetByPlanId(useBudgetStore.getState(), 'plan-living')?.spentByCategory.furniture, 299900)
  })

  it('ensureForPlans rebuilds every plan and drops orphans', () => {
    useBudgetStore.getState().ensureForPlan(samplePlan({ id: 'gone' }), PRODUCTS)
    useBudgetStore.getState().ensureForPlans(
      [
        samplePlan({ id: 'plan-a', areaM2: 10, productIds: ['p-bed-chinese-04'] }),
        samplePlan({ id: 'plan-b', areaM2: 12.5 }),
      ],
      PRODUCTS,
    )
    const { budgets } = useBudgetStore.getState()
    assert.equal(budgets.gone, undefined)
    assert.equal(budgets['plan-a'].totalFen, 800000)
    assert.equal(budgets['plan-a'].spentByCategory.furniture, 1280000)
    assert.equal(budgets['plan-b'].totalFen, 1000000)
    assert.deepEqual(readJSON(BUDGETS_STORAGE_KEY, {}), budgets)
  })

  it('hydrate restores fd:budgets and reset clears the key', () => {
    const memory = createMemoryStorage({
      [BUDGETS_STORAGE_KEY]: JSON.stringify({ 'plan-living': validBudget }),
    })
    configureStorage(memory)
    useBudgetStore.setState({ budgets: {} })
    useBudgetStore.getState().hydrate()
    assert.deepEqual(useBudgetStore.getState().budgets, { 'plan-living': validBudget })

    useBudgetStore.getState().reset()
    assert.deepEqual(useBudgetStore.getState().budgets, {})
    assert.deepEqual(readJSON(BUDGETS_STORAGE_KEY, { keep: true }), {})
  })
})
