import { ROOM_LABELS } from '../constants/labels'
import type { AiRecommendItem, AiRecommendRequest } from '../types/aiRecommend'
import type { Product } from '../types/domain'
import { PRODUCTS } from './products'

export const AI_RECOMMEND_DELAY_MS = 400

export const RECOMMEND_SCORES = [1, 0.8, 0.6] as const

export type RecommendProductsOptions = {
  products?: readonly Product[]
  delayMs?: number
}

function priceDistance(product: Product, budgetFen: number): number {
  return Math.abs(product.priceFen - budgetFen / 5)
}

function sortByDistance(products: readonly Product[], budgetFen: number): Product[] {
  return [...products].sort((left, right) => {
    const delta = priceDistance(left, budgetFen) - priceDistance(right, budgetFen)
    if (delta !== 0) return delta
    return left.id.localeCompare(right.id)
  })
}

function formatReason(req: AiRecommendRequest): string {
  return `与当前方案风格一致，尺寸适合 ${req.areaM2}㎡ ${ROOM_LABELS[req.roomType]}`
}

function toItems(products: readonly Product[], req: AiRecommendRequest): AiRecommendItem[] {
  const reason = formatReason(req)
  return products.map((product, index) => ({
    productId: product.id,
    score: RECOMMEND_SCORES[index] ?? 0.6,
    reason,
  }))
}

export function selectRecommendItems(
  req: AiRecommendRequest,
  products: readonly Product[] = PRODUCTS,
): AiRecommendItem[] {
  const existing = new Set(req.existingProductIds)
  const roomPool = products.filter(
    (product) => product.rooms.includes(req.roomType) && !existing.has(product.id),
  )
  const sameStyle = roomPool.filter((product) => product.style === req.style)
  const picked = sortByDistance(sameStyle, req.budgetFen).slice(0, 3)
  if (picked.length < 3) {
    const pickedIds = new Set(picked.map((item) => item.id))
    const relaxed = roomPool.filter((product) => !pickedIds.has(product.id))
    picked.push(...sortByDistance(relaxed, req.budgetFen).slice(0, 3 - picked.length))
  }
  return toItems(picked, req)
}

export async function recommendProducts(
  req: AiRecommendRequest,
  options: RecommendProductsOptions = {},
): Promise<AiRecommendItem[]> {
  const delayMs = options.delayMs ?? AI_RECOMMEND_DELAY_MS
  if (delayMs > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs)
    })
  }
  return selectRecommendItems(req, options.products ?? PRODUCTS)
}
