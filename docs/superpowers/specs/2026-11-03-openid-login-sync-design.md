# OpenID 登录与全量本地数据云同步

日期：2026-11-03  
仓库：https://github.com/CoderSxy/furniture-decoration  
默认分支：`main`  
对照规格：`docs/superpowers/specs/2026-11-03-furniture-decoration-mvp-design.md`（M0–M5 本地闭环已落地）  
提审清单：`docs/weapp-publish-checklist.md`（当前仍写「不登录 / 默认不联网」；**实现 PR 必须改清单与「我的」隐私文案，本设计 PR 不重写清单正文**）  
文档范围：仅设计。本文件获确认后再写实现计划并改 `server/` 与 weapp。禁止在确认前新增服务端依赖、登录页或同步代码。

本文件锁定 Nero 已确认的决策：用微信 **openid** 识别同一用户（不用手机号）；后端放仓库根目录 `server/`；栈为 Node 22 + **Koa2** + **MySQL** + **Redis**，部署在阿里云 ECS HTTPS；首次启动强制登录，登录成功前不得进入 Tab 首页；登录后同步全部本地业务域；冲突按条目 `updatedAt` 新者胜；密钥只出现在 ECS 环境变量，AppSecret 永不进仓库。

相对原 MVP 非目标「用户登录 / 手机号 / 微信开放数据」：本文件 **只放开 openid 登录与用户数据云同步**。手机号、支付、真实大模型、提审与 ECS 实装仍保持非目标。

## 背景与为什么不用手机号

M0–M5 把选品、方案、预算、房型扫描、AI 选品与 2D/轻量 3D 预览做成了 **本机 Zustand + `Taro.setStorageSync`（`fd:*`）** 闭环。换机、清缓存、或同一微信在两台设备上打开，数据无法对上号。产品下一步是「认出同一个微信用户，并把本机业务数据镜像到自建后端」。

AppID `wx678305a130615b19` 的主体是 **个人**。微信开放文档《手机号快速验证组件》写明：`getPhoneNumber` **只对非个人主体且已认证的小程序开放**。个人主体调用会得到 `getPhoneNumber:fail no permission`。因此：

- **禁止** `button open-type="getPhoneNumber"`、`phonenumber.getPhoneNumber`、自建短信验证码收集手机号、把手机号当账号主键。
- **采用** 小程序 `Taro.login` / `wx.login` 拿到一次性 `code`，服务端用 AppID + AppSecret 调微信 `jscode2session`，用返回的 **openid** 作为用户主键。openid 是微信为每个小程序分配的用户标识，正好用来「同一微信 = 同一用户」。
- 不采集昵称、头像、unionid（本阶段不绑定开放平台），不解密 `session_key` 里的用户信息。`session_key` 不得下发客户端、不得写入 MySQL。

现网文案与清单仍按「本地工具、不登录」撰写（「我的」页 `mine-note`、隐私弹窗、`docs/weapp-publish-checklist.md` 第 1/3.3/4 节）。那是 M5 结束时的事实，不是本设计的终态。实现登录同步的 PR 必须改清单与「我的」文案；本设计 PR 只在清单顶部留一行指向，避免读者把旧「不登录」当成下一阶段约束。

## 目标

1. 用户打开小程序后先看到登录页。未持有有效 Bearer 会话时，不能 `switchTab` 到「选品 / 方案 / 预算 / 我的」。
2. 登录只识别微信 openid，UI 明确写「不获取手机号」。
3. 登录成功后，把下列 **全部** 用户域同步到云端，并在其它设备按条目合并：收藏、方案（含 `activePlanId`）、预算、扫描尺寸、AI 选品结果快照。
4. 同一 `(kind, itemId)` 只保留一条；冲突比较 ISO 8601 `updatedAt`，**新者胜**；相等则保留服务端副本。
5. 后端与小程序同仓库：根目录 `server/`（Koa2），不是 `apps/api` 式 monorepo。
6. 生产只跑在阿里云 ECS 的 HTTPS 域名；微信 request 合法域名指向该域名。密钥只从 ECS 环境变量读取。

## 非目标

本设计与后续实现 PR **都不做**：

- 在阿里云上实际开通 ECS / RDS / Redis、备案解析、装证书、配 systemd（只在文末给出实现时笔记指针）。
- 提交微信小程序审核、发布正式版、把体验版当生产。
- 收集手机号、身份证、位置、通讯录、好友关系。
- 支付、订单、SKU 库存、客服消息。
- 真实大模型推理、商用 glTF、扫描照片 / 点云上传。
- 2D 预览拖动坐标持久化（M5 已冻结：刷新回到自动排布，坐标不进 `fd:*`，因此也不进云端）。
- 多端（H5 / App）、多语言、深色主题、后台管理端、多用户协同编辑、实时 WebSocket。
- 把 AppSecret、MySQL 密码、Redis 密码、`SESSION_SECRET` 写入 git、`.env.example` 真值或聊天。

