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

export const LOGIN_BUTTON_TEXT = '微信登录'
export const LOGIN_SUBTITLE = '使用微信身份同步收藏、方案、预算等到云端。不获取手机号。'
export const LOGIN_PRIVACY_DENIED_TEXT = '需要同意隐私指引才能同步'
export const LOGIN_FAILED_TEXT = '登录失败，请重试'
export const LOGIN_CODE_EXPIRED_TEXT = '登录已过期，请再点一次'
export const SYNC_FAILED_TEXT = '同步失败，将在网络恢复后重试'
export const LOGIN_MISSING_BASE_TEXT = '未配置服务地址，无法登录'

export const MINE_NOTE_TEXT = '登录后，收藏、方案、预算、房型尺寸和 AI 选品快照会同步到自建 HTTPS 服务器。使用微信 openid 识别同一用户，不获取手机号。扫描参考照片仍只留在本机，不会上传。可退出登录或清除我的数据。'
export const MINE_PRIVACY_MODAL_TEXT = '相机用于房型测量，参考照片由你主动选择且不上云。登录后业务数据同步到自建服务器；用户标识为微信 openid，不收集手机号。可通过「退出登录」清除本机会话，或「清除我的数据」删除云端与本机业务记录。'
export const LOGOUT_BUTTON_TEXT = '退出登录'
export const CLEAR_MY_DATA_TEXT = '清除我的数据'
export const CLEAR_MY_DATA_CONFIRM_CONTENT = '将删除云端与本机的收藏、方案、预算、扫描和 AI 快照，商品列表不受影响。'
export const LOGIN_REQUIRED_TEXT = '请先登录'
