# 家装小程序 MVP 设计说明

日期：2026-11-03  
仓库：https://github.com/CoderSxy/furniture-decoration  
默认分支：`main`  
文档范围：仅设计。本文件获用户确认后，再写实现计划并启动 M0 脚手架。禁止在确认前创建 `package.json`、Taro 工程或业务代码。

## 背景与目标

做一款微信小程序「家具装修」，面向正在或即将装修的个人用户，把选品、方案、预算串成一条可演示的本地链路，并为房型扫描、AI 选品、3D 预览留下可验证的接入点。

MVP 要证明的产品闭环：

1. 用户能浏览家具、筛选、看详情、收藏。
2. 用户能建一条装修方案，按「量房 → 设计 → 施工 → 验收」推进。
3. 用户能看到这笔方案的成本总额、类目占用和阶段进度。
4. 用户能从方案进入房型/空间采集（真机 POC 或明确降级）。
5. 用户能拿到一份 mock 的 AI 选品建议，并在 2D / 轻量 3D 里预览已选家具。

本仓库当前只有空 `README.md`。实现阶段以本设计为唯一产品/技术依据。

## 技术栈（已确认）

| 层 | 选择 | 约束 |
| --- | --- | --- |
| 客户端 | Taro 4 + React + TypeScript + Vite | 实现时钉当时最新的 Taro 4 稳定线（撰写时 npm 上 `@tarojs/cli` 为 4.3.2）；React 走 Taro 4 官方模板的 18.x，不升 React 19。 |
| 状态 | Zustand | 业务 store 用 `create`；需要跨端持久化时用自定义 `storage` 包一层 `Taro.setStorageSync` / `getStorageSync`，不用浏览器 `localStorage`。Vite + Zustand 5 在 `dev:weapp` 下已知会触发 `taro.react_production_min.create is not a function`，M0 在 `config/dev.ts` 设 `mini.debugReact: true` 作为开发期规避，并写进 README。 |
| 运行时 | Node.js 22 | `package.json` 的 `engines.node` 锁定到实现当天无已知高危漏洞的 22.x patch；**本文不钉具体 patch 号**。包管理器用 pnpm。 |
| 目标端 | 微信小程序（`weapp`） | 本 MVP **只交付 weapp**。不并行维护 H5 / 支付宝 / 其他端。 |
| 3D / AR | 微信官方 `xr-frame` + VisionKit | 运行时内置，不进主包 npm。Taro 侧用「页面内嵌微信原生组件」接入，POC 以打包预览为准（热更新不可用视为已知限制）。 |
| 数据 | 本地 mock JSON + Zustand | M0–M5 不接真实后端、不接微信云开发、不接支付。 |

全局硬约束：

- 密钥、AppID 真值、云密钥、模型 Key **不进仓库、不在聊天里明文粘贴**。`project.config.json` 使用占位 `appid`；本地用未跟踪的覆盖文件（例如 `project.private.config.json`，已列入 `.gitignore`）。
- **未经 Nero 确认**：不部署、不推生产、不提交小程序审核、不把体验版当正式发布。
- 源代码与文案使用简体中文 UI；代码标识符用英文。

## 切法

采用「**A · 产品链路优先**」。

先把用户能点的主路径做通，再把高风险的扫描 / AI / 3D 做成独立分包 POC。不先铺完整 3D 引擎或服务端重建。

顺序锁定为：

```
M0 脚手架（四 Tab 壳）
 → M1 选品（列表 / 筛选 / 详情 / 收藏）
 → M2 方案（四阶段 + 方案卡片）
 → M3 预算（总额 / 类目 / 阶段进度，与收藏、方案粗联动）
 → M4 扫描选型调研 + 最小 POC
 → M5 AI 选品 mock + 2D/轻量 3D 预览
```

每一里程碑必须单独可演示、可验收。后一里程碑只依赖前一里程碑已经冻结的数据形状，不回头改 Tab 信息架构。

## 信息架构

底部四个 Tab，且 **只有这四个** 出现在 `tabBar`。扫描、AI、3D 预览都是二级页，放独立分包，避免撑爆 2MB 主包。

