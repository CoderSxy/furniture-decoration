export type SyncKind = 'favorite' | 'plan' | 'budget' | 'scan' | 'aiPreview' | 'preference'

export type SyncItem = {
  kind: SyncKind
  itemId: string
  updatedAt: string
  deleted: boolean
  payload: unknown | null
}

export type FavoritePayload = {
  productId: string
  savedAt: string
  updatedAt: string
}

export type BudgetPayload = {
  planId: string
  totalFen: number
  spentByCategory: Record<'furniture' | 'material' | 'labor' | 'other', number>
  updatedAt: string
}

export type ScanPayload = {
  planId: string
  source: 'visionkit-v2' | 'manual'
  widthMm: number
  depthMm: number
  heightMm: number
  photoPaths: []
  capturedAt: string
  updatedAt: string
}

export type AiPreviewPayload = {
  planId: string
  request: {
    planId: string
    roomType: string
    areaM2: number
    style: string
    budgetFen: number
    existingProductIds: string[]
  }
  items: Array<{ productId: string; score: number; reason: string }>
  updatedAt: string
}

export type PreferencePayload = {
  activePlanId: string | null
}