## 技术栈（已确认）

| 层 | 选择 | 约束 |
| --- | --- | --- |
| 小程序 | 现有 Taro 4.3.2 + React 18 + TypeScript + Vite + Zustand 5 | 不升 React 19；持久化仍走 `configureStorage` 包一层 `Taro.setStorageSync`，不用 `localStorage`。 |
| 登录 API | `Taro.login` → `POST /api/auth/login` | 禁止 `getPhoneNumber` / `getUserProfile`。 |
| 业务 API | `Taro.request`，`Authorization: Bearer <token>` | 基址只来自 `TARO_APP_API_BASE_URL`，不写死域名。 |
| 后端目录 | 仓库根 `server/` | 自有 `package.json` 与 `engines.node` `>=22.23.4 <23`。根目录 weapp 的 `package.json` 不把 Koa / mysql2 / redis 加进小程序依赖。不建 pnpm-workspace，不用 `apps/api`。 |
| HTTP | **Koa2**（`koa@2`）+ `@koa/router` + `@koa/bodyparser` | Node 22。入口 `server/src/index.ts`。 |
| 数据 | **MySQL 8**（用户 + 同步条目） | `utf8mb4`。驱动 `mysql2`。 |
| 会话 | **Redis** | 只存会话，不把业务域只放 Redis。驱动 `ioredis`。 |
| 部署形态 | 阿里云 ECS，Nginx 终止 TLS，反代到 Koa | 本文件不执行部署。微信后台 request 合法域名为该 HTTPS 主机名，协议必须 TLS 1.2+。 |

全局硬约束（沿用 MVP，并加上会话）：

- 源代码与 UI 用简体中文；代码标识符用英文。
- 金额仍为整数分；面积平方米；尺寸毫米；时间 ISO 8601（UTC，后缀 `Z`）。
- 未经 Nero 确认：不部署、不提审、不把体验版当正式发布。

## 架构

```
微信小程序 weapp
  pages/login（非 Tab，启动第一页）
  Tab：选品 / 方案 / 预算 / 我的
  Zustand：favorite / plan / budget / scan / aiPreview / sync(auth)
        │  Taro.login() 得到 code
        │  Taro.request HTTPS
        ▼
server/  Koa2（ECS，Nginx :443 → Koa :PORT）
  POST /api/auth/login
        │  WECHAT_APPID + WECHAT_APPSECRET
        ▼
  微信 api.weixin.qq.com/sns/jscode2session
        │  openid
        ▼
  MySQL  users（openid 唯一）
  Redis  sess:{id} → userId，TTL 30 天（滑动）
        │
  GET/PUT /api/sync   Bearer 会话
        ▼
  MySQL  sync_items（按 user_id + kind + item_id）
```

职责划分：

| 组件 | 做什么 | 不做什么 |
| --- | --- | --- |
| weapp 登录页 | 隐私同意 → `Taro.login` → 存 Bearer → 首次同步 → `reLaunch` 到选品 Tab | 不读手机号、不展示 openid |
| weapp sync 层 | 给所有业务 store 的写入打 `updatedAt`；删除写 tombstone；800ms debounce PUT；进入前台 GET | 不把 `uiStore`、商品 mock、2D 坐标、扫描照片字节同步出去 |
| Koa `POST /api/auth/login` | 用 `code` 换 openid，upsert 用户，签发会话 | 不把 `session_key` / openid 返回给客户端 |
| Koa `GET\|PUT /api/sync` | 鉴权后读写该用户全部条目并按 `updatedAt` 合并 | 不做字段级 patch、不做实时推送 |
| MySQL | 用户与条目的唯一事实源 | 不存 AppSecret、不存照片文件 |
| Redis | 会话与登录限流 | 不作为业务数据主存储 |
| 微信 code2Session | 证明 `code` 属于本 AppID | 服务端超时 5s，失败映射为 `WECHAT_UNAVAILABLE` |

网络边界：小程序只访问 `TARO_APP_API_BASE_URL` 下的 `/api/*`。Koa 只由服务端访问 `https://api.weixin.qq.com`。扫描相册图继续留在本机临时路径，**PUT 时 `photoPaths` 一律规范成 `[]`**，与 M4「参考图不上云」一致。

## 信息架构（登录门闩）