| Tab | 路径 | 职责 | 后续扩展点（不进 tabBar） |
| --- | --- | --- | --- |
| 选品 | `pages/catalog/index` | 家具列表、筛选条、进入详情。默认着陆页。 | `pages/catalog/detail` 商品详情；详情内「加入方案」「收藏」。 |
| 方案 | `pages/plans/index` | 方案卡片列表、新建方案、当前阶段。 | `pages/plans/detail` 阶段时间轴；入口到扫描（M4）、AI 选品与预览（M5）。 |
| 预算 | `pages/budget/index` | 当前方案的总额、类目占用条、阶段进度条。无方案时空态引导去「方案」。 | 类目拆解下钻（MVP 用当前页折叠区，不另开 Tab）。 |
| 我的 | `pages/mine/index` | 收藏列表、本地数据说明、开发期「重置 mock」按钮。 | 设置、隐私说明入口。不做登录、不做手机号。 |

页面与分包约定：

```
主包（Tab + 公共样式 / store）
  pages/catalog/index
  pages/plans/index
  pages/budget/index
  pages/mine/index
  pages/catalog/detail      # 详情短，可留主包；若体积超标再挪分包
  pages/plans/detail

分包 packageScan（M4，按需下载）
  pages/scan/index          # VisionKit 测量或降级表单

分包 packagePreview（M5，按需下载）
  pages/ai/recommend        # AI 选品结果
  pages/preview/index       # 2D 平面预览；同页可切到轻量 3D
```

导航约定：Tab 用 `Taro.switchTab`；二级页用 `Taro.navigateTo`，参数只传 id（`productId` / `planId`），不把整对象塞进 query。返回用系统返回或 `Taro.navigateBack`。

主题约定：仅浅色。在 `src/theme/tokens.ts` 定义色板与间距，`src/app.scss` 以 CSS 变量落地。主色用于 Tab 选中、主按钮、进度条；中性色用于卡片与文字。M0 即建立，后续里程碑不得各写一套颜色魔法值。

## 领域模型

所有金额用整数 **分**（`priceFen`），面积用数字平方米，尺寸用毫米。日期用 ISO 8601 字符串。

```ts
type RoomType = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'study' | 'balcony'
type StyleTag = 'modern' | 'nordic' | 'chinese' | 'lightLuxury'
type ProductCategory = 'sofa' | 'bed' | 'table' | 'cabinet' | 'chair' | 'light' | 'other'
type PlanStage = 'measure' | 'design' | 'construct' | 'accept'
type BudgetCategory = 'furniture' | 'material' | 'labor' | 'other'

interface Product {
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

interface FavoriteRecord {
  productId: string
  savedAt: string
}

interface Plan {
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

interface RoomScan {
  planId: string
  source: 'visionkit-v2' | 'manual'
  widthMm: number
  depthMm: number
  heightMm: number
  photoPaths: string[]   // 本地临时路径或占位 URL，M4 POC 默认不上云
  capturedAt: string
}

interface Budget {
  planId: string
  totalFen: number
  spentByCategory: Record<BudgetCategory, number>
}

interface AiRecommendRequest {
  planId: string
  roomType: RoomType
  areaM2: number
  style: StyleTag
  budgetFen: number
  existingProductIds: string[]
}

interface AiRecommendItem {
  productId: string
  score: number          // 0–1
  reason: string         // 中文短句，直接展示
}
```

Zustand 模块切分（M0 建空壳，后续往里填，不另起一套）：

| Store | 持久化 | 内容 |
| --- | --- | --- |
| `catalogStore` | 否（读 mock） | 商品列表、筛选条件 |
| `favoriteStore` | 是，key `fd:favorites` | 收藏 id 列表 |
| `planStore` | 是，key `fd:plans` | 方案列表、当前 `activePlanId` |
| `budgetStore` | 是，key `fd:budgets` | 按 `planId` 索引的预算 |
| `scanStore` | 是，key `fd:scans` | 每方案至多一条 `RoomScan` |
| `uiStore` | 否 | 筛选面板开关等短时 UI 状态 |

mock 数据放 `src/mocks/`，图片用稳定的占位图 URL 或 `src/assets` 内极小内置图；**不把 glTF 打进主包**。

## 里程碑

### M0 工程底座

