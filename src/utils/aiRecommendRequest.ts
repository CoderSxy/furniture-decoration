import { computeTotalFen } from './budget'
import type { Plan, Product, StyleTag } from '../types/domain'
import type { AiRecommendRequest } from '../types/aiRecommend'

export const DEFAULT_RECOMMEND_STYLE: StyleTag = 'modern'

export function resolvePlanStyle(
  plan: Pick<Plan, 'productIds'>,
  products: readonly Product[],
): StyleTag {
  const byId = new Map(products.map((item) => [item.id, item]))
  for (const id of plan.productIds) {
    const product = byId.get(id)
    if (product) return product.style
  }
  return DEFAULT_RECOMMEND_STYLE
}

export function buildAiRecommendRequest(
  plan: Pick<Plan, 'id' | 'roomType' | 'areaM2' | 'productIds'>,
  products: readonly Product[],
): AiRecommendRequest {
  return {
    planId: plan.id,
    roomType: plan.roomType,
    areaM2: plan.areaM2,
    style: resolvePlanStyle(plan, products),
    budgetFen: computeTotalFen(plan.areaM2),
    existingProductIds: [...plan.productIds],
  }
}