`app.config.ts` 的 `pages` 数组 **第一项** 改为 `pages/login/index`。四个 Tab 路径与文案不变，登录页 **不进** `tabBar`。

| 页面 | 路径 | 职责 |
| --- | --- | --- |
| 登录（新） | `pages/login/index` | 未登录时的唯一可停留页。主按钮文案「微信登录」；副文案「使用微信身份同步收藏、方案、预算等到云端。不获取手机号。」 |
| 选品 Tab | `pages/catalog/index` | 登录后的默认 Tab 首页（`reLaunch` 目标） |
| 其它 Tab / 二级页 | 现有路径 | 在 `onShow` 发现无有效 token 时 `reLaunch` 到登录页 |

启动顺序（实现时写在 `src/app.ts`，本设计不改代码）：

1. hydrate 本地 store（含 `fd:auth`）。
2. 无 token：停在登录页。有 token：不在登录页停留，直接 `reLaunch` `/pages/catalog/index`。
3. 任意 Tab / 二级页 `onShow`：token 缺失或被 401 清掉 → `reLaunch` 登录页。
4. 登录页在 `Taro.login` 前调用 `requirePrivacyAuthorize`。用户拒绝：留在登录页，toast「需要同意隐私指引才能同步」，**不得**进入 Tab。

登录成功后的「我的」增加「退出登录」：删除 Redis 会话（`POST /api/auth/logout`，无此接口时客户端仍必须清本地 token）、清 `fd:auth`，**保留**业务 `fd:*` 直到下一次登录。下一次若 `user.id` 与 `fd:auth` 里上次的 `userId` 不同，先清空业务 store 与 tombstone 再拉云端，避免两人共用一台手机串号。同一 `userId` 重新登录则保留本机数据再合并。

开发期「重置 mock」在实现登录后改为「清除我的数据」：对当前用户全部 kind 写 tombstone → PUT `/api/sync` → 清空本机业务数据。未登录时该按钮不可用。商品 mock 仍不受影响。

## 领域模型

### 现有本地形状（实现时增量，不改语义）

已有持久化 key：`fd:favorites`、`fd:plans`、`fd:budgets`、`fd:scans`。本阶段新增：

| Store / key | 是否同步 | 条目键 `itemId` | 说明 |
| --- | --- | --- | --- |
| `favoriteStore` `fd:favorites` | 是 | `productId` | 现有 `savedAt` 保留；新增 `updatedAt`（收藏或取消时刷新） |
| `planStore` `fd:plans` | 是 | `plan.id` | `Plan` 已有 `updatedAt`；删除方案时写 tombstone |
| 当前方案 | 是 | 固定 `'activePlanId'`，kind=`preference` | 现随 `fd:plans` 存储；同步时拆成独立条目，避免和某条方案的 `updatedAt` 抢同一键 |
| `budgetStore` `fd:budgets` | 是 | `planId` | 现无 `updatedAt`，同步层写入时补上。预算页展示仍用 M3 的 `buildBudget` 现算；落盘快照用于换机恢复 |
| `scanStore` `fd:scans` | 是 | `planId` | 用 `capturedAt` 作为初始 `updatedAt`；之后每次 `upsert` 刷新。`photoPaths` 不同步内容 |
| `aiPreviewStore` `fd:aiPreviews`（新） | 是 | `planId` | 上次成功返回的 AI 选品快照。当前 M5 只在页面内存，换页即丢；本阶段开始落盘并上云 |
| `syncStore` `fd:auth` / `fd:tombstones` | auth 不同步到 MySQL 业务表 | — | token 只在本机 + Redis；tombstone 列表随 PUT 上传 |
| `catalogStore` / `uiStore` | 否 | — | 商品 mock 全用户相同；UI 开关是短时状态 |

`Plan.id` 继续由客户端 `createPlanId()` 生成（`plan-<base36时间>-<6位随机>`），服务端 **不改写 id**。唯一性范围是 `(user_id, kind, item_id)`，跨用户允许相同 `plan-…` 字符串。

### 同步条目（客户端与 Koa 共用的契约，不是运行代码）