交付：

- 用 Taro 4 官方模板初始化 weapp + React + TypeScript + Vite，目标端只留 `weapp`。
- `package.json`：`engines.node` 钉 22.x 的安全 patch；脚本至少有 `dev:weapp`、`build:weapp`。
- 四个 Tab 页面可切换，各页有标题与一句职责说明，无业务逻辑。
- 六个空 store 文件 + `src/theme/tokens.ts` + `app.config.ts` 路由与分包骨架（`packageScan` / `packagePreview` 可先放占位页，避免 M4/M5 再改主包配置）。
- README 写清：Node 版本、pnpm 安装、`pnpm dev:weapp`、用微信开发者工具打开 `dist`（或模板指定的输出目录）、需要自备 AppID、`debugReact` 说明、以及「未经 Nero 确认不提审」。
- `.gitignore` 覆盖 `node_modules`、`dist`、`.env`、私钥、`project.private.config.json`。
- 仓库内不出现真实密钥。

验收标准：

1. 干净环境安装依赖后，`pnpm dev:weapp` 能编译出可被微信开发者工具打开的产物。
2. 模拟器中四个 Tab 都能点到，页面标题分别为「选品 / 方案 / 预算 / 我的」。
3. TypeScript 能通过（`pnpm` 增加 `typecheck` 或等价脚本）。
4. 全文检索无 AppSecret、云密钥、API Key。
5. 不提交审核、不部署。

### M1 家具选品

交付：

- 列表：卡片含封面、名称、品类、风格、价格（元，由分换算，保留到元即可）。
- 筛选：品类、适用房间、风格、价格区间（四个区间：1 千以下 / 1–3 千 / 3–8 千 / 8 千以上）。筛选在客户端对 mock 数组执行，可组合。
- 详情：图、尺寸（mm）、材质、描述、价格、收藏按钮。M1 **不**做「加入方案」（该按钮在 M2 出现）。
- 收藏：点一次写入 `favoriteStore`（`FavoriteRecord[]`），再点取消；进程被杀后仍在。
- 价格展示：`Math.round(priceFen / 100)` 元，不显示「分」。
- mock：不少于 12 件商品，覆盖全部品类与至少 3 种风格、3 种房间。枚举到中文的对照固定为：

| 枚举 | 中文 |
| --- | --- |
| living / bedroom / kitchen / bathroom / study / balcony | 客厅 / 卧室 / 厨房 / 卫生间 / 书房 / 阳台 |
| modern / nordic / chinese / lightLuxury | 现代 / 北欧 / 中式 / 轻奢 |
| sofa / bed / table / cabinet / chair / light / other | 沙发 / 床 / 桌几 / 柜类 / 椅凳 / 灯具 / 其他 |

验收标准：

1. 组合筛选后列表只含同时满足条件的商品；清空筛选恢复全量。
2. 详情与列表是同一 `id`，价格一致。
3. 收藏后切到「我的」能看到；杀掉编译进程重进小程序，收藏仍在。
4. 无后端、无登录。

### M2 装修方案流程

阶段枚举与展示文案固定为：

| `PlanStage` | UI 文案 | 含义（MVP） |
| --- | --- | --- |
| `measure` | 量房 | 默认新建状态；M4 扫描结果挂在这一阶段。 |
| `design` | 设计 | 已有至少 1 件商品加入方案。 |
| `construct` | 施工 | 用户在详情里手动推进。 |
| `accept` | 验收 | 终态；不可再往回退（MVP 简化，避免状态机分叉）。 |

交付：

- 「方案」Tab：卡片展示标题、房间、面积、当前阶段、封面（取 `coverProductId` 或首件商品）。当前方案卡片有「当前」标记。空态有「新建方案」。
- 新建：标题、房间、面积（必填，面积 > 0）。新建后 `stage = measure`，并设为 `activePlanId`。
- 切换当前方案：列表卡片上的「设为当前」；点卡片进入详情，不自动切换。
- 详情：四阶段时间轴；已加入的商品列表（可移除）；「推进到下一阶段」按钮。从 `measure` 进 `design` 的前提是 `productIds.length >= 1`，否则按钮禁用并提示先去选品。
- 选品详情此时出现「加入当前方案」：无 `activePlanId` 时按钮改为「请先新建方案」并 `switchTab` 到方案页；有则把 `productId` 追加到当前方案（去重）。

