export const ROOM_TYPES = ['living', 'bedroom', 'kitchen', 'bathroom', 'study', 'balcony'] as const
export const STAGES = ['measure', 'design', 'construct', 'accept'] as const
export const STYLES = ['modern', 'nordic', 'chinese', 'lightLuxury'] as const
export const BUDGET_CATEGORIES = ['furniture', 'material', 'labor', 'other'] as const
export const SCAN_SOURCES = ['visionkit-v2', 'manual'] as const
export const SYNC_KINDS = ['favorite', 'plan', 'budget', 'scan', 'aiPreview', 'preference'] as const
export const KIND_LIMITS = {
  favorite: 200,
  plan: 50,
  budget: 50,
  scan: 50,
  aiPreview: 50,
  preference: 1,
} as const
export const TOMBSTONE_LIMIT = 400
export const CLOCK_SKEW_MS = 10 * 60 * 1000
export const MAX_AREA_M2 = 10000
export const MAX_SCAN_DIMENSION_MM = 100000