```ts
type SyncKind = 'favorite' | 'plan' | 'budget' | 'scan' | 'aiPreview' | 'preference'

interface SyncItem {
  kind: SyncKind
  itemId: string          // favorite=productId；plan=plan.id；budget/scan/aiPreview=planId；preference='activePlanId'
  updatedAt: string       // ISO 8601 UTC，例如 2026-11-03T12:00:00.000Z
  deleted: boolean        // true 时 payload 必须为 null，表示 tombstone
  payload: unknown | null
}

interface FavoritePayload {
  productId: string
  savedAt: string
  updatedAt: string
}

// Plan payload = 现有 Plan（id/title/roomType/areaM2/stage/productIds/coverProductId/createdAt/updatedAt）

interface BudgetPayload {
  planId: string
  totalFen: number
  spentByCategory: Record<'furniture' | 'material' | 'labor' | 'other', number>
  updatedAt: string
}

interface ScanPayload {
  planId: string
  source: 'visionkit-v2' | 'manual'
  widthMm: number
  depthMm: number
  heightMm: number
  photoPaths: []          // 云端恒为空数组
  capturedAt: string
  updatedAt: string
}

interface AiPreviewPayload {
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

interface PreferencePayload {
  activePlanId: string | null
}
```

删除规则：取消收藏、删除方案、清除数据时不得从数组里「悄悄拿掉」而不留痕，否则另一台设备上的旧副本会在下次 GET 时复活。客户端把 tombstone 放进 `fd:tombstones`，直到某次 PUT 响应里服务端已带相同 `(kind, itemId, deleted:true)` 且其 `updatedAt` ≥ 本地 tombstone，才可丢掉本地 tombstone。

方案被删时，客户端同时为该 `planId` 的 `budget` / `scan` / `aiPreview` 写 tombstone。合并后若 `preference.activePlanId` 指向已删除方案，客户端把它收成仍存在的方案里 `updatedAt` 最新的一条，若没有则 `null`，并刷新 preference 的 `updatedAt`。

数量上限（PUT 校验，超出 `VALIDATION_ERROR`）：收藏 200、方案 50、预算 50、扫描 50、AI 快照 50、preference 1、tombstone 合计不超过 400。单请求 body 上限 512 KiB。

### MySQL

库名来自 `MYSQL_DATABASE`。表：

**`users`**

| 列 | 类型 | 约束 |
| --- | --- | --- |
| `id` | `CHAR(36)` | PK，服务端 UUID v4 |
| `openid` | `VARCHAR(64)` | UNIQUE NOT NULL |
| `created_at` | `DATETIME(3)` | NOT NULL |
| `updated_at` | `DATETIME(3)` | NOT NULL |
| `last_login_at` | `DATETIME(3)` | NOT NULL |

不存手机号、不存 `session_key`、不存昵称头像。`id` 可下发给客户端；**openid 不下发**。

**`sync_items`**

| 列 | 类型 | 约束 |
| --- | --- | --- |
| `user_id` | `CHAR(36)` | NOT NULL，FK → `users.id` ON DELETE CASCADE |
| `kind` | `ENUM('favorite','plan','budget','scan','aiPreview','preference')` | NOT NULL |
| `item_id` | `VARCHAR(64)` | NOT NULL |
| `payload` | `JSON` | `deleted=1` 时为 NULL |
| `updated_at` | `DATETIME(3)` | NOT NULL |
| `deleted` | `TINYINT(1)` | NOT NULL DEFAULT 0 |
| `created_at` | `DATETIME(3)` | NOT NULL |

主键 / 唯一：`(user_id, kind, item_id)`。二级索引：`(user_id, updated_at)`。MVP 不物理删除 tombstone（体量小；不做定时 GC）。

### Redis 会话

| 键 | 值 | TTL |
| --- | --- | --- |
| `sess:{sid}` | JSON `{ "userId": "<uuid>" }` | 30 天；每次鉴权成功 `EXPIRE` 续期（滑动） |
| `rl:login:{ip}` | 计数 | 60 秒；超过 20 次登录尝试返回 `429` / `RATE_LIMITED` |

会话 token 格式：`{sid}.{sig}`。`sid` 为 32 字节密码学随机数的 base64url；`sig = HMAC-SHA256(SESSION_SECRET, sid)` 的 base64url。Koa 先校验 HMAC，再查 Redis。只持有 Redis 或只持有 `SESSION_SECRET` 都不能伪造可用 Bearer。

`SESSION_SECRET` 至少 32 个 ASCII 字符，只存在 ECS 环境变量。轮换密钥会使全部会话失效，用户重新走登录页；业务数据仍在 MySQL。

## HTTP API

基址：`TARO_APP_API_BASE_URL`，无尾斜杠。所有 JSON；UTF-8。错误体统一：

```json
{ "error": { "code": "UNAUTHORIZED", "message": "请重新登录" } }
```

