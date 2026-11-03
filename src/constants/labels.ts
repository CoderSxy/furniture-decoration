import type {
  BudgetCategory,
  PlanStage,
  PriceRange,
  ProductCategory,
  RoomScan,
  RoomType,
  StyleTag,
} from '../types/domain'

export const ROOM_LABELS: Record<RoomType, string> = {
  living: '客厅',
  bedroom: '卧室',
  kitchen: '厨房',
  bathroom: '卫生间',
  study: '书房',
  balcony: '阳台',
}

export const STYLE_LABELS: Record<StyleTag, string> = {
  modern: '现代',
  nordic: '北欧',
  chinese: '中式',
  lightLuxury: '轻奢',
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  sofa: '沙发',
  bed: '床',
  table: '桌几',
  cabinet: '柜类',
  chair: '椅凳',
  light: '灯具',
  other: '其他',
}

export const PRICE_RANGE_LABELS: Record<PriceRange, string> = {
  all: '全部',
  lt1000: '1千以下',
  '1000to3000': '1–3千',
  '3000to8000': '3–8千',
  gte8000: '8千以上',
}

export const STAGE_LABELS: Record<PlanStage, string> = {
  measure: '量房',
  design: '设计',
  construct: '施工',
  accept: '验收',
}

export const STAGE_ORDER = ['measure', 'design', 'construct', 'accept'] as const satisfies readonly PlanStage[]

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  furniture: '家具',
  material: '材料',
  labor: '人工',
  other: '其他',
}

export const BUDGET_CATEGORY_ORDER = [
  'furniture',
  'material',
  'labor',
  'other',
] as const satisfies readonly BudgetCategory[]

export const SCAN_SOURCE_LABELS: Record<RoomScan['source'], string> = {
  'visionkit-v2': 'VisionKit 测量',
  manual: '手动填写',
}

export const CATEGORY_FILTER_OPTIONS = [
  'all',
  'sofa',
  'bed',
  'table',
  'cabinet',
  'chair',
  'light',
  'other',
] as const satisfies readonly (ProductCategory | 'all')[]

export const ROOM_FILTER_OPTIONS = [
  'all',
  'living',
  'bedroom',
  'kitchen',
  'bathroom',
  'study',
  'balcony',
] as const satisfies readonly (RoomType | 'all')[]

export const ROOM_CREATE_OPTIONS = [
  'living',
  'bedroom',
  'kitchen',
  'bathroom',
  'study',
  'balcony',
] as const satisfies readonly RoomType[]

export const STYLE_FILTER_OPTIONS = [
  'all',
  'modern',
  'nordic',
  'chinese',
  'lightLuxury',
] as const satisfies readonly (StyleTag | 'all')[]

export const PRICE_RANGE_FILTER_OPTIONS = [
  'all',
  'lt1000',
  '1000to3000',
  '3000to8000',
  'gte8000',
] as const satisfies readonly PriceRange[]

export const EMPTY_AI_RECOMMEND_TEXT = '暂无推荐，请先放宽预算或去选品'

export const XR_FRAME_UNSUPPORTED_TEXT = '当前基础库不支持 3D 预览'
