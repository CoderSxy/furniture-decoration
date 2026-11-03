# M5 AI 选品 + 2D/轻量 3D 预览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 M0–M4 Taro weapp 上交付 mock AI 选品与预览：方案详情进入「AI 选品」，按可复现规则给出最多 3 条建议并可一键加入方案（预算家具占用立刻变）；`pages/preview/index` 默认 2D 俯视排布（有扫描用 RoomScan，否则 4000×3000mm），可拖不持久化；有 xr-frame 能力时同页切轻量 cube 3D，无能力则隐藏切换并注明。

**Architecture:** 不重做脚手架，不改 `src/types/domain.ts` 里已有的 `RoomScan` / `Plan` / `Product` / `Budget`。设计里的 `AiRecommendRequest` / `AiRecommendItem` 落在新文件 `src/types/aiRecommend.ts`。选品规则是纯函数 `selectRecommendItems`，`recommendProducts` 只加 400ms 延迟；页面经 `fetchAiRecommendations` 调用，未设 `TARO_APP_AI_RECOMMEND_URL` 时走 mock，设了则 `Taro.request` POST（URL 来自环境变量，不写密钥）。预览只读 `plan.productIds` + 可选 `scanStore`；自动排布与 mm→m cube 位姿是纯函数；拖动只存在页面 state。3D 用分包内原生 `xr-frame` 组件（0 npm，不打 glTF）。`packagePreview` 已在 `app.config.ts` 注册，不要把 AI/预览推进 tabBar。

**Tech Stack:** Taro 4.3.2、React 18.3.1、TypeScript、Vite、Zustand 5、pnpm、Node.js `>=22.23.4 <23`、目标端仅 weapp。轻量 3D 用微信运行时 `xr-frame`（0 npm）。**不新增 threejs / 大模型 SDK / glTF 加载器。**

## Global Constraints

- 客户端：Taro 4 + React + TypeScript + Vite；实现钉 `@tarojs/*@4.3.2`；React 走模板 18.x（当前 `react@18.3.1`），不升 React 19。
- 状态：Zustand `create`；跨端持久化用自定义 `storage` 包一层 `Taro.setStorageSync` / `getStorageSync`，不用浏览器 `localStorage`。
- `config/dev.ts` 保持 `mini.debugReact: true`（Zustand 5 + Taro Vite 开发期规避 `taro.react_production_min.create is not a function`）。
- 包管理器 pnpm；`package.json` `engines.node` 为 `>=22.23.4 <23`。
- 目标端：weapp only。不并行维护 H5 / 支付宝 / 其他端。预览页不要写 H5 分支。
- 数据：本地 mock JSON + Zustand。M5 不接真实大模型、不接商用 3D 资产库、不接真实后端、不接微信云开发、不接支付、不做登录。
- 金额仍用整数 **分**（`priceFen` / `budgetFen`）；面积用数字平方米；尺寸用毫米；3D 场景 1 单位 = 1m（mm / 1000）；日期用 ISO 8601 字符串。
- 持久化 key 必须精确为：`fd:favorites`、`fd:plans`、`fd:budgets`、`fd:scans`。M5 **不得**新增家具坐标 key，拖动不落盘。
- 导航：Tab 用 `Taro.switchTab`；二级页用 `Taro.navigateTo`，参数只传 id。AI：`/packagePreview/pages/ai/recommend?planId=`。预览：`/packagePreview/pages/preview/index?planId=`。
- 主题：仅浅色。颜色与间距只用 `src/theme/tokens.ts` / `src/app.scss` CSS 变量，禁止新写一套颜色魔法值。
- UI 文案简体中文；代码标识符英文。空结果文案精确为「暂无推荐，请先放宽预算或去选品」。无 3D 能力文案精确为「当前基础库不支持 3D 预览」。入口按钮精确为「AI 选品」与「预览」。结果页加入按钮精确为「加入方案」。
- 房间中文对照沿用 M1：客厅 / 卧室 / 厨房 / 卫生间 / 书房 / 阳台。`reason` 模板精确为「与当前方案风格一致，尺寸适合 {areaM2}㎡ {房间中文名}」，不展示枚举值。
- 密钥、AppID 真值、模型 Key 不进仓库。`project.config.json` 保持占位 `touristappid`。真实推荐 URL 只允许出现在未跟踪的 `.env` / `project.private.config.json`。
- 未经 Nero 确认：不部署、不推生产、不提交小程序审核、不把体验版当正式发布。
- 只实现 `docs/superpowers/specs/2026-11-03-furniture-decoration-mvp-design.md` 的 **M5**。不要接真大模型、不要打 glTF 进包、不要引入 threejs-miniprogram。不要用 `taro init` 重搭工程。**不要改 `src/types/domain.ts`。** 不要改已有 `RoomScan` / `Plan` / `Product` / `Budget` 形状。不要改 mock 商品表。不要改 Tab IA。
- 规格来源：同文件「M5 AI 选品 + 3D 预览」+ 领域模型 `AiRecommendRequest` / `AiRecommendItem` + `packagePreview`。
- 测试命令必须带 `--import ./tests/preload-taro-globals.cjs`，并指向具体 `tests/*.test.ts` 文件（不要 `--test tests/`）。`pnpm test` 已是 `tests/*.test.ts`。
- xr-frame **热更新不可用**：改原生组件后必须 `pnpm build:weapp`，用微信开发者工具预览。2D 是必达；3D 是增强，失败不挡里程碑，但必须降级而不是崩溃。

---

## File Structure

本计划只改 M0–M4 已有工程。`src/types/domain.ts` 已含 `Product` / `Plan` / `RoomScan` / `Budget`，**不要改**。`package.json` **不要加依赖**。`app.config.ts` 已注册分包 `packagePreview` → `pages/ai/recommend` 与 `pages/preview/index`，不要把它们推进 tabBar。

```
src/types/aiRecommend.ts              # AiRecommendRequest / AiRecommendItem（设计类型缺口，不进 domain.ts）
src/constants/labels.ts               # 追加 EMPTY_AI_RECOMMEND_TEXT / XR_FRAME_UNSUPPORTED_TEXT
src/mocks/aiRecommend.ts              # selectRecommendItems + recommendProducts（延迟 400ms）
src/utils/aiRecommendRequest.ts       # resolvePlanStyle / buildAiRecommendRequest
src/utils/aiRecommendClient.ts        # fetchAiRecommendations：env URL 或 mock
src/utils/previewLayout.ts            # 默认房间、自动排布、拖动 clamp、mm→m cube
src/utils/xrCapability.ts             # SDK >= 2.32.0 才显示 3D 切换
src/utils/navigation.ts               # 追加 aiRecommendUrl / previewPageUrl
src/stores/planStore.ts               # 追加 addProductToPlan（不改 Plan 类型）
src/pages/plans/detail.tsx            # 「AI 选品」「预览」
src/pages/plans/detail.scss
src/packagePreview/pages/ai/recommend.tsx
src/packagePreview/pages/ai/recommend.scss
src/packagePreview/pages/preview/index.tsx
src/packagePreview/pages/preview/index.config.ts
src/packagePreview/pages/preview/index.scss
src/packagePreview/components/preview-2d/index.tsx
src/packagePreview/components/preview-2d/index.scss
src/packagePreview/native/xr-furniture/index.js
src/packagePreview/native/xr-furniture/index.json
src/packagePreview/native/xr-furniture/index.wxml
src/packagePreview/native/xr-furniture/index.wxss
config/index.ts                       # copy 原生 xr 组件到 dist
README.md                             # 当前里程碑改为 M5
tests/labels.test.ts
tests/navigation.test.ts
tests/tabs.test.ts
tests/ai-recommend.test.ts
tests/ai-recommend-client.test.ts
tests/ai-recommend-request.test.ts
tests/preview-layout.test.ts
tests/xr-capability.test.ts
tests/plan-store.test.ts              # 追加 addProductToPlan
tests/m5-join-budget.test.ts          # 加入推荐后家具占用增加
```

不要创建：支付、真实 LLM SDK、`.gltf` / `.glb` 资产、threejs、H5 配置、真实后端、新的 storage key。不要改 `src/types/domain.ts`、不要改 mock 商品、不要改 tabBar 四项、不要改 M3 预算公式。不要把扫描页改成 3D 家具放置。

**取舍（无新 npm）：** 2D 用 View 矩形 + 触摸，不引入 canvas 库。3D 只用微信内置 `xr-frame` 的 `geometry="cube"` / `geometry="plane"`；Taro 没有 xr-frame 一等组件，因此原生组件放分包并用 `config.copy` 拷到 `dist`。若目标基础库 < 2.32.0 或场景 ready 失败：隐藏 2D/3D 切换，只留 2D，文案「当前基础库不支持 3D 预览」。不引入 `threejs-miniprogram`（停更且占包体）。

---

### Task 1: AI 类型与固定文案

**Files:**
- Create: `src/types/aiRecommend.ts`
- Modify: `src/constants/labels.ts:1-118`
- Modify: `tests/labels.test.ts:1-120`
- Create: `tests/ai-recommend-types.test.ts`

**Interfaces:**
- Consumes: `src/types/domain.ts` 的 `RoomType` / `StyleTag`（只读，不改 domain）
- Produces:
  - `AiRecommendRequest` / `AiRecommendItem`（字段与设计一致）
  - `EMPTY_AI_RECOMMEND_TEXT = '暂无推荐，请先放宽预算或去选品'`
  - `XR_FRAME_UNSUPPORTED_TEXT = '当前基础库不支持 3D 预览'`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ai-recommend-types.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { AiRecommendItem, AiRecommendRequest } from '../src/types/aiRecommend.ts'

test('AiRecommend types live outside domain.ts and match the design fields', () => {
  const domain = readFileSync('src/types/domain.ts', 'utf8')
  assert.equal(domain.includes('AiRecommend'), false)

  const req: AiRecommendRequest = {
    planId: 'plan-1',
    roomType: 'living',
    areaM2: 20,
    style: 'modern',
    budgetFen: 1600000,
    existingProductIds: ['p-sofa-modern-01'],
  }
  const item: AiRecommendItem = {
    productId: 'p-table-modern-06',
    score: 1,
    reason: '与当前方案风格一致，尺寸适合 20㎡ 客厅',
  }
  assert.equal(req.planId, 'plan-1')
  assert.equal(item.score, 1)
})
```

把 `tests/labels.test.ts` 全文换成：

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/ai-recommend-types.test.ts tests/labels.test.ts
```

Expected: FAIL（`src/types/aiRecommend.ts` 不存在，且 `EMPTY_AI_RECOMMEND_TEXT` / `XR_FRAME_UNSUPPORTED_TEXT` 未导出）。

- [ ] **Step 3: Write minimal implementation**

```ts
// src/types/aiRecommend.ts
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
```

在 `src/constants/labels.ts` 文件末尾追加：

```ts
export const EMPTY_AI_RECOMMEND_TEXT = '暂无推荐，请先放宽预算或去选品'

export const XR_FRAME_UNSUPPORTED_TEXT = '当前基础库不支持 3D 预览'
```