| `error.code` | HTTP | 何时 |
| --- | --- | --- |
| `INVALID_CODE` | 401 | `code` 缺失、格式非法、微信返回 40029 / 40163（已使用） |
| `UNAUTHORIZED` | 401 | 缺 Bearer、HMAC 失败、Redis 无会话 |
| `RATE_LIMITED` | 429 | 同一 IP 60 秒内登录超过 20 次 |
| `WECHAT_UNAVAILABLE` | 502 | code2Session 超时或 5xx |
| `PAYLOAD_TOO_LARGE` | 413 | body > 512 KiB |
| `VALIDATION_ERROR` | 400 | kind / 枚举 / 上限 / `deleted` 与 payload 不一致 |
| `INTERNAL` | 500 | 其它 |

成功不包一层 `{ data }`：登录与同步的成功体就是下一节列出的对象。

### `POST /api/auth/login`

无需 Bearer。Body：

```json
{ "code": "<wx.login js_code>" }
```

服务端：

1. 校验 `code` 为非空字符串、长度 ≤ 128。
2. 限流。
3. `GET https://api.weixin.qq.com/sns/jscode2session?appid={WECHAT_APPID}&secret={WECHAT_APPSECRET}&js_code={code}&grant_type=authorization_code`，超时 5s。`errcode` 非 0 按上表映射。
4. `INSERT` 或按 `openid` 更新 `last_login_at`。
5. 签发 token，写入 Redis。

响应 `200`：

```json
{ "token": "<sid>.<sig>", "expiresIn": 2592000, "user": { "id": "<uuid>" } }
```

`expiresIn` 固定 2592000 秒（30 天），与 Redis TTL 一致。响应 **不得** 包含 `openid`、`session_key`、`unionid`。

### `POST /api/auth/logout`

需要 Bearer。删除 `sess:{sid}`，响应 `204` 空 body。客户端无论 204 还是网络失败都清本地 token。

### `GET /api/health`

无鉴权。`200`：`{ "ok": true }`。供 ECS / Nginx 探活，不进小程序主路径。

### `GET /api/sync`

需要 Bearer。返回该用户全部 `sync_items`（含 tombstone）：

```json
{
  "serverTime": "2026-11-03T12:00:00.000Z",
  "items": [ { "kind": "plan", "itemId": "plan-…", "updatedAt": "…", "deleted": false, "payload": { } } ]
}
```

无 `since` 过滤（用户数据量远低于上限，全量即可）。空用户返回 `items: []`。

### `PUT /api/sync`

需要 Bearer。Body：

```json
{
  "clientTime": "2026-11-03T12:00:00.100Z",
  "items": [ { "kind": "favorite", "itemId": "p-sofa-modern-01", "updatedAt": "…", "deleted": false, "payload": { } } ]
}
```

合并（单事务，按 `(kind, itemId)` 行锁）：

1. 校验 kind、itemId 非空、`updatedAt` 可解析为时间、数量上限、`deleted === true` 时 `payload === null`、`deleted === false` 时 payload 能通过该 kind 的字段校验（房间 / 阶段 / 品类枚举与 `src/types/domain.ts` 一致；面积、扫描毫米沿用 `domainLimits.ts` 的上限）。
2. 客户端 `updatedAt` 若比服务端时钟超前超过 10 分钟，**钳制为服务端当前时间**（防止设备时钟被拨快后永远获胜）。落后不改写。
3. 库中无此行：插入。
4. 库中有此行：若请求 `updatedAt` **严格晚于** 库中值，覆盖 `payload` / `deleted`；若早于或相等，保留库中行。
5. 请求未提到的行保持不变（客户端必须带上自己仍关心的 tombstone；漏带不会删云端）。
6. 扫描 payload 写入前把 `photoPaths` 设为 `[]`。

响应 `200`：合并后的完整快照，形状与 GET 相同。客户端用响应 **整表替换** 内存 store + `fd:*`，再丢弃已被云端接受的 tombstone。

鉴权中间件：从 `Authorization` 读 `Bearer ` 前缀；没有或 Redis miss → `401 UNAUTHORIZED`。小程序收到 401：清 `fd:auth` 的 token、`reLaunch` 登录页；**不**在 401 时自动清空业务 `fd:*`（同一用户重新登录后还要靠 `updatedAt` 合并）。

## 客户端流程

```
启动
  hydrate fd:* + fd:auth
  无 token → 留在 pages/login
  有 token → reLaunch 选品 Tab，并调度一次前台 pull

登录页点「微信登录」
  requirePrivacyAuthorize（拒绝则停）
  Taro.login → { code }
  POST /api/auth/login
  写入 fd:auth { token, userId, loggedInAt }
  若 userId ≠ 上次 userId → reset 业务 store + tombstones
  GET /api/sync → 按 updatedAt 与本机合并
  PUT /api/sync（把本机独有条目推上去）
  上述 GET/PUT 合计最多等 8s；超时或失败仍 reLaunch 选品，并标记 pendingRetry
  reLaunch /pages/catalog/index

进入前台（App onShow）
  距上次成功 pull ≥ 5s 才 GET
  合并进 store；若本地存在比响应更新的条目或未确认 tombstone，接着 PUT

业务 store 每次成功写入
  刷新该条目 updatedAt = now ISO
  启动 800ms debounce；到期 PUT 全量 items（含未确认 tombstone）
  若已有 PUT 在飞，结束后若期间又有写入，再 PUT 一次
```

