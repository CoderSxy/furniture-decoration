import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AI_RECOMMEND_DELAY_MS,
  recommendProducts,
  selectRecommendItems,
} from '../src/mocks/aiRecommend.ts'
import { PRODUCTS } from '../src/mocks/products.ts'
import type { Product } from '../src/types/domain.ts'
import type { AiRecommendRequest } from '../src/types/aiRecommend.ts'

function product(patch: Partial<Product> & Pick<Product, 'id' | 'rooms' | 'style' | 'priceFen'>): Product {
  return {
    name: patch.id,
    category: 'other',
    coverUrl: 'https://example.com/x.jpg',
    imageUrls: [],
    sizeMm: { w: 100, d: 100, h: 100 },
    material: 'x',
    description: 'x',
    ...patch,
  }
}

const CATALOG: Product[] = [
  product({ id: 'a', rooms: ['living'], style: 'modern', priceFen: 100 }),
  product({ id: 'b', rooms: ['living'], style: 'modern', priceFen: 200 }),
  product({ id: 'c', rooms: ['living'], style: 'modern', priceFen: 300 }),
  product({ id: 'd', rooms: ['living'], style: 'nordic', priceFen: 150 }),
  product({ id: 'e', rooms: ['bedroom'], style: 'modern', priceFen: 100 }),
]

const baseReq: AiRecommendRequest = {
  planId: 'plan-1',
  roomType: 'living',
  areaM2: 20,
  style: 'modern',
  budgetFen: 1000,
  existingProductIds: [],
}

test('selectRecommendItems ranks same room+style by price distance and is deterministic', () => {
  const first = selectRecommendItems(baseReq, CATALOG)
  const second = selectRecommendItems(baseReq, CATALOG)
  assert.deepEqual(first, [
    {
      productId: 'b',
      score: 1,
      reason: '与当前方案风格一致，尺寸适合 20㎡ 客厅',
    },
    {
      productId: 'a',
      score: 0.8,
      reason: '与当前方案风格一致，尺寸适合 20㎡ 客厅',
    },
    {
      productId: 'c',
      score: 0.6,
      reason: '与当前方案风格一致，尺寸适合 20㎡ 客厅',
    },
  ])
  assert.deepEqual(second, first)
})

test('selectRecommendItems skips existing ids then relaxes style to fill 3', () => {
  const items = selectRecommendItems(
    { ...baseReq, existingProductIds: ['b'] },
    CATALOG,
  )
  assert.deepEqual(
    items.map((item) => item.productId),
    ['a', 'c', 'd'],
  )
  assert.deepEqual(
    items.map((item) => item.score),
    [1, 0.8, 0.6],
  )
})

test('selectRecommendItems returns [] when no room candidates remain', () => {
  const items = selectRecommendItems(
    { ...baseReq, existingProductIds: ['a', 'b', 'c', 'd'] },
    CATALOG,
  )
  assert.deepEqual(items, [])
})

test('PRODUCTS living/modern/20㎡ is stable across two calls', () => {
  const req: AiRecommendRequest = {
    planId: 'plan-living',
    roomType: 'living',
    areaM2: 20,
    style: 'modern',
    budgetFen: 1600000,
    existingProductIds: [],
  }
  const first = selectRecommendItems(req, PRODUCTS)
  const second = selectRecommendItems(req, PRODUCTS)
  assert.deepEqual(
    first.map((item) => item.productId),
    ['p-sofa-modern-01', 'p-table-modern-06', 'p-light-modern-11'],
  )
  assert.deepEqual(second, first)
  assert.equal(first[0]?.reason, '与当前方案风格一致，尺寸适合 20㎡ 客厅')
})

test('PRODUCTS balcony/nordic with the only item already in plan is empty', () => {
  const items = selectRecommendItems(
    {
      planId: 'plan-balc',
      roomType: 'balcony',
      areaM2: 6,
      style: 'nordic',
      budgetFen: 480000,
      existingProductIds: ['p-other-chinese-13'],
    },
    PRODUCTS,
  )
  assert.deepEqual(items, [])
})

test('recommendProducts waits 400ms then returns the same items', async () => {
  assert.equal(AI_RECOMMEND_DELAY_MS, 400)
  const started = Date.now()
  const items = await recommendProducts(baseReq, { products: CATALOG })
  assert.ok(Date.now() - started >= 400)
  assert.deepEqual(
    items.map((item) => item.productId),
    ['b', 'a', 'c'],
  )
})

test('recommendProducts can skip delay in tests via delayMs 0', async () => {
  const started = Date.now()
  const items = await recommendProducts(baseReq, { products: CATALOG, delayMs: 0 })
  assert.ok(Date.now() - started < 400)
  assert.equal(items.length, 3)
})