验收标准：

1. 能新建至少两条方案，并用「设为当前」切换 `activePlanId`；列表标记与 `planStore.activePlanId` 一致。
2. 无商品时不能从量房推进到设计。
3. 阶段只能前进，不能跳级（量房不可直接到施工）。
4. 刷新小程序后方案列表、当前方案与阶段仍在。

### M3 成本预算进度条

预算与方案 **一对一**。新建方案时按面积生成初始预算，不手填总额：

- `totalFen = round(areaM2 * 80000)`，即按 800 元/㎡ 的演示单价。
- 初始占用：`furniture` 来自方案内商品 `priceFen` 之和（含收藏后加入方案的商品；**未加入方案的收藏不计入**）。
- `material = round(totalFen * 0.35)`，`labor = round(totalFen * 0.25)`，`other = max(0, totalFen - furniture - material - labor)`。家具真实合计允许超过总额：此时该类目条满格，总额旁显示「已超支」。
- 阶段进度 **不入库**，由当前方案 `stage` 推导：`measure|design|construct|accept` → 15 / 40 / 75 / 100。当前阶段及之前的节点点亮。

交付：

- 预算页：总额、四类目占用条（百分比按 `spent / total` 封顶 100% 显示，超支用警示色）、阶段进度条。
- 与收藏的粗联动：文案「收藏中有 N 件尚未加入当前方案」（按 `favoriteStore` 与当前 `productIds` 差集计数），点击跳转「我的」。N=0 时不显示。
- 无 `activePlanId` 时的空态。
- 方案增删商品后，家具占用立即变。
- 「我的」的「重置 mock」清除收藏、方案、预算、扫描四类持久化 key，商品 mock 不受影响。

验收标准：

1. 同一方案在「方案详情」改商品，回到预算页，家具占用变化，无需手动刷新（切 Tab 即读 store）。
2. 切换方案，预算跟着变。
3. 超支时有明确文案，不出现 NaN 或负数百分比。
4. 当前方案未包含的收藏件数 N>0 时出现提示；全部加入后提示消失。
5. 不涉及支付、不生成订单。

### M4 房型 / 空间扫描选型

M4 分两步：**先对比、再 POC**。对比结论写进 `docs/superpowers/specs/2026-11-03-room-scan-comparison.md`（实现 M4 时新增，不在本次提交）。POC 必须可在真机或开发者工具给出「能跑」或「不可行」的明确结论。

#### 调研范围（近 1–2 年可落地对象）

| 候选 | 许可证 | 维护度 | 包体 / 运行位置 | 小程序原生能力 | 隐私合规 |
| --- | --- | --- | --- | --- | --- |
| **微信 VisionKit v2 + xr-frame** | 平台能力，随微信客户端分发 | 官方文档持续更新；xr-frame 基础库 2.32.0 起标为稳定正式版 | **0 npm 体积**（运行时内置） | `wx.createVKSession({ version: 'v2', track: { plane: { mode: 3 } } })` 提供平面识别与真实物理距离；`hitTest` 取点。iOS 基础库 2.22.0、安卓 2.25.1 起支持 v2；**安卓 v2 不支持竖直平面**。需 `scope.camera`。 | 必须在用户隐私保护指引声明「访问你的摄像头」；调用前走 `requirePrivacyAuthorize`。POC **默认测量结果只存本地 store，照片不上云**。 |
| **threejs-miniprogram** | MIT | 停更于 2021-04（Three r108），npm 0.0.8 | 解压约 580KB，易挤压主包 | 只能 WebGL 展示，**不能扫房间** | 不涉及摄像头，但解决不了扫描问题 |
| **DUSt3R / MASt3R**（Naver，2024） | **CC BY-NC-SA 4.0**（代码与权重均非商用） | 研究活跃 | GPU 服务端，模型数百 MB，无法进小程序 | 多视图点图重建，与 weapp 无原生桥 | 房间照片必须出端；非商用许可直接否决商用产品 |
| **Depth Anything V2 Small** | Small 权重 Apache-2.0；Base/Large/Giant 为 CC BY-NC 4.0 | 2024 活跃 | 服务端推理 | 单目深度，**不是户型矢量** | 需上传图片 |
| **VGGT / MapAnything 等 2025 前馈重建** | 代码与默认真权重普遍拆成「代码可商用 / 权重 CC BY-NC」 | 论文级，迭代快 | 服务端 1B 级模型 | 无小程序运行时 | 同照片出端问题；商用必须另购/另训权重 |
| **Roomform**（2026） | 代码 Apache-2.0；部分权重 CC BY-NC | 新仓库 | 服务端，输入是已配准点云而非手机视频 | 不能替代手机扫描 | 点云/照片出端 |
| **COLMAP / GLOMAP** | BSD | 长期维护 | 服务端 SfM，多图 + 算力 | 与小程序无直接关系 | 照片出端 |

