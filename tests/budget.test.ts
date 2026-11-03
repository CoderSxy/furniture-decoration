// tests/budget.test.ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { PRODUCTS } from '../src/mocks/products.ts'
import type { FavoriteRecord, Plan, Product } from '../src/types/domain.ts'
import {
  AREA_BUDGET_FEN_PER_M2,
  LABOR_RATIO,
  MATERIAL_RATIO,
  STAGE_PROGRESS_PERCENT,
  buildBudget,
  computeFurnitureFen,
  computeLaborFen,
  computeMaterialFen,
  computeOtherFen,
  computeTotalFen,
  countFavoritesNotInPlan,
  favoritesNotInPlanTip,
  isFurnitureOverspent,
  occupancyPercent,
  stageProgressPercent,
} from '../src/utils/budget.ts'

const sofa = PRODUCTS.find((item) => item.id === 'p-sofa-modern-01') as Product
const luxuryBed = PRODUCTS.find((item) => item.id === 'p-bed-chinese-04') as Product

function plan(patch: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-living',
    title: '客厅翻新',
    roomType: 'living',
    areaM2: 32,
    stage: 'measure',
    productIds: [],
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
    ...patch,
  }
}

test('constants match the M3 formula', () => {
  assert.equal(AREA_BUDGET_FEN_PER_M2, 80000)
  assert.equal(MATERIAL_RATIO, 0.35)
  assert.equal(LABOR_RATIO, 0.25)
  assert.deepEqual(STAGE_PROGRESS_PERCENT, {
    measure: 15,
    design: 40,
    construct: 75,
    accept: 100,
  })
})

test('computeTotalFen rounds areaM2 * 80000', () => {
  assert.equal(computeTotalFen(32), 2560000)
  assert.equal(computeTotalFen(12.5), 1000000)
  assert.equal(computeTotalFen(10), 800000)
  assert.equal(computeTotalFen(0), 0)
  assert.equal(computeTotalFen(-1), 0)
  assert.equal(computeTotalFen(Number.NaN), 0)
})

test('furniture sums plan products only and skips unknown ids', () => {
  assert.equal(computeFurnitureFen([], PRODUCTS), 0)
  assert.equal(computeFurnitureFen(['p-sofa-modern-01'], PRODUCTS), sofa.priceFen)
  assert.equal(
    computeFurnitureFen(['p-sofa-modern-01', 'missing', 'p-bed-chinese-04'], PRODUCTS),
    sofa.priceFen + luxuryBed.priceFen,
  )
})

test('material labor other follow 35 / 25 / remainder and other never goes negative', () => {
  const totalFen = 2560000
  const material = computeMaterialFen(totalFen)
  const labor = computeLaborFen(totalFen)
  assert.equal(material, 896000)
  assert.equal(labor, 640000)
  assert.equal(computeOtherFen(totalFen, 0, material, labor), 1024000)
  assert.equal(computeOtherFen(totalFen, 299900, material, labor), 724100)
  assert.equal(computeOtherFen(800000, 1280000, 280000, 200000), 0)
})

test('buildBudget writes the four spent categories for a plan', () => {
  const empty = buildBudget(plan(), PRODUCTS)
  assert.deepEqual(empty, {
    planId: 'plan-living',
    totalFen: 2560000,
    spentByCategory: {
      furniture: 0,
      material: 896000,
      labor: 640000,
      other: 1024000,
    },
  })

  const withSofa = buildBudget(plan({ productIds: ['p-sofa-modern-01'] }), PRODUCTS)
  assert.equal(withSofa.spentByCategory.furniture, 299900)
  assert.equal(withSofa.spentByCategory.other, 724100)
  assert.equal(isFurnitureOverspent(withSofa), false)

  const over = buildBudget(
    plan({ areaM2: 10, productIds: ['p-bed-chinese-04'] }),
    PRODUCTS,
  )
  assert.equal(over.totalFen, 800000)
  assert.equal(over.spentByCategory.furniture, 1280000)
  assert.equal(over.spentByCategory.material, 280000)
  assert.equal(over.spentByCategory.labor, 200000)
  assert.equal(over.spentByCategory.other, 0)
  assert.equal(isFurnitureOverspent(over), true)
})

test('occupancyPercent caps at 100 and never returns NaN or negatives', () => {
  assert.equal(occupancyPercent(0, 2560000), 0)
  assert.equal(occupancyPercent(1280000, 2560000), 50)
  assert.equal(occupancyPercent(2560000, 2560000), 100)
  assert.equal(occupancyPercent(1280000, 800000), 100)
  assert.equal(occupancyPercent(100, 0), 0)
  assert.equal(occupancyPercent(-10, 1000), 0)
  assert.equal(occupancyPercent(Number.NaN, 1000), 0)
  assert.equal(occupancyPercent(100, Number.NaN), 0)
  assert.equal(Number.isNaN(occupancyPercent(1, 0)), false)
})

test('stageProgressPercent maps the four stages', () => {
  assert.equal(stageProgressPercent('measure'), 15)
  assert.equal(stageProgressPercent('design'), 40)
  assert.equal(stageProgressPercent('construct'), 75)
  assert.equal(stageProgressPercent('accept'), 100)
})

test('favorites-not-in-plan counts the set difference and hides when N=0', () => {
  const favorites: FavoriteRecord[] = [
    { productId: 'p-sofa-modern-01', savedAt: '2026-11-03T00:00:00.000Z', updatedAt: '2026-11-03T00:00:00.000Z' },
    { productId: 'p-bed-chinese-04', savedAt: '2026-11-03T00:00:00.000Z', updatedAt: '2026-11-03T00:00:00.000Z' },
    { productId: 'gone-from-mock', savedAt: '2026-11-03T00:00:00.000Z', updatedAt: '2026-11-03T00:00:00.000Z' },
  ]
  assert.equal(countFavoritesNotInPlan(favorites, ['p-sofa-modern-01']), 2)
  assert.equal(
    countFavoritesNotInPlan(favorites, ['p-sofa-modern-01', 'p-bed-chinese-04', 'gone-from-mock']),
    0,
  )
  assert.equal(countFavoritesNotInPlan([], ['p-sofa-modern-01']), 0)
  assert.equal(favoritesNotInPlanTip(2), '收藏中有 2 件尚未加入当前方案')
  assert.equal(favoritesNotInPlanTip(1), '收藏中有 1 件尚未加入当前方案')
  assert.equal(favoritesNotInPlanTip(0), null)
  assert.equal(favoritesNotInPlanTip(-1), null)
})