合并函数（GET 响应 vs 本机，登录后与前台共用）：对每个 `(kind, itemId)` 取 `updatedAt` 较新的一方；相等取 **服务端**。kind 未出现在响应里、只存在于本机且无更新的条目保留（随后 PUT 上传）。

AI 快照写入时机：`fetchAiRecommendations` **成功返回后**（含空数组）按 `planId` upsert `aiPreviewStore`。请求失败不改旧快照。2D 拖动仍只活在页面 state。

预算：store 仍在方案变动时 `ensureForPlan`；同步层给快照补 `updatedAt`。拉下来之后预算 **页** 继续用 `buildBudget(plan, products)` 显示，避免云端快照与公式不一致时 UI 出现 NaN。快照的用途是换机后 `ensureForPlans` 有种子可写，不是展示的唯一来源。

失败提示（toast，不进 Tab 拦截，登录页除外）：

| 场景 | 文案 |
| --- | --- |
| 登录网络 / 502 | 登录失败，请重试 |
| `INVALID_CODE` | 登录已过期，请再点一次 |
| 隐私拒绝 | 需要同意隐私指引才能同步 |
| 同步失败 | 同步失败，将在网络恢复后重试 |
| `TARO_APP_API_BASE_URL` 为空 | 未配置服务地址，无法登录（开发期；生产构建必须带基址） |

未配置基址时登录按钮可点，但请求不得发往相对路径或微信域外的猜测地址；直接走失败文案。禁止做「跳过登录」调试后门进 Tab。

## 错误处理与安全

- **传输**：生产只允许 HTTPS。Koa 若发现 `X-Forwarded-Proto` 不是 `https`（ECS 上 Nginx 注入），登录与同步返回 400。本地开发可用 HTTP，由 `NODE_ENV=development` 放开。
- **密钥**：`WECHAT_APPSECRET`、`MYSQL_PASSWORD`、`REDIS_PASSWORD`、`SESSION_SECRET` 只从环境变量读。进程启动时 `WECHAT_APPID` / `WECHAT_APPSECRET` / `MYSQL_*` / `SESSION_SECRET` 任一缺失则拒绝 listen，打日志「missing env」，日志里 **不得** 打印密钥本身。`NODE_ENV=development` 时 `REDIS_PASSWORD` 允许空字符串；`NODE_ENV=production` 时 `REDIS_PASSWORD` 不得为空。
- **日志**：可记 `userId`、微信 `errcode`、路由、耗时。禁止记 `code`、token、openid、AppSecret。
- **code 一次性**：微信 `js_code` 5 分钟且单次。客户端失败重试必须重新 `Taro.login`，不得缓存 code。
- **鉴权**：除 `/api/auth/login` 与 `/api/health` 外全部要 Bearer。不使用 Cookie，避免小程序域 Cookie 语义。
- **限流**：登录按 IP；同步按 `userId` 60 秒 60 次，超出 `RATE_LIMITED`。
- **注入**：JSON body 用 bodyparser 限制 512 KiB；SQL 只用参数绑定。
- **越权**：所有 `sync_items` 查询带 `user_id = 会话 userId`，忽略客户端伪造的 userId 字段（请求体也没有该字段）。
- **扫描照片**：服务端丢弃任何非空 `photoPaths`；客户端不 `Taro.uploadFile`。
- **仓库**：`.gitignore` 已含 `.env`、`*.pem`、`*.key`。`server/` 不得新增把密钥写进文件的示例。`.env.example` 只列变量名。
- **AppID**：小程序侧沿用 `project.config.json` 的 `wx678305a130615b19`。服务端 `WECHAT_APPID` 必须与此相同；不一致时 code2Session 会失败，不得在代码里写死 AppSecret 去「对齐」。

## 环境变量（仅名字）

小程序构建（Taro 注入，未跟踪 `.env`）：

| 变量 | 用途 |
| --- | --- |
| `TARO_APP_API_BASE_URL` | 如 `https://example.com`，无尾斜杠；请求 `${TARO_APP_API_BASE_URL}/api/...` |
| `TARO_APP_AI_RECOMMEND_URL` | 已有；本设计不改。未设置时 AI 仍走本地 mock，但 **mock 结果仍要写入 `fd:aiPreviews` 并同步** |