明确排除：任何 CC BY-NC / CC BY-NC-SA 权重进入本仓库或本产品的默认路径；任何把重建模型打进小程序包的做法。

#### 推荐（取舍已定）

1. **主方案（POC 必须做）**：VisionKit v2 水平面测量。用户在地面先后点两对点：第一对距离 → `widthMm`，第二对距离 → `depthMm`（每次用 `hitTest` 取平面坐标再算欧氏距离，单位米转毫米）。层高用手填，默认 2800mm。结果写入 `RoomScan.source = 'visionkit-v2'`，方案详情展示简易矩形平面图。3D 家具放置留到 M5，本里程碑只产出尺寸。
2. **降级方案（POC 必须同时做）**：机型不支持 v2、用户拒摄像头、或安卓竖直平面需求出现时，改为手填长宽高 + 最多 3 张相册参考图（`wx.chooseMedia`），`source = 'manual'`。参考图只存本地临时路径，**不上传**。

Taro 接入方式固定为：扫描页使用微信原生 `xr-frame` / `camera` 组件（Taro 官方尚未把 xr-frame 当一等组件；社区结论是原生组件 + 打包预览）。不引入 `threejs-miniprogram` 做扫描。

#### M4 最小 POC 行为

- 入口：方案详情、阶段为量房时显示「采集房型」。
- 先检测能力：读取 `Taro.getSystemInfoSync().SDKVersion`，低于 2.22.0 直接降级；否则尝试 `wx.createVKSession({ version: 'v2', track: { plane: { mode: 1 } } })`（POC 只测水平面，避开安卓无竖直平面的限制），`start` 回调带错则销毁会话并降级。不白屏。
- 支持则申请隐私 + `scope.camera`；拒绝则降级。
- 成功后回写 `scanStore`，方案详情显示长×宽×高。

验收标准：

1. 对比文档覆盖上表全部候选，写明许可证与「为何不进小程序包」。
2. 真机或开发者工具上，主方案或降级方案至少一条路径能产出 `RoomScan` 并在方案详情可见。
3. 若主方案在目标机型上不可行：对比文档用「不可行」结论写清机型 / 基础库 / 错误信息，降级路径仍须可跑。
4. 扫描分包单独加载；主包体积不因 POC 超过 2MB。
5. 无照片、无点云上传到第三方。

### M5 AI 选品 + 3D 预览

AI 与 3D 都先 **接口/场景约定 + mock**，不接真实大模型、不接商用 3D 资产库。

#### AI 选品（先 mock）

本地函数 `recommendProducts(req: AiRecommendRequest): Promise<AiRecommendItem[]>`，签名即未来 HTTP 契约。实现放 `src/mocks/aiRecommend.ts`，延迟 400ms 模拟网络。

规则（可复现，禁止随机到无法验收）：

1. 过滤：同 `roomType`、同 `style`、未在 `existingProductIds` 中。
2. 按 `abs(product.priceFen - budgetFen / 5)` 升序，取 3 件；不足 3 件则放宽风格再取。
3. `reason` 用模板：「与当前方案风格一致，尺寸适合 {areaM2}㎡ {房间中文名}」（房间用上表中文，不展示枚举值）。`score` 按排序名次记 1.0 / 0.8 / 0.6。
4. 失败（无候选）返回空数组，UI 显示「暂无推荐，请先放宽预算或去选品」。