不要改 `ROOM_LABELS` 或其它已有导出。不要改 `src/types/domain.ts`。

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/ai-recommend-types.test.ts tests/labels.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/aiRecommend.ts src/constants/labels.ts tests/ai-recommend-types.test.ts tests/labels.test.ts
git commit -m "feat: add M5 AI recommend types and copy constants"
```

---

### Task 2: mock 选品规则与 400ms 延迟

**Files:**
- Create: `src/mocks/aiRecommend.ts`
- Create: `src/utils/aiRecommendRequest.ts`
- Create: `tests/ai-recommend.test.ts`
- Create: `tests/ai-recommend-request.test.ts`

**Interfaces:**
- Consumes: `AiRecommendRequest` / `AiRecommendItem`、`PRODUCTS`、`ROOM_LABELS`、`computeTotalFen`
- Produces:
  - `AI_RECOMMEND_DELAY_MS = 400`
  - `RECOMMEND_SCORES = [1, 0.8, 0.6] as const`
  - `selectRecommendItems(req, products): AiRecommendItem[]`（同步、无随机）
  - `recommendProducts(req, options?): Promise<AiRecommendItem[]>`（先等 `delayMs ?? 400`，再调用 select）
  - `DEFAULT_RECOMMEND_STYLE = 'modern'`
  - `resolvePlanStyle(plan, products): StyleTag`：按 `productIds` 顺序取第一件能在商品表里找到的商品的 `style`；否则 `'modern'`
  - `buildAiRecommendRequest(plan, products): AiRecommendRequest`：`budgetFen = computeTotalFen(plan.areaM2)`
  - 过滤：`rooms` 含 `roomType`、同 `style`、id 不在 `existingProductIds`
  - 排序：`Math.abs(product.priceFen - budgetFen / 5)` 升序，并列按 `id` 升序（保证可复现）
  - 取 3 件；不足则从「同房间、未入选、未已选」里放宽风格再取满 3
  - `reason`：`与当前方案风格一致，尺寸适合 ${areaM2}㎡ ${ROOM_LABELS[roomType]}`
  - `score`：第 1/2/3 名 → 1 / 0.8 / 0.6
  - 无候选：返回 `[]`

设计缺口（写入实现，Self-review 记录）：`Plan` 没有 `style` 字段，用「方案内第一件商品的风格，否则 modern」。`budgetFen` 用面积公式总额，与 M3 `totalFen` 一致。

- [ ] **Step 1: Write the failing test**

```ts
// tests/ai-recommend-request.test.ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { PRODUCTS } from '../src/mocks/products.ts'
import {
  DEFAULT_RECOMMEND_STYLE,
  buildAiRecommendRequest,
  resolvePlanStyle,
} from '../src/utils/aiRecommendRequest.ts'
import type { Plan } from '../src/types/domain.ts'

const NOW = '2026-11-03T08:00:00.000Z'

function plan(patch: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-living',
    title: '客厅翻新',
    roomType: 'living',
    areaM2: 20,
    stage: 'measure',
    productIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  }
}

test('empty plan uses modern style and area-based budgetFen', () => {
  assert.equal(DEFAULT_RECOMMEND_STYLE, 'modern')
  assert.equal(resolvePlanStyle(plan(), PRODUCTS), 'modern')
  assert.deepEqual(buildAiRecommendRequest(plan(), PRODUCTS), {
    planId: 'plan-living',
    roomType: 'living',
    areaM2: 20,
    style: 'modern',
    budgetFen: 1600000,
    existingProductIds: [],
  })
})

test('plan style follows the first catalog product in productIds', () => {
  const withNordic = plan({ productIds: ['missing', 'p-sofa-nordic-02', 'p-sofa-modern-01'] })
  assert.equal(resolvePlanStyle(withNordic, PRODUCTS), 'nordic')
  const req = buildAiRecommendRequest(withNordic, PRODUCTS)
  assert.equal(req.style, 'nordic')
  assert.deepEqual(req.existingProductIds, ['missing', 'p-sofa-nordic-02', 'p-sofa-modern-01'])
})
```

```ts
// tests/ai-recommend.test.ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AI_RECOMMEND_DELAY_MS,
  recommendProducts,
  selectRecommendItems,
} from '../src/mocks/aiRecommend.ts'
import { PRODUCTS } from '../src/mocks/products.ts'
import type { Product } from '../src/types/domain.ts'
import type { AiRecommendRequest } from '../src/types/aiRecommend.ts'

function product(patch: Partial<Product> & Pick<Product, 'id' | 'rooms' | 'style' | 'priceFen'>): Product {
  return {
    name: patch.id,
    category: 'other',
    coverUrl: 'https://example.com/x.jpg',
    imageUrls: [],
    sizeMm: { w: 100, d: 100, h: 100 },
    material: 'x',
    description: 'x',
    ...patch,
  }
}

const CATALOG: Product[] = [
  product({ id: 'a', rooms: ['living'], style: 'modern', priceFen: 100 }),
  product({ id: 'b', rooms: ['living'], style: 'modern', priceFen: 200 }),
  product({ id: 'c', rooms: ['living'], style: 'modern', priceFen: 300 }),
  product({ id: 'd', rooms: ['living'], style: 'nordic', priceFen: 150 }),
  product({ id: 'e', rooms: ['bedroom'], style: 'modern', priceFen: 100 }),
]

const baseReq: AiRecommendRequest = {
  planId: 'plan-1',
  roomType: 'living',
  areaM2: 20,
  style: 'modern',
  budgetFen: 1000,
  existingProductIds: [],
}

test('selectRecommendItems ranks same room+style by price distance and is deterministic', () => {
  const first = selectRecommendItems(baseReq, CATALOG)
  const second = selectRecommendItems(baseReq, CATALOG)
  assert.deepEqual(first, [
    {
      productId: 'b',
      score: 1,
      reason: '与当前方案风格一致，尺寸适合 20㎡ 客厅',
    },
    {
      productId: 'a',
      score: 0.8,
      reason: '与当前方案风格一致，尺寸适合 20㎡ 客厅',
    },
    {
      productId: 'c',
      score: 0.6,
      reason: '与当前方案风格一致，尺寸适合 20㎡ 客厅',
    },
  ])
  assert.deepEqual(second, first)
})

test('selectRecommendItems skips existing ids then relaxes style to fill 3', () => {
  const items = selectRecommendItems(
    { ...baseReq, existingProductIds: ['b'] },
    CATALOG,
  )
  assert.deepEqual(
    items.map((item) => item.productId),
    ['a', 'c', 'd'],
  )
  assert.deepEqual(
    items.map((item) => item.score),
    [1, 0.8, 0.6],
  )
})

test('selectRecommendItems returns [] when no room candidates remain', () => {
  const items = selectRecommendItems(
    { ...baseReq, existingProductIds: ['a', 'b', 'c', 'd'] },
    CATALOG,
  )
  assert.deepEqual(items, [])
})

test('PRODUCTS living/modern/20㎡ is stable across two calls', () => {
  const req: AiRecommendRequest = {
    planId: 'plan-living',
    roomType: 'living',
    areaM2: 20,
    style: 'modern',
    budgetFen: 1600000,
    existingProductIds: [],
  }
  const first = selectRecommendItems(req, PRODUCTS)
  const second = selectRecommendItems(req, PRODUCTS)
  assert.deepEqual(
    first.map((item) => item.productId),
    ['p-sofa-modern-01', 'p-table-modern-06', 'p-light-modern-11'],
  )
  assert.deepEqual(second, first)
  assert.equal(first[0]?.reason, '与当前方案风格一致，尺寸适合 20㎡ 客厅')
})

test('PRODUCTS balcony/nordic with the only item already in plan is empty', () => {
  const items = selectRecommendItems(
    {
      planId: 'plan-balc',
      roomType: 'balcony',
      areaM2: 6,
      style: 'nordic',
      budgetFen: 480000,
      existingProductIds: ['p-other-chinese-13'],
    },
    PRODUCTS,
  )
  assert.deepEqual(items, [])
})

test('recommendProducts waits 400ms then returns the same items', async () => {
  assert.equal(AI_RECOMMEND_DELAY_MS, 400)
  const started = Date.now()
  const items = await recommendProducts(baseReq, { products: CATALOG })
  assert.ok(Date.now() - started >= 400)
  assert.deepEqual(
    items.map((item) => item.productId),
    ['b', 'a', 'c'],
  )
})

