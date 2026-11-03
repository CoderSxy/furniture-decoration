import assert from 'node:assert/strict'
import test from 'node:test'
import { PRODUCTS } from '../src/mocks/products.ts'
import {
  DEFAULT_RECOMMEND_STYLE,
  buildAiRecommendRequest,
  resolvePlanStyle,
} from '../src/utils/aiRecommendRequest.ts'
import type { Plan } from '../src/types/domain.ts'

const NOW = '2026-11-03T08:00:00.000Z'

function plan(patch: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-living',
    title: '客厅翻新',
    roomType: 'living',
    areaM2: 20,
    stage: 'measure',
    productIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  }
}

test('empty plan uses modern style and area-based budgetFen', () => {
  assert.equal(DEFAULT_RECOMMEND_STYLE, 'modern')
  assert.equal(resolvePlanStyle(plan(), PRODUCTS), 'modern')
  assert.deepEqual(buildAiRecommendRequest(plan(), PRODUCTS), {
    planId: 'plan-living',
    roomType: 'living',
    areaM2: 20,
    style: 'modern',
    budgetFen: 1600000,
    existingProductIds: [],
  })
})

test('plan style follows the first catalog product in productIds', () => {
  const withNordic = plan({ productIds: ['missing', 'p-sofa-nordic-02', 'p-sofa-modern-01'] })
  assert.equal(resolvePlanStyle(withNordic, PRODUCTS), 'nordic')
  const req = buildAiRecommendRequest(withNordic, PRODUCTS)
  assert.equal(req.style, 'nordic')
  assert.deepEqual(req.existingProductIds, ['missing', 'p-sofa-nordic-02', 'p-sofa-modern-01'])
})