ECS / 本地 `server/` 进程：

| 变量 | 用途 |
| --- | --- |
| `WECHAT_APPID` | 与小程序 AppID 相同 |
| `WECHAT_APPSECRET` | 微信后台生成；永不提交 |
| `MYSQL_HOST` | MySQL 主机 |
| `MYSQL_PORT` | 端口，未设时进程内默认 `3306` |
| `MYSQL_USER` | 账号 |
| `MYSQL_PASSWORD` | 密码 |
| `MYSQL_DATABASE` | 库名 |
| `REDIS_HOST` | Redis 主机 |
| `REDIS_PORT` | 端口，未设时进程内默认 `6379` |
| `REDIS_PASSWORD` | 密码；仅 `NODE_ENV=development` 允许空字符串 |
| `REDIS_DB` | 逻辑库，未设时默认 `0` |
| `SESSION_SECRET` | HMAC 会话，≥32 字符 |
| `PORT` | Koa listen 端口，未设时默认 `3000`（Nginx 反代到此） |
| `NODE_ENV` | `production` / `development` |

`.env.example`（实现 PR 更新，本设计 PR 可不动）只出现左侧名字与注释「不要把密钥粘贴到本文件」，不出现真值。微信公众平台、阿里云控制台、本机 shell 才是密钥位置。

## 实现时目录（本 PR 不创建）

```
server/
  package.json                 # name: furniture-decoration-server；engines.node 与根目录相同
  src/index.ts                 # listen PORT
  src/app.ts                   # Koa、错误处理、HTTPS 检查
  src/routes/auth.ts           # login / logout
  src/routes/sync.ts           # GET/PUT /api/sync
  src/routes/health.ts
  src/services/wechat.ts       # code2Session
  src/services/session.ts      # HMAC + Redis
  src/services/merge.ts        # updatedAt 新者胜
  src/db/mysql.ts
  src/db/schema.sql            # users + sync_items
src/pages/login/               # 登录页
src/stores/syncStore.ts
src/stores/aiPreviewStore.ts
src/constants/storageKeys.ts   # 追加 fd:auth / fd:tombstones / fd:aiPreviews
```

根目录 weapp 继续 `pnpm dev:weapp`。`server/` 使用自己的 `pnpm dev`（`tsx watch` 或等价）。不要把服务端打进小程序主包。

## 对现有文档的关系

| 文档 | 本设计如何对待 |
| --- | --- |
| MVP 设计「非目标：用户登录、手机号」 | **部分作废**：openid 登录放开；手机号仍禁止。Tab 仍是四个，登录不是第五 Tab。 |
| MVP「我的：不做登录」 | 实现后「我的」展示登录态、退出、清除我的数据；收藏列表仍在。 |
| M4 / 扫描对比：照片不上云 | 继续有效；同步只传毫米与 source。 |
| M5：拖动坐标不进 `fd:*` | 继续有效；不同步布局。AI 结果从「内存一次性」升级为 `fd:aiPreviews`。 |
| `docs/weapp-publish-checklist.md` | 实现 PR 必须改简介、「明确不收集」、提审说明：改为「用微信 openid 登录并同步到自建 HTTPS 服务器；仍不收集手机号」。须增加隐私指引项「用户标识（openid）」与 request 合法域名。**本设计 PR 不重写该清单正文**（仅一行指针）。 |
| 「我的」`mine-note` 与隐私弹窗 | 实现 PR 必须改为说明：登录后数据同步到自建服务器；扫描照片仍不上云；可退出登录与清除数据。 |

## 验收标准（本设计落地后的 MVP）

实现计划与实现 PR 按下列条目验收；本设计 PR 只提交文档。

1. 冷启动无 token：第一屏是登录页，底部无 Tab 可操作；截图或开发者工具页面路径为 `pages/login/index`。
2. 点「微信登录」不出现任何 `getPhoneNumber` / 手机号输入。源码检索 `getPhoneNumber`、`getUserProfile`、`phoneNumber` 业务调用为零（测试夹具字符串除外）。
3. 登录成功后才进入「选品」Tab；杀掉进程再进，token 未过期则不再经过登录页。
4. 同一测试 openid、两台设备（或清掉其中一台的 `fd:*` 后重登）：收藏、方案、当前方案、预算快照、扫描尺寸、AI 选品快照在 GET/PUT 后一致。
5. 冲突：设备 A 改方案标题 `updatedAt=T1`，设备 B 改同一 `plan.id` 的阶段 `updatedAt=T2>T1`，合并后整条方案以 B 为准（条目级，不是字段级）。取消收藏的 tombstone 若更新，另一设备该收藏消失且不复活。
6. 扫描 `photoPaths` 在 PUT 前后云端均为 `[]`；网络面板无 `uploadFile`。
7. `WECHAT_APPSECRET` 与其它密钥不出现在仓库全文检索（含 `server/`、docs 示例值）。
8. 未设 `TARO_APP_API_BASE_URL` 时不能进入 Tab。
9. Bearer 过期或 Redis 丢会话：下一次 GET/PUT 得 401，回到登录页，业务数据仍在本机；同一 `user.id` 重登后按 `updatedAt` 合并，不丢未上传的新条目。
10. 登录页副文案含「不获取手机号」。清单与「我的」隐私文案已改到与本文件一致（属于实现 PR，不在本设计 PR）。