test('recommendProducts can skip delay in tests via delayMs 0', async () => {
  const started = Date.now()
  const items = await recommendProducts(baseReq, { products: CATALOG, delayMs: 0 })
  assert.ok(Date.now() - started < 400)
  assert.equal(items.length, 3)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/ai-recommend.test.ts tests/ai-recommend-request.test.ts
```

Expected: FAIL（模块不存在）。

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/aiRecommendRequest.ts
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
```

```ts
// src/mocks/aiRecommend.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/ai-recommend.test.ts tests/ai-recommend-request.test.ts
```

Expected: PASS（含约 400ms 的延迟用例）。

- [ ] **Step 5: Commit**

```bash
git add src/mocks/aiRecommend.ts src/utils/aiRecommendRequest.ts tests/ai-recommend.test.ts tests/ai-recommend-request.test.ts
git commit -m "feat: add deterministic mock AI recommend with 400ms delay"
```

---

### Task 3: 可替换推荐客户端

**Files:**
- Create: `src/utils/aiRecommendClient.ts`
- Create: `tests/ai-recommend-client.test.ts`

**Interfaces:**
- Consumes: `recommendProducts`、`AiRecommendRequest`
- Produces: `AI_RECOMMEND_URL_ENV = 'TARO_APP_AI_RECOMMEND_URL'`；`fetchAiRecommendations(req, deps?)`：`getUrl()` 非空则 `request({ url, method: 'POST', data: req })` 并要求 `data` 为数组，否则回 `[]`；未配置 URL 则 `recommend(req)`。UI 只 import 本文件，不直接 import `src/mocks/aiRecommend.ts`。不写死 URL，不附加 Authorization / 模型 Key。

- [ ] **Step 1: Write the failing test**

```ts
// tests/ai-recommend-client.test.ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AI_RECOMMEND_URL_ENV,
  fetchAiRecommendations,
} from '../src/utils/aiRecommendClient.ts'
import type { AiRecommendItem, AiRecommendRequest } from '../src/types/aiRecommend.ts'

const req: AiRecommendRequest = {
  planId: 'plan-1',
  roomType: 'living',
  areaM2: 20,
  style: 'modern',
  budgetFen: 1000,
  existingProductIds: [],
}

const mockItems: AiRecommendItem[] = [
  { productId: 'b', score: 1, reason: 'x' },
]

test('fetchAiRecommendations uses mock when URL env is empty', async () => {
  assert.equal(AI_RECOMMEND_URL_ENV, 'TARO_APP_AI_RECOMMEND_URL')
  let requested = 0
  const items = await fetchAiRecommendations(req, {
    getUrl: () => '',
    request: async () => {
      requested += 1
      return { data: [] }
    },
    recommend: async () => mockItems,
  })
  assert.equal(requested, 0)
  assert.deepEqual(items, mockItems)
})

test('fetchAiRecommendations POSTs JSON body to env URL without secrets', async () => {
  const calls: Array<{ url: string; method: string; data: unknown }> = []
  const items = await fetchAiRecommendations(req, {
    getUrl: () => 'https://example.invalid/ai/recommend',
    request: async (options) => {
      calls.push({
        url: options.url,
        method: options.method,
        data: options.data,
      })
      return {
        data: [{ productId: 'remote', score: 1, reason: '远程' }],
      }
    },
    recommend: async () => {
      throw new Error('mock should not run')
    },
  })
  assert.deepEqual(calls, [
    {
      url: 'https://example.invalid/ai/recommend',
      method: 'POST',
      data: req,
    },
  ])
  assert.deepEqual(items, [{ productId: 'remote', score: 1, reason: '远程' }])
})

test('fetchAiRecommendations returns [] when remote payload is not an array', async () => {
  const items = await fetchAiRecommendations(req, {
    getUrl: () => 'https://example.invalid/ai/recommend',
    request: async () => ({ data: { error: 'nope' } }),
    recommend: async () => mockItems,
  })
  assert.deepEqual(items, [])
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/ai-recommend-client.test.ts
```

Expected: FAIL（客户端模块不存在）。

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/aiRecommendClient.ts
import Taro from '@tarojs/taro'
import { recommendProducts } from '../mocks/aiRecommend'
import type { AiRecommendItem, AiRecommendRequest } from '../types/aiRecommend'

export const AI_RECOMMEND_URL_ENV = 'TARO_APP_AI_RECOMMEND_URL'

export type AiRecommendRequestOptions = {
  url: string
  method: 'POST'
  data: AiRecommendRequest
}

export type FetchAiRecommendationsDeps = {
  getUrl?: () => string | undefined
  request?: (options: AiRecommendRequestOptions) => Promise<{ data: unknown }>
  recommend?: (req: AiRecommendRequest) => Promise<AiRecommendItem[]>
}

function readEnvUrl(): string | undefined {
  const value = process.env.TARO_APP_AI_RECOMMEND_URL
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export async function fetchAiRecommendations(
  req: AiRecommendRequest,
  deps: FetchAiRecommendationsDeps = {},
): Promise<AiRecommendItem[]> {
  const url = (deps.getUrl ?? readEnvUrl)()
  if (typeof url === 'string' && url.length > 0) {
    const request = deps.request ?? ((options: AiRecommendRequestOptions) => Taro.request(options))
    const res = await request({ url, method: 'POST', data: req })
    return Array.isArray(res.data) ? (res.data as AiRecommendItem[]) : []
  }
  const recommend = deps.recommend ?? recommendProducts
  return recommend(req)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/ai-recommend-client.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/aiRecommendClient.ts tests/ai-recommend-client.test.ts
git commit -m "feat: add swappable AI recommend client via env URL"
```

---

### Task 4: 导航 URL 与方案详情入口

**Files:**
- Modify: `src/utils/navigation.ts:1-12`
- Modify: `tests/navigation.test.ts:1-30`
- Modify: `tests/tabs.test.ts:1-47`
- Modify: `src/pages/plans/detail.tsx:1-133`
- Modify: `src/pages/plans/detail.scss:1-156`

**Interfaces:**
- Consumes: 已有 `scanPageUrl` / 方案详情页
- Produces:
  - `aiRecommendUrl(planId)` → `/packagePreview/pages/ai/recommend?planId=`
  - `previewPageUrl(planId)` → `/packagePreview/pages/preview/index?planId=`
  - 方案详情在时间轴/采集区之后、已选商品之前，始终显示「AI 选品」「预览」（不限阶段）
  - 点击 `Taro.navigateTo`，只传 `planId`
  - `packagePreview` 仍在分包，不进 tabBar

- [ ] **Step 1: Write the failing test**

把 `tests/navigation.test.ts` 全文换成：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aiRecommendUrl,
  planDetailUrl,
  previewPageUrl,
  productDetailUrl,
  scanPageUrl,
} from '../src/utils/navigation.ts'

test('productDetailUrl only passes productId', () => {
  assert.equal(
    productDetailUrl('p-sofa-modern-01'),
    '/pages/catalog/detail?productId=p-sofa-modern-01',
  )
})

test('planDetailUrl only passes planId', () => {
  assert.equal(planDetailUrl('plan-1'), '/pages/plans/detail?planId=plan-1')
  assert.equal(
    planDetailUrl('plan/weird'),
    '/pages/plans/detail?planId=plan%2Fweird',
  )
})

test('scanPageUrl stays in packageScan and only passes planId', () => {
  assert.equal(
    scanPageUrl('plan-1'),
    '/packageScan/pages/scan/index?planId=plan-1',
  )
  assert.equal(
    scanPageUrl('plan/weird'),
    '/packageScan/pages/scan/index?planId=plan%2Fweird',
  )
})

test('aiRecommendUrl and previewPageUrl stay in packagePreview and only pass planId', () => {
  assert.equal(
    aiRecommendUrl('plan-1'),
    '/packagePreview/pages/ai/recommend?planId=plan-1',
  )
  assert.equal(
    previewPageUrl('plan-1'),
    '/packagePreview/pages/preview/index?planId=plan-1',
  )
  assert.equal(
    aiRecommendUrl('plan/weird'),
    '/packagePreview/pages/ai/recommend?planId=plan%2Fweird',
  )
  assert.equal(
    previewPageUrl('plan/weird'),
    '/packagePreview/pages/preview/index?planId=plan%2Fweird',
  )
})
```

把 `tests/tabs.test.ts` 全文换成：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { TAB_ITEMS } from '../src/constants/tabs.ts'

;(globalThis as { defineAppConfig?: <T>(config: T) => T }).defineAppConfig = (config) => config

import appConfig from '../src/app.config.ts'

test('four tabs use spec titles and paths', () => {
  assert.deepEqual(
    TAB_ITEMS.map((item) => [item.pagePath, item.text]),
    [
      ['pages/catalog/index', '选品'],
      ['pages/plans/index', '方案'],
      ['pages/budget/index', '预算'],
      ['pages/mine/index', '我的'],
    ],
  )
})

test('app config wires tabs, subpackages, and camera privacy copy', () => {
  assert.equal(appConfig.tabBar.list[0].text, '选品')
  assert.equal(appConfig.tabBar.list[1].text, '方案')
  assert.equal(appConfig.tabBar.list[2].text, '预算')
  assert.equal(appConfig.tabBar.list[3].text, '我的')
  assert.deepEqual(
    appConfig.subPackages.map((item) => item.root),
    ['packageScan', 'packagePreview'],
  )
  assert.deepEqual(appConfig.pages, [
    'pages/catalog/index',
    'pages/plans/index',
    'pages/budget/index',
    'pages/mine/index',
    'pages/catalog/detail',
    'pages/plans/detail',
  ])
  assert.equal(appConfig.tabBar.list.length, 4)
  assert.ok(appConfig.tabBar.list.every((item) => item.pagePath !== 'pages/plans/detail'))
  assert.ok(
    appConfig.subPackages.some(
      (item) => item.root === 'packageScan' && item.pages.includes('pages/scan/index'),
    ),
  )
  const preview = appConfig.subPackages.find((item) => item.root === 'packagePreview')
  assert.deepEqual(preview?.pages, ['pages/ai/recommend', 'pages/preview/index'])
  assert.ok(
    appConfig.tabBar.list.every(
      (item) =>
        item.pagePath !== 'packagePreview/pages/ai/recommend' &&
        item.pagePath !== 'packagePreview/pages/preview/index',
    ),
  )
  assert.equal(appConfig.permission?.['scope.camera']?.desc, '访问你的摄像头')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/navigation.test.ts tests/tabs.test.ts
```

Expected: FAIL（`aiRecommendUrl` / `previewPageUrl` 未导出）。tabs 用例在实现导航前就会因现有分包配置而通过；失败点以 navigation 为准。

- [ ] **Step 3: Write minimal implementation**

把 `src/utils/navigation.ts` 全文换成：

```ts
export function productDetailUrl(productId: string): string {
  return `/pages/catalog/detail?productId=${encodeURIComponent(productId)}`
}

export function planDetailUrl(planId: string): string {
  return `/pages/plans/detail?planId=${encodeURIComponent(planId)}`
}

export function scanPageUrl(planId: string): string {
  return `/packageScan/pages/scan/index?planId=${encodeURIComponent(planId)}`
}

export function aiRecommendUrl(planId: string): string {
  return `/packagePreview/pages/ai/recommend?planId=${encodeURIComponent(planId)}`
}

export function previewPageUrl(planId: string): string {
  return `/packagePreview/pages/preview/index?planId=${encodeURIComponent(planId)}`
}
```

把 `src/pages/plans/detail.tsx` 全文换成：

```tsx
import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { ProductCard } from '../../components/product-card'
import { RoomFloorplan } from '../../components/room-floorplan'
import { ROOM_LABELS, SCAN_SOURCE_LABELS, STAGE_LABELS, STAGE_ORDER } from '../../constants/labels'
import { useBudgetStore } from '../../stores/budgetStore'
import { useCatalogStore } from '../../stores/catalogStore'
import { selectPlanById, usePlanStore } from '../../stores/planStore'
import { selectScanByPlanId, useScanStore } from '../../stores/scanStore'
import type { Product } from '../../types/domain'
import { aiRecommendUrl, previewPageUrl, productDetailUrl, scanPageUrl } from '../../utils/navigation'
import { advanceBlockedReason, canAdvanceStage, formatPlanArea } from '../../utils/plans'
import './detail.scss'

export default function PlanDetailPage() {
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const plan = usePlanStore((state) => selectPlanById(state, planId))
  const scan = useScanStore((state) => selectScanByPlanId(state, planId))
  const removeProductFromPlan = usePlanStore((state) => state.removeProductFromPlan)
  const advanceStage = usePlanStore((state) => state.advanceStage)
  const products = useCatalogStore((state) => state.products)
  const ensureForPlan = useBudgetStore((state) => state.ensureForPlan)

  if (!plan) {
    return (
      <View className='page'>
        <Text className='plan-missing'>方案不存在</Text>
      </View>
    )
  }

  const currentIndex = STAGE_ORDER.indexOf(plan.stage)
  const planProducts: Product[] = plan.productIds
    .map((id) => products.find((item) => item.id === id))
    .filter((item): item is Product => item != null)
  const blocked = advanceBlockedReason(plan)
  const canAdvance = canAdvanceStage(plan)

  const onRemove = (productId: string) => {
    removeProductFromPlan(plan.id, productId)
    const next = selectPlanById(usePlanStore.getState(), plan.id)
    if (next) ensureForPlan(next, products)
  }

  return (
    <View className='page'>
      <Text className='plan-title'>{plan.title}</Text>
      <Text className='plan-meta'>
        {ROOM_LABELS[plan.roomType]} · {formatPlanArea(plan.areaM2)}
      </Text>
      <View className='plan-timeline'>
        {STAGE_ORDER.map((stage, index) => {
          const current = index === currentIndex
          const done = index < currentIndex
          const className = current
            ? 'plan-timeline__item plan-timeline__item--current'
            : done
              ? 'plan-timeline__item plan-timeline__item--done'
              : 'plan-timeline__item'
          return (
            <View key={stage} className={className}>
              <Text className='plan-timeline__text'>{STAGE_LABELS[stage]}</Text>
            </View>
          )
        })}
      </View>
      {plan.stage === 'measure' ? (
        <View
          className='plan-scan-entry'
          onClick={() => {
            Taro.navigateTo({ url: scanPageUrl(plan.id) })
          }}
        >
          <Text className='plan-scan-entry__text'>采集房型</Text>
        </View>
      ) : null}
      {scan ? (
        <View className='plan-scan'>
          <Text className='plan-section'>房型尺寸</Text>
          <Text className='plan-scan__size'>
            长 {scan.widthMm} × 宽 {scan.depthMm} × 高 {scan.heightMm} mm
          </Text>
          <Text className='plan-scan__source'>{SCAN_SOURCE_LABELS[scan.source]}</Text>
          <RoomFloorplan widthMm={scan.widthMm} depthMm={scan.depthMm} />
        </View>
      ) : null}
      <View
        className='plan-m5-entry'
        onClick={() => {
          Taro.navigateTo({ url: aiRecommendUrl(plan.id) })
        }}
      >
        <Text className='plan-m5-entry__text'>AI 选品</Text>
      </View>
      <View
        className='plan-m5-entry plan-m5-entry--ghost'
        onClick={() => {
          Taro.navigateTo({ url: previewPageUrl(plan.id) })
        }}
      >
        <Text className='plan-m5-entry__text'>预览</Text>
      </View>
      <Text className='plan-section'>已选商品</Text>
      {planProducts.length === 0 ? (
        <View
          className='plan-empty-products'
          onClick={() => {
            Taro.switchTab({ url: '/pages/catalog/index' })
          }}
        >
          <Text className='plan-empty-products__text'>还没有商品，去选品加入</Text>
        </View>
      ) : (
        planProducts.map((product) => (
          <View key={product.id} className='plan-product'>
            <ProductCard
              product={product}
              onTap={(id) => {
                Taro.navigateTo({ url: productDetailUrl(id) })
              }}
            />
            <View className='plan-product__remove' onClick={() => onRemove(product.id)}>
              <Text className='plan-product__remove-text'>移除</Text>
            </View>
          </View>
        ))
      )}
      {plan.stage === 'accept' ? (
        <Text className='plan-accept'>已验收</Text>
      ) : (
        <View>
          <View
            className={canAdvance ? 'plan-advance' : 'plan-advance plan-advance--disabled'}
            onClick={() => {
              if (!canAdvance) return
              advanceStage(plan.id)
            }}
          >
            <Text className='plan-advance__text'>推进到下一阶段</Text>
          </View>
          {blocked === '请先去选品' ? (
            <Text className='plan-advance__hint'>请先去选品</Text>
          ) : null}
        </View>
      )}
    </View>
  )
}
```

在 `src/pages/plans/detail.scss` 的 `.plan-scan__source` 之后、`.plan-section` 之前追加：

```scss
.plan-m5-entry {
  margin: 0 0 16px;
  padding: 20px 0;
  background: var(--color-primary);
  border-radius: 12px;
  text-align: center;
}

.plan-m5-entry--ghost {
  background: var(--color-card);
  border: 1px solid var(--color-primary);
}

.plan-m5-entry__text {
  color: #ffffff;
  font-size: 30px;
}

.plan-m5-entry--ghost .plan-m5-entry__text {
  color: var(--color-primary);
}
```

- [ ] **Step 4: Run tests**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/navigation.test.ts tests/tabs.test.ts
python3 - <<'PY'
from pathlib import Path
detail = Path('src/pages/plans/detail.tsx').read_text()
assert 'AI 选品' in detail
assert '预览' in detail
assert 'aiRecommendUrl' in detail
assert 'previewPageUrl' in detail
print('plan detail M5 entries OK')
PY
```

Expected: PASS，打印 `plan detail M5 entries OK`。

- [ ] **Step 5: Commit**

```bash
git add src/utils/navigation.ts tests/navigation.test.ts tests/tabs.test.ts src/pages/plans/detail.tsx src/pages/plans/detail.scss
git commit -m "feat: add AI recommend and preview entries on plan detail"
```

---

### Task 5: 按 planId 加入商品并刷新预算

**Files:**
- Modify: `src/stores/planStore.ts:91-151`
- Modify: `tests/plan-store.test.ts:109-119`
- Create: `tests/m5-join-budget.test.ts`

**Interfaces:**
- Consumes: 现有 `addProductToActivePlan` / `ensureForPlan` / `buildBudget`
- Produces: `addProductToPlan(planId, productId): AddProductResult`。方案不存在返回 `'no-active-plan'`；已有 id 返回 `'duplicate'`；否则追加、去重、补 `coverProductId`、不自动推进阶段。`addProductToActivePlan` 改为有 `activePlanId` 时委托 `addProductToPlan`。一键加入后必须 `ensureForPlan`，家具占用 = 方案内商品 `priceFen` 之和。不改 `Plan` 类型。

- [ ] **Step 1: Write the failing test**

在 `tests/plan-store.test.ts` 的 `addProductToActivePlan dedupes` 用例之后追加：

```ts
  it('addProductToPlan writes the given plan without switching activePlanId', () => {
    const first = usePlanStore.getState().createPlan({ title: 'A', roomType: 'living', areaM2: 12 })
    const second = usePlanStore.getState().createPlan({ title: 'B', roomType: 'study', areaM2: 8 })
    assert.equal(first.ok && second.ok, true)
    if (!first.ok || !second.ok) throw new Error('expected two plans')
    assert.equal(usePlanStore.getState().activePlanId, second.plan.id)

    assert.equal(usePlanStore.getState().addProductToPlan(first.plan.id, 'p-1'), 'added')
    assert.equal(usePlanStore.getState().addProductToPlan(first.plan.id, 'p-1'), 'duplicate')
    assert.equal(usePlanStore.getState().addProductToPlan('missing', 'p-1'), 'no-active-plan')
    assert.equal(usePlanStore.getState().activePlanId, second.plan.id)
    const target = usePlanStore.getState().plans.find((item) => item.id === first.plan.id)
    assert.deepEqual(target?.productIds, ['p-1'])
    assert.equal(target?.coverProductId, 'p-1')
    assert.equal(target?.stage, 'measure')
  })
```

```ts
// tests/m5-join-budget.test.ts
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { PRODUCTS } from '../src/mocks/products.ts'
import { selectRecommendItems } from '../src/mocks/aiRecommend.ts'
import { useBudgetStore } from '../src/stores/budgetStore.ts'
import { selectPlanById, usePlanStore } from '../src/stores/planStore.ts'
import { buildAiRecommendRequest } from '../src/utils/aiRecommendRequest.ts'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'

describe('join AI recommend updates furniture occupancy', { concurrency: false }, () => {
  beforeEach(() => {
    configureStorage(createMemoryStorage())
    usePlanStore.setState({ plans: [], activePlanId: null })
    useBudgetStore.setState({ budgets: {} })
  })

  it('adding the first living/modern recommendation increases furniture fen', () => {
    const created = usePlanStore.getState().createPlan({
      title: '客厅翻新',
      roomType: 'living',
      areaM2: 20,
    })
    assert.equal(created.ok, true)
    if (!created.ok) throw new Error('expected plan')
    const before = useBudgetStore.getState().ensureForPlan(created.plan, PRODUCTS)
    assert.equal(before.spentByCategory.furniture, 0)

    const req = buildAiRecommendRequest(created.plan, PRODUCTS)
    const items = selectRecommendItems(req, PRODUCTS)
    assert.equal(items[0]?.productId, 'p-sofa-modern-01')
    assert.equal(usePlanStore.getState().addProductToPlan(created.plan.id, items[0].productId), 'added')
    const next = selectPlanById(usePlanStore.getState(), created.plan.id)
    assert.ok(next)
    const after = useBudgetStore.getState().ensureForPlan(next, PRODUCTS)
    assert.equal(after.spentByCategory.furniture, 299900)
    assert.ok(next.productIds.includes('p-sofa-modern-01'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/plan-store.test.ts tests/m5-join-budget.test.ts
```

Expected: FAIL（`addProductToPlan` 未定义）。

- [ ] **Step 3: Write minimal implementation**

在 `src/stores/planStore.ts` 的 `PlanState` 增加：

```ts
  addProductToPlan: (planId: string, productId: string) => AddProductResult
```

把 `addProductToActivePlan` 换成下面两段（保留其余方法不变）：

```ts
  addProductToPlan: (planId, productId) => {
    const { plans, activePlanId } = get()
    const current = plans.find((item) => item.id === planId)
    if (!current) return 'no-active-plan'
    if (current.productIds.includes(productId)) return 'duplicate'
    const productIds = [...current.productIds, productId]
    const coverProductId = current.coverProductId ?? productId
    const next = plans.map((item) =>
      item.id === planId
        ? { ...item, productIds, coverProductId, updatedAt: new Date().toISOString() }
        : item,
    )
    persist(next, activePlanId)
    set({ plans: next })
    return 'added'
  },
  addProductToActivePlan: (productId) => {
    const { activePlanId } = get()
    if (activePlanId == null) return 'no-active-plan'
    return get().addProductToPlan(activePlanId, productId)
  },
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/plan-store.test.ts tests/m5-join-budget.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/planStore.ts tests/plan-store.test.ts tests/m5-join-budget.test.ts
git commit -m "feat: add product to a specific plan and refresh furniture budget"
```

---

### Task 6: AI 选品结果页

**Files:**
- Modify: `src/packagePreview/pages/ai/recommend.tsx:1-11`
- Modify: `src/packagePreview/pages/ai/recommend.scss:1-22`
- Modify: `src/packagePreview/pages/ai/recommend.config.ts:1-3`（`navigationBarTitleText` 保持 `'AI 选品'`）

**Interfaces:**
- Consumes: `fetchAiRecommendations`、`buildAiRecommendRequest`、`addProductToPlan`、`ensureForPlan`、`EMPTY_AI_RECOMMEND_TEXT`、`previewPageUrl`、`ProductCard`
- Produces: query 只读 `planId`。无方案显示「方案不存在」。进入后调 `fetchAiRecommendations`（默认 400ms）。加载文案「正在匹配家具…」。空数组显示 `EMPTY_AI_RECOMMEND_TEXT`。列表展示商品卡、`reason`、`匹配 {score}`、「加入方案」。加入成功 toast「已加入方案」并 `ensureForPlan`；重复 toast「已在方案中」。已在 `productIds` 里的按钮文案改为「已加入」。底部「去预览」走 `previewPageUrl(plan.id)`。页面 import `fetchAiRecommendations`，不 import `src/mocks/aiRecommend.ts`。

- [ ] **Step 1: Write the failing test**

```bash
python3 - <<'PY'
from pathlib import Path
page = Path('src/packagePreview/pages/ai/recommend.tsx').read_text()
assert 'M5 占位页' in page
assert 'fetchAiRecommendations' not in page
assert '加入方案' not in page
assert '暂无推荐，请先放宽预算或去选品' not in page
print('recommend still placeholder')
PY
```

Expected: 打印 `recommend still placeholder`。

- [ ] **Step 2: Confirm placeholder duty copy still present**

当前 `recommend.tsx` 仍是占位。本步只确认文件存在，不要先改。

- [ ] **Step 3: Write minimal implementation**

把 `src/packagePreview/pages/ai/recommend.tsx` 全文换成：

```tsx
import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { ProductCard } from '../../../components/product-card'
import { EMPTY_AI_RECOMMEND_TEXT } from '../../../constants/labels'
import { useBudgetStore } from '../../../stores/budgetStore'
import { useCatalogStore } from '../../../stores/catalogStore'
import { selectPlanById, usePlanStore } from '../../../stores/planStore'
import type { AiRecommendItem } from '../../../types/aiRecommend'
import { fetchAiRecommendations } from '../../../utils/aiRecommendClient'
import { buildAiRecommendRequest } from '../../../utils/aiRecommendRequest'
import { previewPageUrl, productDetailUrl } from '../../../utils/navigation'
import './recommend.scss'

export default function AiRecommendPage() {
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const plan = usePlanStore((state) => selectPlanById(state, planId))
  const products = useCatalogStore((state) => state.products)
  const addProductToPlan = usePlanStore((state) => state.addProductToPlan)
  const ensureForPlan = useBudgetStore((state) => state.ensureForPlan)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AiRecommendItem[]>([])

  useEffect(() => {
    if (!plan) {
      setLoading(false)
      setItems([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetchAiRecommendations(buildAiRecommendRequest(plan, products)).then((next) => {
      if (cancelled) return
      setItems(next)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [planId])

  if (!plan) {
    return (
      <View className='page'>
        <Text className='ai-missing'>方案不存在</Text>
      </View>
    )
  }

  const onAdd = (productId: string) => {
    const result = addProductToPlan(plan.id, productId)
    if (result === 'added') {
      const next = selectPlanById(usePlanStore.getState(), plan.id)
      if (next) ensureForPlan(next, products)
      Taro.showToast({ title: '已加入方案', icon: 'success' })
      return
    }
    if (result === 'duplicate') {
      Taro.showToast({ title: '已在方案中', icon: 'none' })
    }
  }

  return (
    <View className='page'>
      <Text className='ai-title'>AI 选品</Text>
      {loading ? <Text className='ai-status'>正在匹配家具…</Text> : null}
      {!loading && items.length === 0 ? (
        <Text className='ai-empty'>{EMPTY_AI_RECOMMEND_TEXT}</Text>
      ) : null}
      {!loading
        ? items.map((item) => {
            const product = products.find((row) => row.id === item.productId)
            if (!product) return null
            const joined = plan.productIds.includes(item.productId)
            return (
              <View key={item.productId} className='ai-item'>
                <ProductCard
                  product={product}
                  onTap={(id) => {
                    Taro.navigateTo({ url: productDetailUrl(id) })
                  }}
                />
                <Text className='ai-item__reason'>{item.reason}</Text>
                <Text className='ai-item__score'>匹配 {item.score}</Text>
                <View
                  className={joined ? 'ai-item__add ai-item__add--ghost' : 'ai-item__add'}
                  onClick={() => onAdd(item.productId)}
                >
                  <Text className='ai-item__add-text'>{joined ? '已加入' : '加入方案'}</Text>
                </View>
              </View>
            )
          })
        : null}
      <View
        className='ai-preview'
        onClick={() => {
          Taro.navigateTo({ url: previewPageUrl(plan.id) })
        }}
      >
        <Text className='ai-preview__text'>去预览</Text>
      </View>
    </View>
  )
}
```

把 `src/packagePreview/pages/ai/recommend.scss` 全文换成：

```scss
.page {
  min-height: 100vh;
  padding: 24px 24px 48px;
  background: var(--color-surface);
  box-sizing: border-box;
}

.ai-title {
  display: block;
  font-size: 40px;
  font-weight: 600;
  color: var(--color-text);
}

.ai-status,
.ai-empty,
.ai-missing {
  display: block;
  margin-top: 24px;
  font-size: 28px;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.ai-empty {
  color: var(--color-text);
}

.ai-item {
  margin-top: 24px;
}

.ai-item__reason,
.ai-item__score {
  display: block;
  margin-top: 8px;
  font-size: 24px;
  color: var(--color-text-muted);
}

.ai-item__add,
.ai-preview {
  margin-top: 12px;
  padding: 16px 0;
  background: var(--color-primary);
  border-radius: 12px;
  text-align: center;
}

.ai-item__add--ghost {
  background: var(--color-card);
  border: 1px solid var(--color-border);
}

.ai-item__add-text,
.ai-preview__text {
  color: #ffffff;
  font-size: 28px;
}

.ai-item__add--ghost .ai-item__add-text {
  color: var(--color-text-muted);
}

.ai-preview {
  margin-top: 32px;
}
```

`recommend.config.ts` 保持：

```ts
export default definePageConfig({
  navigationBarTitleText: 'AI 选品',
})
```

- [ ] **Step 4: Run checks**

```bash
pnpm typecheck
python3 - <<'PY'
from pathlib import Path
page = Path('src/packagePreview/pages/ai/recommend.tsx').read_text()
assert 'fetchAiRecommendations' in page
assert 'buildAiRecommendRequest' in page
assert '加入方案' in page
assert 'EMPTY_AI_RECOMMEND_TEXT' in page
assert "from '../../../mocks/aiRecommend'" not in page
assert 'TARO_APP_AI_RECOMMEND_URL' not in page
assert 'openai' not in page.lower()
assert '去预览' in page
print('recommend page OK')
PY
```

Expected: typecheck 退出码 0，打印 `recommend page OK`。

- [ ] **Step 5: Commit**

```bash
git add src/packagePreview/pages/ai/recommend.tsx src/packagePreview/pages/ai/recommend.scss src/packagePreview/pages/ai/recommend.config.ts
git commit -m "feat: replace AI recommend placeholder with mock results page"
```

---

### Task 7: 预览房间尺寸、自动排布与 cube 位姿

**Files:**
- Create: `src/utils/previewLayout.ts`
- Create: `tests/preview-layout.test.ts`

**Interfaces:**
- Consumes: `RoomScan`、`Product.sizeMm`、`fitFloorplanSize`（本任务不调用 fit，留给 2D 组件）
- Produces:
  - `DEFAULT_ROOM_WIDTH_MM = 4000`、`DEFAULT_ROOM_DEPTH_MM = 3000`、`DEFAULT_ROOM_HEIGHT_MM = 2800`
  - `LAYOUT_INSET_MM = 100`、`LAYOUT_GAP_MM = 100`
  - `resolvePreviewRoom(scan)`：`widthMm/depthMm > 0` 用扫描，否则默认矩形；层高缺失时 2800
  - `layoutFurniture(room, products)`：沿长边依次摆放，超出则换行。`widthMm >= depthMm` 时沿 x 再换到 y；否则沿 y 再换到 x。家具占用 `sizeMm.w × sizeMm.d`，不旋转。当前行放不下且不是行首则换行；单件比内径还长也放在行首，避免死循环
  - `moveFurniture` + `clampPlacedFurniture`：拖动结果夹在房间内，不写 storage
  - `mmToMeters`、`furnitureToXrCubes`、`roomFloorScale`：cube 的 scale 为 `(w, h, d)` 米；position 以房间中心为原点，y = h/2

- [ ] **Step 1: Write the failing test**

```ts
// tests/preview-layout.test.ts
import assert from 'node:assert/strict'
import test from 'node:test'
import type { Product } from '../src/types/domain.ts'
import {
  DEFAULT_ROOM_DEPTH_MM,
  DEFAULT_ROOM_HEIGHT_MM,
  DEFAULT_ROOM_WIDTH_MM,
  LAYOUT_GAP_MM,
  LAYOUT_INSET_MM,
  furnitureToXrCubes,
  layoutFurniture,
  mmToMeters,
  moveFurniture,
  resolvePreviewRoom,
  roomFloorScale,
} from '../src/utils/previewLayout.ts'

function product(
  id: string,
  sizeMm: { w: number; d: number; h: number },
): Product {
  return {
    id,
    name: id,
    category: 'other',
    rooms: ['living'],
    style: 'modern',
    priceFen: 1,
    coverUrl: 'https://example.com/x.jpg',
    imageUrls: [],
    sizeMm,
    material: 'x',
    description: 'x',
  }
}

test('resolvePreviewRoom uses scan when positive, otherwise 4000x3000', () => {
  assert.deepEqual(resolvePreviewRoom(null), {
    widthMm: DEFAULT_ROOM_WIDTH_MM,
    depthMm: DEFAULT_ROOM_DEPTH_MM,
    heightMm: DEFAULT_ROOM_HEIGHT_MM,
  })
  assert.equal(DEFAULT_ROOM_WIDTH_MM, 4000)
  assert.equal(DEFAULT_ROOM_DEPTH_MM, 3000)
  assert.equal(DEFAULT_ROOM_HEIGHT_MM, 2800)
  assert.deepEqual(
    resolvePreviewRoom({ widthMm: 5000, depthMm: 3500, heightMm: 2900 }),
    { widthMm: 5000, depthMm: 3500, heightMm: 2900 },
  )
  assert.deepEqual(
    resolvePreviewRoom({ widthMm: 0, depthMm: 3500, heightMm: 2900 }),
    { widthMm: 4000, depthMm: 3000, heightMm: 2800 },
  )
})

test('layoutFurniture places along the long width edge and wraps', () => {
  assert.equal(LAYOUT_INSET_MM, 100)
  assert.equal(LAYOUT_GAP_MM, 100)
  const placed = layoutFurniture(
    { widthMm: 4000, depthMm: 3000 },
    [
      product('sofa', { w: 2200, d: 980, h: 820 }),
      product('table', { w: 1400, d: 800, h: 750 }),
      product('lamp', { w: 500, d: 500, h: 120 }),
    ],
  )
  assert.deepEqual(
    placed.map((item) => [item.productId, item.xMm, item.yMm, item.wMm, item.dMm]),
    [
      ['sofa', 100, 100, 2200, 980],
      ['table', 2400, 100, 1400, 800],
      ['lamp', 100, 1180, 500, 500],
    ],
  )
})

test('layoutFurniture follows depth when it is the long edge', () => {
  const placed = layoutFurniture(
    { widthMm: 2000, depthMm: 4000 },
    [
      product('a', { w: 800, d: 1800, h: 100 }),
      product('b', { w: 800, d: 1800, h: 100 }),
    ],
  )
  assert.deepEqual(
    placed.map((item) => [item.productId, item.xMm, item.yMm]),
    [
      ['a', 100, 100],
      ['b', 100, 2000],
    ],
  )
})

test('moveFurniture clamps inside the room and does not persist', () => {
  const start = layoutFurniture({ widthMm: 4000, depthMm: 3000 }, [
    product('sofa', { w: 2200, d: 980, h: 820 }),
  ])
  const moved = moveFurniture(start, 'sofa', 9000, -40, { widthMm: 4000, depthMm: 3000 })
  assert.equal(moved[0]?.xMm, 1800)
  assert.equal(moved[0]?.yMm, 0)
  assert.deepEqual(start[0]?.xMm, 100)
})

test('furnitureToXrCubes converts mm to meters around room center', () => {
  assert.equal(mmToMeters(2200), 2.2)
  const room = { widthMm: 4000, depthMm: 3000, heightMm: 2800 }
  const placed = [
    {
      productId: 'sofa',
      xMm: 100,
      yMm: 100,
      wMm: 2200,
      dMm: 980,
      hMm: 820,
    },
  ]
  assert.deepEqual(furnitureToXrCubes(room, placed), [
    {
      id: 'sofa',
      position: '-0.8 0.41 -0.91',
      scale: '2.2 0.82 0.98',
    },
  ])
  assert.equal(roomFloorScale(room), '4 1 3')
})
```

cube 坐标核对：房间 4m × 3m，原点在中心。

- x = 0.1 + 2.2/2 - 2 = 1.2 - 2 = -0.8
- y = 0.82/2 = 0.41
- z = 0.1 + 0.98/2 - 1.5 = 0.59 - 1.5 = -0.91

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/preview-layout.test.ts
```

Expected: FAIL（模块不存在）。

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/previewLayout.ts
import type { Product, RoomScan } from '../types/domain'

export const DEFAULT_ROOM_WIDTH_MM = 4000
export const DEFAULT_ROOM_DEPTH_MM = 3000
export const DEFAULT_ROOM_HEIGHT_MM = 2800
export const LAYOUT_INSET_MM = 100
export const LAYOUT_GAP_MM = 100

export type PreviewRoomMm = {
  widthMm: number
  depthMm: number
  heightMm: number
}

export type PlacedFurniture = {
  productId: string
  xMm: number
  yMm: number
  wMm: number
  dMm: number
  hMm: number
}

export type XrCubePose = {
  id: string
  position: string
  scale: string
}

export function resolvePreviewRoom(
  scan?: Pick<RoomScan, 'widthMm' | 'depthMm' | 'heightMm'> | null,
): PreviewRoomMm {
  if (
    scan &&
    Number.isFinite(scan.widthMm) &&
    scan.widthMm > 0 &&
    Number.isFinite(scan.depthMm) &&
    scan.depthMm > 0
  ) {
    return {
      widthMm: scan.widthMm,
      depthMm: scan.depthMm,
      heightMm:
        Number.isFinite(scan.heightMm) && scan.heightMm > 0
          ? scan.heightMm
          : DEFAULT_ROOM_HEIGHT_MM,
    }
  }
  return {
    widthMm: DEFAULT_ROOM_WIDTH_MM,
    depthMm: DEFAULT_ROOM_DEPTH_MM,
    heightMm: DEFAULT_ROOM_HEIGHT_MM,
  }
}

export function layoutFurniture(
  room: Pick<PreviewRoomMm, 'widthMm' | 'depthMm'>,
  products: readonly Product[],
): PlacedFurniture[] {
  const alongWidth = room.widthMm >= room.depthMm
  const innerPrimary = Math.max(0, (alongWidth ? room.widthMm : room.depthMm) - LAYOUT_INSET_MM * 2)
  const result: PlacedFurniture[] = []
  let cursorPrimary = LAYOUT_INSET_MM
  let cursorCross = LAYOUT_INSET_MM
  let rowCross = 0

  for (const product of products) {
    const wMm = product.sizeMm.w
    const dMm = product.sizeMm.d
    const primarySize = alongWidth ? wMm : dMm
    const crossSize = alongWidth ? dMm : wMm
    const wouldOverflow =
      cursorPrimary > LAYOUT_INSET_MM &&
      cursorPrimary + primarySize > LAYOUT_INSET_MM + innerPrimary
    if (wouldOverflow) {
      cursorPrimary = LAYOUT_INSET_MM
      cursorCross += rowCross + LAYOUT_GAP_MM
      rowCross = 0
    }
    result.push({
      productId: product.id,
      xMm: alongWidth ? cursorPrimary : cursorCross,
      yMm: alongWidth ? cursorCross : cursorPrimary,
      wMm,
      dMm,
      hMm: product.sizeMm.h,
    })
    cursorPrimary += primarySize + LAYOUT_GAP_MM
    rowCross = Math.max(rowCross, crossSize)
  }
  return result
}

export function clampPlacedFurniture(
  item: PlacedFurniture,
  room: Pick<PreviewRoomMm, 'widthMm' | 'depthMm'>,
): PlacedFurniture {
  const maxX = Math.max(0, room.widthMm - item.wMm)
  const maxY = Math.max(0, room.depthMm - item.dMm)
  return {
    ...item,
    xMm: Math.min(Math.max(0, item.xMm), maxX),
    yMm: Math.min(Math.max(0, item.yMm), maxY),
  }
}

export function moveFurniture(
  items: readonly PlacedFurniture[],
  productId: string,
  xMm: number,
  yMm: number,
  room: Pick<PreviewRoomMm, 'widthMm' | 'depthMm'>,
): PlacedFurniture[] {
  return items.map((item) =>
    item.productId === productId ? clampPlacedFurniture({ ...item, xMm, yMm }, room) : item,
  )
}

export function mmToMeters(mm: number): number {
  return mm / 1000
}

function fmtMeters(mm: number): string {
  const meters = mmToMeters(mm)
  return String(Math.round(meters * 1000) / 1000)
}

export function furnitureToXrCubes(
  room: PreviewRoomMm,
  placed: readonly PlacedFurniture[],
): XrCubePose[] {
  const roomW = room.widthMm
  const roomD = room.depthMm
  return placed.map((item) => {
    const xMm = item.xMm + item.wMm / 2 - roomW / 2
    const yMm = item.hMm / 2
    const zMm = item.yMm + item.dMm / 2 - roomD / 2
    return {
      id: item.productId,
      position: `${fmtMeters(xMm)} ${fmtMeters(yMm)} ${fmtMeters(zMm)}`,
      scale: `${fmtMeters(item.wMm)} ${fmtMeters(item.hMm)} ${fmtMeters(item.dMm)}`,
    }
  })
}

export function roomFloorScale(room: PreviewRoomMm): string {
  return `${fmtMeters(room.widthMm)} 1 ${fmtMeters(room.depthMm)}`
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/preview-layout.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/previewLayout.ts tests/preview-layout.test.ts
git commit -m "feat: add preview room defaults, wrap layout, and xr cube poses"
```

---

### Task 8: 2D 预览页（默认可拖、不持久化）

**Files:**
- Create: `src/packagePreview/components/preview-2d/index.tsx`
- Create: `src/packagePreview/components/preview-2d/index.scss`
- Modify: `src/packagePreview/pages/preview/index.tsx:1-11`
- Modify: `src/packagePreview/pages/preview/index.scss:1-22`

**Interfaces:**
- Consumes: `selectPlanById`、`selectScanByPlanId`、`resolvePreviewRoom`、`layoutFurniture`、`moveFurniture`、`fitFloorplanSize`
- Produces: 默认渲染 2D。房间矩形来自扫描或 4000×3000。家具按 `sizeMm` 自动排布。触摸拖动只改组件 state；`productIds` / 房间尺寸变化时重置为自动排布。源码不得调用 `writeJSON` / `setStorageSync` 写坐标。无商品时仍画空房间，不崩溃。本任务先不渲染 3D 切换（Task 9 加）。

- [ ] **Step 1: Write the failing test**

```bash
python3 - <<'PY'
from pathlib import Path
page = Path('src/packagePreview/pages/preview/index.tsx').read_text()
assert 'M5 占位页' in page
assert 'PreviewFloor2d' not in page
print('preview still placeholder')
PY
```

Expected: 打印 `preview still placeholder`。

- [ ] **Step 2: Confirm 2D component missing**

```bash
test ! -e src/packagePreview/components/preview-2d/index.tsx && echo 'missing preview-2d'
```

Expected: `missing preview-2d`。

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/packagePreview/components/preview-2d/index.tsx
import { Text, View } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Product } from '../../../types/domain'
import { fitFloorplanSize } from '../../../utils/floorplan'
import {
  layoutFurniture,
  moveFurniture,
  type PlacedFurniture,
  type PreviewRoomMm,
} from '../../../utils/previewLayout'
import './index.scss'

export type PreviewFloor2dProps = {
  room: PreviewRoomMm
  products: readonly Product[]
}

type DragState = {
  productId: string
  startPageX: number
  startPageY: number
  origXMm: number
  origYMm: number
}

export function PreviewFloor2d({ room, products }: PreviewFloor2dProps) {
  const auto = useMemo(() => layoutFurniture(room, products), [room, products])
  const [placed, setPlaced] = useState<PlacedFurniture[]>(auto)
  const dragRef = useRef<DragState | null>(null)
  const box = fitFloorplanSize(room.widthMm, room.depthMm, 670, 480)
  const pxPerMm = box.width > 0 ? box.width / room.widthMm : 0

  useEffect(() => {
    setPlaced(auto)
    dragRef.current = null
  }, [auto])

  if (box.width === 0 || box.height === 0) return null

  const onTouchStart = (productId: string, pageX: number, pageY: number) => {
    const current = placed.find((item) => item.productId === productId)
    if (!current) return
    dragRef.current = {
      productId,
      startPageX: pageX,
      startPageY: pageY,
      origXMm: current.xMm,
      origYMm: current.yMm,
    }
  }

  const onTouchMove = (pageX: number, pageY: number) => {
    const drag = dragRef.current
    if (!drag || pxPerMm <= 0) return
    const xMm = drag.origXMm + (pageX - drag.startPageX) / pxPerMm
    const yMm = drag.origYMm + (pageY - drag.startPageY) / pxPerMm
    setPlaced((current) => moveFurniture(current, drag.productId, xMm, yMm, room))
  }

  return (
    <View className='preview2d'>
      <Text className='preview2d__hint'>
        俯视 {room.widthMm} × {room.depthMm} mm，拖动不保存
      </Text>
      <View
        className='preview2d__room'
        style={{ width: `${box.width}px`, height: `${box.height}px` }}
      >
        {placed.map((item) => (
          <View
            key={item.productId}
            className='preview2d__item'
            style={{
              left: `${item.xMm * pxPerMm}px`,
              top: `${item.yMm * pxPerMm}px`,
              width: `${item.wMm * pxPerMm}px`,
              height: `${item.dMm * pxPerMm}px`,
            }}
            onTouchStart={(event) => {
              const touch = event.touches[0]
              if (!touch) return
              onTouchStart(item.productId, touch.pageX, touch.pageY)
            }}
            onTouchMove={(event) => {
              const touch = event.touches[0]
              if (!touch) return
              onTouchMove(touch.pageX, touch.pageY)
            }}
            onTouchEnd={() => {
              dragRef.current = null
            }}
          >
            <Text className='preview2d__item-label'>
              {products.find((row) => row.id === item.productId)?.name ?? item.productId}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
```

```scss
/* src/packagePreview/components/preview-2d/index.scss */
.preview2d {
  margin-top: 16px;
}

.preview2d__hint {
  display: block;
  margin-bottom: 12px;
  font-size: 24px;
  color: var(--color-text-muted);
}

.preview2d__room {
  position: relative;
  margin: 0 auto;
  background: var(--color-card);
  border: 4px solid var(--color-primary);
  border-radius: 8px;
  box-sizing: border-box;
  overflow: hidden;
}

.preview2d__item {
  position: absolute;
  background: var(--color-progress);
  opacity: 0.85;
  border-radius: 4px;
  box-sizing: border-box;
}

.preview2d__item-label {
  display: block;
  padding: 4px;
  font-size: 20px;
  color: #ffffff;
  overflow: hidden;
}
```

把 `src/packagePreview/pages/preview/index.tsx` 全文换成：

```tsx
import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { PreviewFloor2d } from '../../components/preview-2d'
import { useCatalogStore } from '../../../stores/catalogStore'
import { selectPlanById, usePlanStore } from '../../../stores/planStore'
import { selectScanByPlanId, useScanStore } from '../../../stores/scanStore'
import type { Product } from '../../../types/domain'
import { resolvePreviewRoom } from '../../../utils/previewLayout'
import './index.scss'

export default function PreviewPage() {
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const plan = usePlanStore((state) => selectPlanById(state, planId))
  const scan = useScanStore((state) => selectScanByPlanId(state, planId))
  const products = useCatalogStore((state) => state.products)

  if (!plan) {
    return (
      <View className='page'>
        <Text className='preview-missing'>方案不存在</Text>
      </View>
    )
  }

  const room = resolvePreviewRoom(scan)
  const planProducts: Product[] = plan.productIds
    .map((id) => products.find((item) => item.id === id))
    .filter((item): item is Product => item != null)

  return (
    <View className='page'>
      <Text className='preview-title'>预览</Text>
      <Text className='preview-mode'>当前：2D</Text>
      <PreviewFloor2d room={room} products={planProducts} />
    </View>
  )
}
```

把 `src/packagePreview/pages/preview/index.scss` 全文换成：

```scss
.page {
  min-height: 100vh;
  padding: 24px 24px 48px;
  background: var(--color-surface);
  box-sizing: border-box;
}

.preview-title {
  display: block;
  font-size: 40px;
  font-weight: 600;
  color: var(--color-text);
}

.preview-mode,
.preview-missing {
  display: block;
  margin-top: 12px;
  font-size: 26px;
  color: var(--color-text-muted);
}
```

- [ ] **Step 4: Run checks**

```bash
pnpm typecheck
python3 - <<'PY'
from pathlib import Path
page = Path('src/packagePreview/pages/preview/index.tsx').read_text()
comp = Path('src/packagePreview/components/preview-2d/index.tsx').read_text()
blob = page + '\n' + comp
assert 'PreviewFloor2d' in page
assert 'resolvePreviewRoom' in page
assert '当前：2D' in page
assert 'layoutFurniture' in comp
assert 'moveFurniture' in comp
assert 'writeJSON' not in blob
assert 'setStorageSync' not in blob
assert 'fd:preview' not in blob
assert '.gltf' not in blob
print('2d preview OK')
PY
```

Expected: typecheck 退出码 0，打印 `2d preview OK`。

- [ ] **Step 5: Commit**

```bash
git add src/packagePreview/components/preview-2d src/packagePreview/pages/preview/index.tsx src/packagePreview/pages/preview/index.scss
git commit -m "feat: add default 2D furniture preview with ephemeral drag"
```

---

### Task 9: 轻量 3D（xr-frame cube）与能力降级

**Files:**
- Create: `src/utils/xrCapability.ts`
- Create: `tests/xr-capability.test.ts`
- Create: `src/packagePreview/native/xr-furniture/index.js`
- Create: `src/packagePreview/native/xr-furniture/index.json`
- Create: `src/packagePreview/native/xr-furniture/index.wxml`
- Create: `src/packagePreview/native/xr-furniture/index.wxss`
- Modify: `src/packagePreview/pages/preview/index.tsx`
- Modify: `src/packagePreview/pages/preview/index.config.ts`
- Modify: `src/packagePreview/pages/preview/index.scss`
- Modify: `config/index.ts:25-30`

**Interfaces:**
- Consumes: `compareSdkVersion`（`src/utils/scanCapability.ts`）、`furnitureToXrCubes`、`roomFloorScale`、`XR_FRAME_UNSUPPORTED_TEXT`
- Produces:
  - `MIN_XR_FRAME_SDK_VERSION = '2.32.0'`（设计：xr-frame 基础库 2.32.0 起为稳定正式版）
  - `isXrFrameSupported(sdkVersion)`；读系统信息失败视为不支持
  - 支持时显示「2D / 3D」切换，默认仍是 2D
  - 不支持或 `xr-furniture` `bind:error`：隐藏切换，只留 2D，展示「当前基础库不支持 3D 预览」
  - 原生组件：地面 `geometry="plane"` + 每个商品一个 `geometry="cube"`，**无 glTF / xr-asset-load**
  - `config.copy` 把原生目录拷到 `dist/packagePreview/native/xr-furniture/`
  - 不新增 npm

- [ ] **Step 1: Write the failing test**

```ts
// tests/xr-capability.test.ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isXrFrameSupported,
  MIN_XR_FRAME_SDK_VERSION,
  readXrFrameSupport,
} from '../src/utils/xrCapability.ts'

test('xr-frame requires WeChat SDK 2.32.0', () => {
  assert.equal(MIN_XR_FRAME_SDK_VERSION, '2.32.0')
  assert.equal(isXrFrameSupported('2.31.0'), false)
  assert.equal(isXrFrameSupported('2.32.0'), true)
  assert.equal(isXrFrameSupported('3.0.0'), true)
})

test('readXrFrameSupport treats missing system info as unsupported', () => {
  assert.equal(
    readXrFrameSupport({
      getSdkVersion: () => {
        throw new Error('no sys')
      },
    }),
    false,
  )
  assert.equal(readXrFrameSupport({ getSdkVersion: () => '2.32.0' }), true)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/xr-capability.test.ts
```

Expected: FAIL（模块不存在）。

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/xrCapability.ts
import Taro from '@tarojs/taro'
import { compareSdkVersion } from './scanCapability'

export const MIN_XR_FRAME_SDK_VERSION = '2.32.0'

export type XrCapabilityDeps = {
  getSdkVersion: () => string
}

export function isXrFrameSupported(sdkVersion: string): boolean {
  return compareSdkVersion(sdkVersion, MIN_XR_FRAME_SDK_VERSION) >= 0
}

export function readXrFrameSupport(deps?: XrCapabilityDeps): boolean {
  try {
    const getSdkVersion =
      deps?.getSdkVersion ?? (() => String(Taro.getSystemInfoSync().SDKVersion ?? ''))
    return isXrFrameSupported(getSdkVersion())
  } catch {
    return false
  }
}
```

```json
{
  "component": true,
  "usingComponents": {}
}
```

把上面存为 `src/packagePreview/native/xr-furniture/index.json`。

```js
// src/packagePreview/native/xr-furniture/index.js
Component({
  properties: {
    floorScale: { type: String, value: '4 1 3' },
    cubesJson: { type: String, value: '[]' },
  },
  data: {
    cubes: [],
  },
  observers: {
    cubesJson(value) {
      let cubes = []
      try {
        const parsed = JSON.parse(value || '[]')
        if (Array.isArray(parsed)) cubes = parsed
      } catch (error) {
        cubes = []
      }
      this.setData({ cubes })
    },
  },
  methods: {
    onError() {
      this.triggerEvent('error')
    },
  },
})
```

```xml
<!-- src/packagePreview/native/xr-furniture/index.wxml -->
<xr-scene id="xr-scene" bind:error="onError">
  <xr-node>
    <xr-light type="ambient" color="1 1 1" intensity="1" />
    <xr-light type="directional" rotation="40 50 0" color="1 1 1" intensity="2" />
    <xr-mesh
      node-id="floor"
      geometry="plane"
      scale="{{floorScale}}"
      uniforms="u_baseColorFactor:0.97 0.95 0.93 1"
    />
    <xr-mesh
      wx:for="{{cubes}}"
      wx:key="id"
      node-id="{{item.id}}"
      geometry="cube"
      position="{{item.position}}"
      scale="{{item.scale}}"
      uniforms="u_baseColorFactor:0.77 0.36 0.15 1"
    />
    <xr-camera
      id="camera"
      node-id="camera"
      position="0 2.4 5"
      target="0 0 0"
      clear-color="0.97 0.95 0.93 1"
      camera-orbit
    />
  </xr-node>
</xr-scene>
```

```css
/* src/packagePreview/native/xr-furniture/index.wxss */
#xr-scene {
  width: 100%;
  height: 100%;
  display: block;
}
```

在 `config/index.ts` 的 `copy.patterns` 换成：

```ts
      patterns: [
        {
          from: 'src/packagePreview/native/xr-furniture/',
          to: 'packagePreview/native/xr-furniture/',
        },
      ],
```

把 `src/packagePreview/pages/preview/index.config.ts` 全文换成：

```ts
export default definePageConfig({
  navigationBarTitleText: '预览',
  usingComponents: {
    'xr-furniture': '../../native/xr-furniture/index',
  },
})
```

把 `src/packagePreview/pages/preview/index.tsx` 全文换成：

```tsx
import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { createElement, useMemo, useState } from 'react'
import { PreviewFloor2d } from '../../components/preview-2d'
import { XR_FRAME_UNSUPPORTED_TEXT } from '../../../constants/labels'
import { useCatalogStore } from '../../../stores/catalogStore'
import { selectPlanById, usePlanStore } from '../../../stores/planStore'
import { selectScanByPlanId, useScanStore } from '../../../stores/scanStore'
import type { Product } from '../../../types/domain'
import {
  furnitureToXrCubes,
  layoutFurniture,
  resolvePreviewRoom,
  roomFloorScale,
} from '../../../utils/previewLayout'
import { readXrFrameSupport } from '../../../utils/xrCapability'
import './index.scss'

type PreviewMode = '2d' | '3d'

export default function PreviewPage() {
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const plan = usePlanStore((state) => selectPlanById(state, planId))
  const scan = useScanStore((state) => selectScanByPlanId(state, planId))
  const products = useCatalogStore((state) => state.products)
  const [canUse3d, setCanUse3d] = useState(() => readXrFrameSupport())
  const [mode, setMode] = useState<PreviewMode>('2d')

  const room = resolvePreviewRoom(scan)
  const planProducts: Product[] = useMemo(() => {
    if (!plan) return []
    return plan.productIds
      .map((id) => products.find((item) => item.id === id))
      .filter((item): item is Product => item != null)
  }, [plan, products])
  const cubesJson = JSON.stringify(furnitureToXrCubes(room, layoutFurniture(room, planProducts)))
  const floorScale = roomFloorScale(room)

  if (!plan) {
    return (
      <View className='page'>
        <Text className='preview-missing'>方案不存在</Text>
      </View>
    )
  }

  return (
    <View className='page'>
      <Text className='preview-title'>预览</Text>
      {canUse3d ? (
        <View className='preview-switch'>
          <View
            className={mode === '2d' ? 'preview-switch__btn preview-switch__btn--on' : 'preview-switch__btn'}
            onClick={() => setMode('2d')}
          >
            <Text className='preview-switch__text'>2D</Text>
          </View>
          <View
            className={mode === '3d' ? 'preview-switch__btn preview-switch__btn--on' : 'preview-switch__btn'}
            onClick={() => setMode('3d')}
          >
            <Text className='preview-switch__text'>3D</Text>
          </View>
        </View>
      ) : (
        <Text className='preview-unsupported'>{XR_FRAME_UNSUPPORTED_TEXT}</Text>
      )}
      <Text className='preview-mode'>当前：{mode === '3d' && canUse3d ? '3D' : '2D'}</Text>
      {mode === '3d' && canUse3d
        ? createElement('xr-furniture', {
            className: 'preview-xr',
            floorScale,
            cubesJson,
            onError: () => {
              setCanUse3d(false)
              setMode('2d')
            },
          })
        : <PreviewFloor2d room={room} products={planProducts} />}
    </View>
  )
}
```

在 `src/packagePreview/pages/preview/index.scss` 追加：

```scss
.preview-switch {
  display: flex;
  flex-direction: row;
  margin: 16px 0 0;
}

.preview-switch__btn {
  flex: 1;
  margin-right: 12px;
  padding: 12px 0;
  text-align: center;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.preview-switch__btn:last-child {
  margin-right: 0;
}

.preview-switch__btn--on {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.preview-switch__text {
  font-size: 26px;
  color: var(--color-text);
}

.preview-switch__btn--on .preview-switch__text {
  color: #ffffff;
}

.preview-unsupported {
  display: block;
  margin-top: 16px;
  font-size: 24px;
  color: var(--color-text-muted);
}

.preview-xr {
  display: block;
  width: 100%;
  height: 520px;
  margin-top: 16px;
  background: var(--color-card);
  border-radius: 12px;
  overflow: hidden;
}
```

- [ ] **Step 4: Run tests and source checks**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/xr-capability.test.ts tests/preview-layout.test.ts
pnpm typecheck
python3 - <<'PY'
from pathlib import Path
page = Path('src/packagePreview/pages/preview/index.tsx').read_text()
wxml = Path('src/packagePreview/native/xr-furniture/index.wxml').read_text()
cfg = Path('src/packagePreview/pages/preview/index.config.ts').read_text()
copy = Path('config/index.ts').read_text()
assert 'XR_FRAME_UNSUPPORTED_TEXT' in page
assert "useState<PreviewMode>('2d')" in page or "useState('2d')" in page
assert 'readXrFrameSupport' in page
assert 'xr-furniture' in cfg
assert 'geometry="cube"' in wxml
assert 'geometry="plane"' in wxml
assert 'gltf' not in wxml.lower()
assert 'xr-asset-load' not in wxml
assert 'packagePreview/native/xr-furniture' in copy
pkg = Path('package.json').read_text()
assert 'threejs' not in pkg
assert 'openai' not in pkg
print('3d degrade OK')
PY
```

Expected: 退出码 0，打印 `3d degrade OK`。

- [ ] **Step 5: Commit**

```bash
git add src/utils/xrCapability.ts tests/xr-capability.test.ts src/packagePreview/native src/packagePreview/pages/preview config/index.ts
git commit -m "feat: add optional xr-frame cube preview with capability fallback"
```

---

### Task 10: README、构建与 M5 总验收

**Files:**
- Modify: `README.md:1-66`
- Modify: 无其它业务源码（若失败回到对应任务修）

**Interfaces:**
- Consumes: Task 1–9
- Produces: README 里程碑改为 M5；写清 mock 规则、400ms、空文案、2D 必达、默认 4000×3000、拖动不保存、xr-frame cube、2.32.0 降级、env URL、热更新限制。验收：typecheck、全部单测、`build:weapp`、主包无 glTF / threejs、无模型 Key、分包仍含 AI 与预览页。

- [ ] **Step 1: Replace README**

`README.md` 全文改为：

````markdown
# 家具装修

微信小程序「家具装修」MVP。当前里程碑：**M5 AI 选品 + 2D/轻量 3D 预览**（本地 mock 推荐 / 2D 俯视必达 / xr-frame cube 增强）。

## 环境

- Node.js `>=22.23.4 <23`（推荐 22.23.4）
- pnpm 10.x
- 微信开发者工具（稳定版）
- 预览 3D 需要基础库 `>= 2.32.0`。开发者工具或真机若不支持 xr-frame，页面隐藏 2D/3D 切换并显示「当前基础库不支持 3D 预览」，2D 仍可用。

本机自备 AppID。把真实 `appid` 写在 `project.private.config.json`（已 gitignore），仓库内 `project.config.json` 只保留占位 `touristappid`。

可选：在未跟踪的 `.env` 里设置 `TARO_APP_AI_RECOMMEND_URL` 才会改走 `Taro.request`。不要把模型 Key、Authorization 或真实 URL 写进仓库。未设置时使用 `src/mocks/aiRecommend.ts`。

## 本地运行

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build:weapp
```

AI / 预览在分包 `packagePreview`。**xr-frame 热更新不可用**。请用 `pnpm build:weapp` 后用微信开发者工具打开 `dist/` 预览 3D，不要只靠 `dev:weapp` HMR 判断 cube 场景。

`pnpm dev:weapp` 仍会把 weapp 产物写到 `dist/`。用微信开发者工具「导入项目」：

1. 目录选本仓库根目录。
2. 确认 `project.config.json` 的 `miniprogramRoot` 为 `dist/`（或 `./dist`）。
3. AppID 用测试号或自己的，不要提交审核。
4. 打开模拟器，底部四个 Tab 应为「选品 / 方案 / 预算 / 我的」。
5. 封面使用 `picsum.photos` 占位图：详情里勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」，否则封面可能空白。

生产构建：

```bash
pnpm build:weapp
```

## Zustand + Vite 开发编译

开发配置 `config/dev.ts` 已设置 `mini.debugReact: true`，用于规避 Zustand 5 在 Taro Vite `dev:weapp` 下的 `taro.react_production_min.create is not a function`。修改该配置后必须重新跑 `pnpm dev:weapp`。

## M5 行为

- 方案详情始终显示「AI 选品」「预览」，进入 `/packagePreview/pages/ai/recommend?planId=` 与 `/packagePreview/pages/preview/index?planId=`。
- AI 选品是本地函数，签名 `recommendProducts(req) => Promise<AiRecommendItem[]>`，延迟 400ms。过滤同房间、同风格、未在方案中的商品；按 `abs(priceFen - budgetFen / 5)` 取 3 件，不足则放宽风格。同一 `planId` 连续两次结果一致。
- 方案没有风格字段：用方案内第一件商品的风格，否则 `modern`。`budgetFen` 等于面积预算总额 `round(areaM2 * 80000)`。
- 无候选时列表为空，文案「暂无推荐，请先放宽预算或去选品」。
- 「加入方案」写入该 `planId`（不要求先点「设为当前」），然后重算预算；家具占用随商品 `priceFen` 增加。
- 预览默认 2D。有扫描用 `RoomScan` 长宽，否则房间 4000×3000mm。家具按 `sizeMm` 沿长边自动排布，可拖动，刷新后回到自动排布，坐标不进 `fd:*`。
- 轻量 3D：地面平面 + cube（mm→m，1 单位 = 1m），不加载 glTF。基础库 < 2.32.0 或场景报错则降级 2D。
- 不接真实大模型，不把模型文件打进主包，不引入 threejs。

## M4 行为（仍有效）

- 方案详情且阶段为「量房」时显示「采集房型」。
- VisionKit v2 或手填降级写入 `fd:scans`。扫描结果可被 M5 预览使用。

## 隐私指引（实现期配置，本 MVP 不提审）

在微信公众平台 → 用户隐私保护指引声明（不要把密钥或真实 AppID 写进仓库）：

1. **访问你的摄像头**：用于量房时识别地面并测量长宽。
2. **选中的照片或视频信息**：用于降级路径选择最多 3 张参考图，仅保存在本机，不会上传。

代码在调用相机前走 `requirePrivacyAuthorize` 与 `scope.camera`。未经 Nero 确认不提交审核。

## 约束

- 密钥、云密钥、模型 Key 不进仓库、不在聊天明文粘贴。
- 未经 Nero 确认：不部署、不推生产、不提交小程序审核、不把体验版当正式发布。
- 本仓库只交付 weapp。不涉及支付、不生成订单。
````

- [ ] **Step 2: 单元测试与类型**

```bash
pnpm typecheck
pnpm test
```

Expected: 退出码 0。

- [ ] **Step 3: 文案、越界功能、体积与密钥扫描**

```bash
python3 - <<'PY'
from pathlib import Path
detail = Path('src/pages/plans/detail.tsx').read_text()
assert 'AI 选品' in detail
assert '预览' in detail
assert 'aiRecommendUrl' in detail
assert 'previewPageUrl' in detail
ai = Path('src/packagePreview/pages/ai/recommend.tsx').read_text()
assert 'fetchAiRecommendations' in ai
assert '加入方案' in ai
assert 'EMPTY_AI_RECOMMEND_TEXT' in ai
assert "from '../../../mocks/aiRecommend'" not in ai
preview = Path('src/packagePreview/pages/preview/index.tsx').read_text()
assert 'PreviewFloor2d' in preview
assert 'XR_FRAME_UNSUPPORTED_TEXT' in preview
wxml = Path('src/packagePreview/native/xr-furniture/index.wxml').read_text()
assert 'geometry="cube"' in wxml
assert 'gltf' not in wxml.lower()
mock = Path('src/mocks/aiRecommend.ts').read_text()
assert '400' in mock
assert 'Math.random' not in mock
pkg = Path('package.json').read_text()
assert 'threejs' not in pkg
assert '"openai"' not in pkg
domain = Path('src/types/domain.ts').read_text()
assert 'AiRecommend' not in domain
blob = '\n'.join(path.read_text() for path in Path('src').rglob('*') if path.suffix in {'.ts', '.tsx', '.js', '.wxml'})
assert 'Taro.uploadFile' not in blob
assert '.gltf' not in blob.lower()
assert '.glb' not in blob.lower()
assert 'threejs-miniprogram' not in blob
assert 'sk-' not in blob
print('copy and exclusions OK')
PY
python3 - <<'PY'
from pathlib import Path
root = Path('.')
needles = ['AppSecret', 'appsecret', 'AKID', 'BEGIN RSA PRIVATE KEY']
skip = {'.git', 'node_modules', 'dist'}
hits = []
for path in root.rglob('*'):
    if any(part in skip for part in path.parts):
        continue
    if path.is_dir() or path.suffix in {'.png', '.jpg', '.jpeg', '.webp', '.gz', '.tgz'}:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except Exception:
        continue
    for needle in needles:
        if needle in text:
            hits.append((str(path), needle))
assert not hits, hits
import json
cfg = json.loads(Path('project.config.json').read_text())
assert cfg.get('appid') in {'touristappid', ''}, cfg.get('appid')
print('secret scan OK', cfg.get('appid'))
PY
```

Expected: 打印 `copy and exclusions OK` 与 `secret scan OK touristappid`。

- [ ] **Step 4: weapp 构建、分包与主包体积**

```bash
pnpm build:weapp
python3 - <<'PY'
import json
from pathlib import Path
app = json.loads(Path('dist/app.json').read_text())
assert app['pages'] == [
    'pages/catalog/index',
    'pages/plans/index',
    'pages/budget/index',
    'pages/mine/index',
    'pages/catalog/detail',
    'pages/plans/detail',
], app['pages']
texts = [item['text'] for item in app['tabBar']['list']]
assert texts == ['选品', '方案', '预算', '我的'], texts
assert len(app['tabBar']['list']) == 4
roots = [item['root'] for item in app['subPackages']]
assert 'packageScan' in roots
assert 'packagePreview' in roots
preview = next(item for item in app['subPackages'] if item['root'] == 'packagePreview')
assert preview['pages'] == ['pages/ai/recommend', 'pages/preview/index']
skip = {'packageScan', 'packagePreview'}
total = 0
for path in Path('dist').rglob('*'):
    if not path.is_file():
        continue
    if any(part in skip for part in path.parts):
        continue
    total += path.stat().st_size
print('main package bytes', total)
assert total < 2 * 1024 * 1024, total
assert Path('dist/packagePreview').exists()
assert Path('dist/packagePreview/native/xr-furniture/index.wxml').exists()
gltfs = list(Path('dist').rglob('*.gltf')) + list(Path('dist').rglob('*.glb'))
assert gltfs == [], gltfs
print('weapp M5 app.json OK')
PY
```

Expected: 退出码 0；打印 `weapp M5 app.json OK`。`dist/` 不要 git add。

- [ ] **Step 5: 模拟器手工验收（对照规格）**

用微信开发者工具打开 `dist/`（勾选不校验合法域名）：

1. 新建 20㎡ 客厅方案。详情可见「AI 选品」「预览」。连续两次进入 AI：列表相同，前三件为林屿布艺沙发 / 岩板餐桌 / 圆环吸顶灯，reason 含「20㎡ 客厅」。
2. 点沙发「加入方案」，回预算 Tab，家具占用变为 ¥2999；再进预览，2D 出现对应矩形。
3. 阳台方案、风格走默认 modern、且已手动把 `p-other-chinese-13` 加入后进 AI：显示「暂无推荐，请先放宽预算或去选品」。
4. 无扫描时预览房间文案含 `4000 × 3000`；有手填扫描时跟扫描长宽。拖动家具后离开再进预览，矩形回到自动排布。
5. 基础库 ≥ 2.32.0 时出现 2D/3D 切换；切 3D 为 cube，无模型加载失败。不支持则无切换按钮，有「当前基础库不支持 3D 预览」，2D 仍可操作、不崩溃。
6. 确认无支付、无真大模型请求（未设 env URL 时）、Tab 仍是四个、未提审。

- [ ] **Step 6: Commit README**

```bash
git add README.md
git commit -m "docs: mark milestone M5 AI recommend and preview"
```

若 working tree 还有验收修复：

```bash
git add -u
git commit -m "fix: close M5 AI preview acceptance gaps"
```

永远不要提交 `dist/`、`node_modules/`、`.env`、`project.private.config.json`。

---

## Self-review

1. **Spec coverage（仅 M5）**
   - 本地 `recommendProducts(req): Promise<AiRecommendItem[]>`，延迟 400ms → Task 2
   - 过滤同 `roomType` / 同 `style` / 不在 `existingProductIds`；按 `abs(priceFen - budgetFen / 5)` 取 3；不足放宽风格；score 1 / 0.8 / 0.6；reason 模板用房间中文 → Task 2
   - 空数组 UI「暂无推荐，请先放宽预算或去选品」→ Task 1、6
   - 同一 `planId` 连续两次列表稳定 → Task 2、10
   - 入口：方案详情「AI 选品」→ `packagePreview/pages/ai/recommend` → Task 4、6
   - 一键加入方案后预算家具占用变，预览 2D 出现矩形 → Task 5、6、8、10
   - 预览默认 2D；房间用 RoomScan 或 4000×3000mm；按 `sizeMm` 沿长边自动排布；可拖不持久化 → Task 7、8
   - 轻量 3D：xr-frame 地面 + cube，mm→m，1 单位 = 1m；无 glTF → Task 7、9
   - 无 xr-frame 隐藏切换并注明「当前基础库不支持 3D 预览」→ Task 1、9
   - mock 可换成 `Taro.request`（URL 来自环境变量，不写密钥）→ Task 3
   - 不接真大模型、不打 glTF、不提审、主包不因 3D 超 2MB → Task 9、10
   - 不改 `domain.ts` 已有类型；AiRecommend* 新文件 → Task 1、Global Constraints

2. **Placeholder scan:** 无 TBD / TODO / 「类似 Task N」。文案、400ms、默认房间、inset/gap、SDK 2.32.0、env 名、按钮、测试命令均写死。

3. **Type consistency:** `AiRecommendRequest` / `AiRecommendItem` 只定义在 `src/types/aiRecommend.ts`。`addProductToPlan`、`fetchAiRecommendations`、`selectRecommendItems`、`resolvePreviewRoom`、`layoutFurniture`、`furnitureToXrCubes`、`aiRecommendUrl`、`previewPageUrl`、`EMPTY_AI_RECOMMEND_TEXT`、`XR_FRAME_UNSUPPORTED_TEXT` 在后续任务中的名字与 Task 1–7 一致。`AddProductResult` 仍为 `'added' | 'duplicate' | 'no-active-plan'`。

**与 design 的偏差（实现时按本计划锁死，供 Nero 审）：**

| 项 | 设计 | 本计划 |
| --- | --- | --- |
| `AiRecommend*` 类型位置 | 写在领域模型同一代码块 | 新文件 `src/types/aiRecommend.ts`，**不改** `domain.ts` 里已有 RoomScan/Plan/Product/Budget |
| 方案 `style` | `AiRecommendRequest.style` 必填，但 `Plan` 无风格字段 | 用方案内第一件商品的 `style`，否则 `modern` |
| `budgetFen` 来源 | 请求字段，未说从哪来 | `computeTotalFen(areaM2)`，与 M3 总额一致 |
| 价格并列 | 未规定 | `id` 升序，保证可复现 |
| 预览层高 | 只给了 4000×3000 矩形 | 无扫描时 3D 层高用 M4 默认 2800mm |
| 加入哪条方案 | 「当前方案」 | 写入 query 的 `planId`，不强制 `setActivePlanId` |
| 3D 能力阈值 | 「无 xr-frame 能力」 | SDKVersion ≥ 2.32.0；场景 error 同样降级 |
| 3D 失败 | 不挡里程碑 | 2D 必达；3D 为增强，降级文案必须出现 |
