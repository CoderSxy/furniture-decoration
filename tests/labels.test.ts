import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BUDGET_CATEGORY_LABELS,
  BUDGET_CATEGORY_ORDER,
  CATEGORY_FILTER_OPTIONS,
  CATEGORY_LABELS,
  EMPTY_AI_RECOMMEND_TEXT,
  PRICE_RANGE_FILTER_OPTIONS,
  PRICE_RANGE_LABELS,
  ROOM_CREATE_OPTIONS,
  ROOM_FILTER_OPTIONS,
  ROOM_LABELS,
  SCAN_SOURCE_LABELS,
  STAGE_LABELS,
  STAGE_ORDER,
  STYLE_FILTER_OPTIONS,
  STYLE_LABELS,
  XR_FRAME_UNSUPPORTED_TEXT,
  LOGIN_BUTTON_TEXT,
  LOGIN_CODE_EXPIRED_TEXT,
  LOGIN_FAILED_TEXT,
  LOGIN_MISSING_BASE_TEXT,
  LOGIN_PRIVACY_DENIED_TEXT,
  LOGIN_SUBTITLE,
  SYNC_FAILED_TEXT,
} from '../src/constants/labels.ts'

test('room / style / category labels match the M1 enum table', () => {
  assert.deepEqual(ROOM_LABELS, {
    living: '客厅',
    bedroom: '卧室',
    kitchen: '厨房',
    bathroom: '卫生间',
    study: '书房',
    balcony: '阳台',
  })
  assert.deepEqual(STYLE_LABELS, {
    modern: '现代',
    nordic: '北欧',
    chinese: '中式',
    lightLuxury: '轻奢',
  })
  assert.deepEqual(CATEGORY_LABELS, {
    sofa: '沙发',
    bed: '床',
    table: '桌几',
    cabinet: '柜类',
    chair: '椅凳',
    light: '灯具',
    other: '其他',
  })
})

test('price range labels use the four M1 bands plus 全部', () => {
  assert.deepEqual(PRICE_RANGE_LABELS, {
    all: '全部',
    lt1000: '1千以下',
    '1000to3000': '1–3千',
    '3000to8000': '3–8千',
    gte8000: '8千以上',
  })
})

test('filter option rows start with all and cover every enum', () => {
  assert.deepEqual(CATEGORY_FILTER_OPTIONS, [
    'all',
    'sofa',
    'bed',
    'table',
    'cabinet',
    'chair',
    'light',
    'other',
  ])
  assert.deepEqual(ROOM_FILTER_OPTIONS, [
    'all',
    'living',
    'bedroom',
    'kitchen',
    'bathroom',
    'study',
    'balcony',
  ])
  assert.deepEqual(STYLE_FILTER_OPTIONS, ['all', 'modern', 'nordic', 'chinese', 'lightLuxury'])
  assert.deepEqual(PRICE_RANGE_FILTER_OPTIONS, [
    'all',
    'lt1000',
    '1000to3000',
    '3000to8000',
    'gte8000',
  ])
})

test('plan stage labels match the M2 table and cannot skip', () => {
  assert.deepEqual(STAGE_LABELS, {
    measure: '量房',
    design: '设计',
    construct: '施工',
    accept: '验收',
  })
  assert.deepEqual(STAGE_ORDER, ['measure', 'design', 'construct', 'accept'])
  assert.deepEqual(ROOM_CREATE_OPTIONS, [
    'living',
    'bedroom',
    'kitchen',
    'bathroom',
    'study',
    'balcony',
  ])
})

test('budget category labels match the M3 table and keep a stable order', () => {
  assert.deepEqual(BUDGET_CATEGORY_LABELS, {
    furniture: '家具',
    material: '材料',
    labor: '人工',
    other: '其他',
  })
  assert.deepEqual(BUDGET_CATEGORY_ORDER, ['furniture', 'material', 'labor', 'other'])
})

test('scan source labels match M4 copy', () => {
  assert.deepEqual(SCAN_SOURCE_LABELS, {
    'visionkit-v2': 'VisionKit 测量',
    manual: '手动填写',
  })
})

test('M5 copy matches the design strings exactly', () => {
  assert.equal(EMPTY_AI_RECOMMEND_TEXT, '暂无推荐，请先放宽预算或去选品')
  assert.equal(XR_FRAME_UNSUPPORTED_TEXT, '当前基础库不支持 3D 预览')
})

test('login copy matches the openid design and refuses phone wording as a requirement', () => {
  assert.equal(LOGIN_BUTTON_TEXT, '微信登录')
  assert.equal(LOGIN_SUBTITLE, '使用微信身份同步收藏、方案、预算等到云端。不获取手机号。')
  assert.equal(LOGIN_PRIVACY_DENIED_TEXT, '需要同意隐私指引才能同步')
  assert.equal(LOGIN_FAILED_TEXT, '登录失败，请重试')
  assert.equal(LOGIN_CODE_EXPIRED_TEXT, '登录已过期，请再点一次')
  assert.equal(SYNC_FAILED_TEXT, '同步失败，将在网络恢复后重试')
  assert.equal(LOGIN_MISSING_BASE_TEXT, '未配置服务地址，无法登录')
  assert.match(LOGIN_SUBTITLE, /不获取手机号/)
})
