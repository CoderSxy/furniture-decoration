import type { RoomType, StyleTag } from './domain'

export interface AiRecommendRequest {
  planId: string
  roomType: RoomType
  areaM2: number
  style: StyleTag
  budgetFen: number
  existingProductIds: string[]
}

export interface AiRecommendItem {
  productId: string
  score: number
  reason: string
}