## 后续工作

1. **实现计划**（另开 `docs/superpowers/plans/2026-11-03-openid-login-sync.md`）：按本文件拆任务，先测合并函数与鉴权，再搭 `server/`，再改 weapp 登录门闩与 store `updatedAt`。
2. **实现 PR 必须同步修改**：`docs/weapp-publish-checklist.md`（简介、§3 隐私、§4 提审说明、request 合法域名）以及「我的」页 `mine-note` / 隐私弹窗 / 重置按钮文案。本设计不把这些文案提前改掉，以免未实现时清单说谎。
3. **可选：企业主体后的手机号**。若将来账号升级为非个人主体且完成认证，另开设计评估 `getPhoneNumber`。在那之前不得预埋手机号字段或 UI。openid 仍是主键；手机号最多当资料字段。
4. **ECS 部署笔记指针**（实现部署时另写，不在本仓库本阶段提交）：阿里云 ECS 安装 Node 22；Nginx `:443` 反代 `127.0.0.1:$PORT`；Let’s Encrypt 或阿里云证书；MySQL 8 与 Redis 绑在本机或同内网，安全组不对公网开放 `3306` / `6379`；用 systemd 跑 `server/` 并从 ECS 环境变量注入上一节全部名字；微信公众平台配置 request 合法域名为该 HTTPS 主机名。**本设计不执行其中任何一步。**

## 范围锁定（自检）

- 本文没有「待定 / TBD / TODO / 稍后补充」占位。冲突策略、tombstone、登录门闩、目录、环境变量名、错误码均已写死。
- 与 M4「照片不上云」、M5「拖动不落盘」、个人主体禁用手机号 **无相反指令**。
- 本 PR 交付物只有本规格（外加清单顶部一行指针）；不含 `server/` 代码、不含登录页、不改 store。
- 明确不在范围内：部署 ECS、提交审核、收集手机号。

## 2026-11-03 修复补充：归属、在途请求及清除边界

- 本地 `fd:dataOwner` 独立于 `fd:auth` 持久化，退出和 401 保留归属。微信登录或 Bearer 恢复验证确认身份后，归属不同（或旧数据归属无法确认）先清理业务域和 tombstone，再开放同步；旧版仍有效 auth 可用于迁移归属。清理或归属写入失败时不接纳新身份。
- 会话每次设置、恢复、退出及开始清除均递增内存代次；请求、响应、401 和防抖任务绑定代次。登录同步超时使其上下文失效，迟到任务不能写 store 或继续 PUT。冷启动 token 必须经 `/api/auth/session` 验证后才能进入 Tab。
- PUT 发送深拷贝快照，返回时逐键比较当前本地条目与发送快照。请求期间的改动覆盖该次响应并触发下一轮 PUT；未改动条目接受服务端权威版本。所有业务条目的 `updatedAt` 使用响应外层时间。仅 GET/PUT 的真实服务端条目确认删除；PUT 可确认被钳制但仍与发送快照一致的本地 tombstone。
- MySQL upsert 对 payload、deleted 原子判断 `incoming.updated_at > existing.updated_at`，最后才更新时间，相等保留已有。PUT 与全量清除事务共同锁定当前用户行，避免读后写窗口及清除穿插。
- `DELETE /api/sync` 只按 Bearer 用户清除全部同步行（含其他设备创建、尚未拉取的行），提交后返回 `{ cleared: true, items: [], serverTime }`。清除前客户端暂停同步、作废旧上下文并等待已发 PUT 结束；只有明确确认且本机落盘成功才提示“已清除”。会话发生变化时不清新会话的数据。
- 并发语义：用户行锁之前完成的 PUT 被清除；锁之后开始执行的 PUT 视为清除后的写入，可以创建新数据。本操作不是账号注销，也不禁止其他在线或离线设备未来再次写入。
