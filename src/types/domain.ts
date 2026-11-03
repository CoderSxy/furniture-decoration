export type RoomType =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'study'
  | 'balcony'

export type StyleTag = 'modern' | 'nordic' | 'chinese' | 'lightLuxury'

export type ProductCategory =
  | 'sofa'
  | 'bed'
  | 'table'
  | 'cabinet'
  | 'chair'
  | 'light'
  | 'other'

export type PlanStage = 'measure' | 'design' | 'construct' | 'accept'

export type BudgetCategory = 'furniture' | 'material' | 'labor' | 'other'

export type PriceRange =
  | 'all'
  | 'lt1000'
  | '1000to3000'
  | '3000to8000'
  | 'gte8000'

export interface Product {
  id: string
  name: string
  category: ProductCategory
  rooms: RoomType[]
  style: StyleTag
  priceFen: number
  coverUrl: string
  imageUrls: string[]
  sizeMm: { w: number; d: number; h: number }
  material: string
  description: string
}

export interface FavoriteRecord {
  productId: string
  savedAt: string
  updatedAt: string
}

export interface Plan {
  id: string
  title: string
  roomType: RoomType
  areaM2: number
  stage: PlanStage
  productIds: string[]
  coverProductId?: string
  createdAt: string
  updatedAt: string
}

export interface RoomScan {
  planId: string
  source: 'visionkit-v2' | 'manual'
  widthMm: number
  depthMm: number
  heightMm: number
  photoPaths: string[]
  capturedAt: string
  updatedAt: string
}

export interface Budget {
  planId: string
  totalFen: number
  spentByCategory: Record<BudgetCategory, number>
  updatedAt: string
}

export interface CatalogFilters {
  category: ProductCategory | 'all'
  room: RoomType | 'all'
  style: StyleTag | 'all'
  priceRange: PriceRange
}
