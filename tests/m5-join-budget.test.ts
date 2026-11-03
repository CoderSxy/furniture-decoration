import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { PRODUCTS } from '../src/mocks/products.ts'
import { selectRecommendItems } from '../src/mocks/aiRecommend.ts'
import { useBudgetStore } from '../src/stores/budgetStore.ts'
import { selectPlanById, usePlanStore } from '../src/stores/planStore.ts'
import { buildAiRecommendRequest } from '../src/utils/aiRecommendRequest.ts'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'

describe('join AI recommend updates furniture occupancy', { concurrency: false }, () => {
  beforeEach(() => {
    configureStorage(createMemoryStorage())
    usePlanStore.setState({ plans: [], activePlanId: null })
    useBudgetStore.setState({ budgets: {} })
  })

  it('adding the first living/modern recommendation increases furniture fen', () => {
    const created = usePlanStore.getState().createPlan({
      title: '客厅翻新',
      roomType: 'living',
      areaM2: 20,
    })
    assert.equal(created.ok, true)
    if (!created.ok) throw new Error('expected plan')
    const before = useBudgetStore.getState().ensureForPlan(created.plan, PRODUCTS)
    assert.equal(before.spentByCategory.furniture, 0)

    const req = buildAiRecommendRequest(created.plan, PRODUCTS)
    const items = selectRecommendItems(req, PRODUCTS)
    assert.equal(items[0]?.productId, 'p-sofa-modern-01')
    assert.equal(usePlanStore.getState().addProductToPlan(created.plan.id, items[0].productId), 'added')
    const next = selectPlanById(usePlanStore.getState(), created.plan.id)
    assert.ok(next)
    const after = useBudgetStore.getState().ensureForPlan(next, PRODUCTS)
    assert.equal(after.spentByCategory.furniture, 299900)
    assert.ok(next.productIds.includes('p-sofa-modern-01'))
  })
})