入口：方案详情「AI 选品」。结果页可一键加入当前方案。

#### 预览（先 2D，再轻量 3D）

同一 `pages/preview/index`，默认 2D，可切换 3D。数据源：当前方案 `productIds` + 可选 `RoomScan`（无扫描时用 4000×3000mm 默认矩形）。

- **2D**：俯视矩形房间 + 按 `sizeMm` 缩放的家具矩形，可拖动但 **不持久化坐标**（刷新回到自动排布）。自动排布：沿长边依次摆放，超出则换行。这是 M5 的必达项。
- **轻量 3D**：`xr-frame` 场景，地面平面 + 每个商品一个 cube（按 mm→m 缩放，1 单位 = 1m），相机轨道。**不加载真实 glTF 家具**。无 xr-frame 能力时隐藏切换按钮，只留 2D。这是 M5 的增强项，失败不挡里程碑关闭，但须在页面注明「当前基础库不支持 3D 预览」。

验收标准：

1. 对同一 `planId` 连续点两次 AI，推荐列表稳定一致。
2. 把推荐加入方案后，预算家具占用增加，预览 2D 出现对应矩形。
3. 2D 预览在开发者工具可操作；3D 在不支持时有明确降级，不崩溃。
4. mock 模块可在不改 UI 的情况下替换为真实 `Taro.request`（URL 来自环境变量，不写死密钥）。
5. 不提交审核、不把模型文件打进主包。

## 非目标（本 MVP 不做）

- 真实支付、订单、优惠券、电商 SKU 库存同步。
- 提交微信小程序审核、发布正式版 / 体验版当生产、任何云托管或自建生产部署。
- 用户登录、手机号、微信开放数据、客服消息。
- 完整 BIM / CAD / 施工图出图、水电结构层、建材清单 ERP。
- 多端（H5、App、其他小程序平台）和多语言。
- 真实大模型调用、商用 3D 家具资产库、云端照片重建（DUSt3R 等）。
- 把 CC BY-NC 模型权重或密钥放进仓库。
- 设计师协作、IM、实时共建。
- 深色主题、复杂设计系统、自定义 Tab 动画。
- 后台管理端。

## 风险与依赖

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 主包 / 单分包 2MB，全包 30MB | 3D 库或大图直接导致无法预览 | Tab 进主包；扫描与预览进分包；图片与模型走远程 URL；禁止 threejs-miniprogram 进主包。 |
| VisionKit v2 机型覆盖有限；安卓无竖直平面 | 扫描主路径失败 | M4 强制做手填降级；验收允许「主路径不可行 + 降级可跑」。 |
| Taro 对 xr-frame 无一等支持，热更新差 | M4/M5 调试成本高 | 原生组件 + `build:weapp` 预览；扫描/预览隔离在分包，失败不拖垮 M1–M3。 |
| 摄像头 / 相册属隐私接口 | 未声明则无法调用，提审会被拒 | 实现期在 `app.json` 声明用途；代码里先 `requirePrivacyAuthorize`。本 MVP 不提审，但 POC 按合规路径写，避免以后返工。 |
| Zustand 5 + Taro Vite 开发编译问题 | M0 可能卡住 | M0 即写入 `mini.debugReact: true`；若仍失败，降 Zustand 到 4.x 并在实现计划里记录，不改技术栈大类。 |
| AI / 3D 成本与可用性 | 真模型与 GPU 重建超出 MVP | 全程 mock + 几何体预览。任何付费 API 或云 GPU 必须 Nero 事先确认。 |
| 包体与性能在低端安卓上卡顿 | 预览不可用 | 2D 为必达；3D 失败即降级。 |

外部依赖：微信开发者工具、测试用 AppID（本地私有配置）、真机（M4 建议至少 1 台 iOS + 1 台安卓）。没有真机时 M4 只验收降级表单 + 对比文档，并在对比文档标明「缺真机，VisionKit 主路径未测」。

## 下一步

请审阅本设计。确认后（可直接改本文件或在 PR 评论指出修改点），再另开文档撰写实现计划（`docs/superpowers/plans/`），并按计划启动 **M0 脚手架**。在此之前不创建应用代码。
