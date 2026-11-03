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

export function computeTotalFen(areaM2: number): number {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return 0
  return Math.round(areaM2 * AREA_BUDGET_FEN_PER_M2)
}

export function computeFurnitureFen(
  productIds: readonly string[],
  products: readonly Product[],
): number {
  const byId = new Map(products.map((item) => [item.id, item]))
  let sum = 0
  for (const id of productIds) {
    const product = byId.get(id)
    if (product) sum += product.priceFen
  }
  return sum
}

export function computeMaterialFen(totalFen: number): number {
  return Math.round(totalFen * MATERIAL_RATIO)
}

export function computeLaborFen(totalFen: number): number {
  return Math.round(totalFen * LABOR_RATIO)
}

export function computeOtherFen(
  totalFen: number,
  furnitureFen: number,
  materialFen: number,
  laborFen: number,
): number {
  return Math.max(0, totalFen - furnitureFen - materialFen - laborFen)
}

export function buildBudget(
  plan: Pick<Plan, 'id' | 'areaM2' | 'productIds'>,
  products: readonly Product[],
): Budget {
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
