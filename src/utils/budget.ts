import { isValidArea } from './domainLimits'
// src/utils/budget.ts
import type { Budget, FavoriteRecord, Plan, PlanStage, Product } from '../types/domain'

export const AREA_BUDGET_FEN_PER_M2 = 80000
export const MATERIAL_RATIO = 0.35
export const LABOR_RATIO = 0.25

export const STAGE_PROGRESS_PERCENT: Record<PlanStage, number> = {
  measure: 15,
  design: 40,
  construct: 75,
  accept: 100,
}

function safeFen(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function computeTotalFen(areaM2: number): number {
  if (!isValidArea(areaM2)) return 0
  return safeFen(Math.round(areaM2 * AREA_BUDGET_FEN_PER_M2))
}

export function computeFurnitureFen(
  productIds: readonly string[],
  products: readonly Product[],
): number {
  const byId = new Map(products.map((item) => [item.id, item]))
  let sum = 0
  for (const id of productIds) {
    const product = byId.get(id)
    if (product) {
      const next = sum + safeFen(product.priceFen)
      if (Number.isSafeInteger(next)) sum = next
    }
  }
  return sum
}

export function computeMaterialFen(totalFen: number): number {
  return safeFen(Math.round(safeFen(totalFen) * MATERIAL_RATIO))
}

export function computeLaborFen(totalFen: number): number {
  return safeFen(Math.round(safeFen(totalFen) * LABOR_RATIO))
}

export function computeOtherFen(
  totalFen: number,
  furnitureFen: number,
  materialFen: number,
  laborFen: number,
): number {
  return safeFen(Math.max(0, safeFen(totalFen) - safeFen(furnitureFen) - safeFen(materialFen) - safeFen(laborFen)))
}

export function buildBudget(
  plan: Pick<Plan, 'id' | 'areaM2' | 'productIds'>,
  products: readonly Product[],
): Omit<Budget, 'updatedAt'> {
  const totalFen = computeTotalFen(plan.areaM2)
  const furniture = computeFurnitureFen(plan.productIds, products)
  const material = computeMaterialFen(totalFen)
  const labor = computeLaborFen(totalFen)
  const other = computeOtherFen(totalFen, furniture, material, labor)
  return {
    planId: plan.id,
    totalFen,
    spentByCategory: {
      furniture,
      material,
      labor,
      other,
    },
  }
}

export function occupancyPercent(spentFen: number, totalFen: number): number {
  if (!Number.isFinite(spentFen) || !Number.isFinite(totalFen) || totalFen <= 0) return 0
  if (spentFen <= 0) return 0
  return Math.min(100, Math.round((spentFen / totalFen) * 100))
}

export function isFurnitureOverspent(
  budget: Pick<Budget, 'totalFen' | 'spentByCategory'>,
): boolean {
  return budget.spentByCategory.furniture > budget.totalFen
}

export function stageProgressPercent(stage: PlanStage): number {
  return STAGE_PROGRESS_PERCENT[stage]
}

export function countFavoritesNotInPlan(
  favorites: readonly FavoriteRecord[],
  productIds: readonly string[],
): number {
  const inPlan = new Set(productIds)
  return favorites.filter((item) => !inPlan.has(item.productId)).length
}

export function favoritesNotInPlanTip(count: number): string | null {
  if (count <= 0) return null
  return `收藏中有 ${count} 件尚未加入当前方案`
}
