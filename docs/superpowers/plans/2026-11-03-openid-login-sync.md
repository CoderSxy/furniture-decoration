# OpenID 登录与全量本地数据云同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在仓库根目录新增独立 `server/`（Koa2 + MySQL + Redis），并用微信 openid 登录把门闩加到现有 Taro weapp：未登录不能进 Tab；登录后把收藏、方案、当前方案、预算、扫描尺寸、AI 选品快照按条目 `updatedAt` 全量同步到自建 HTTPS API。

**Architecture:** 不建 pnpm-workspace、不把 Koa / mysql2 / ioredis 写进根目录 weapp 的 `package.json`。服务端入口 `server/src/index.ts` 组装可注入的 `createApp(deps)`（测试用内存 MySQL/Redis + mock `code2Session`，进程用真实驱动）。小程序侧新增非 Tab 登录页为 `app.config.ts` 的 `pages` 第一项；`syncStore` 只管 `fd:auth` / `fd:tombstones`；业务 store 继续写各自 `fd:*`，由 `syncEngine` 收集 `SyncItem`、800ms debounce PUT、进入前台 GET。冲突只比整条 `updatedAt`，新者胜，相等留服务端。密钥只从环境变量读。

**Tech Stack:** 小程序维持 Taro 4.3.2 + React 18.3.1 + TypeScript + Vite + Zustand 5 + pnpm + Node `>=22.23.4 <23`。后端：同一 Node 区间、`koa@2`、`@koa/router`、`@koa/bodyparser`、`mysql2`、`ioredis`。测试：weapp 仍用 `node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/<file>.test.ts`；server 用 `pnpm --dir server test`（同样 strip-types，不连真实 RDS）。

## Global Constraints

- 小程序主体是**个人**，禁止 `getPhoneNumber` / `getUserProfile` / 短信验证码 / 把手机号当主键；openid 是唯一用户标识，不得下发客户端。
- 后端必须放仓库根目录 `server/`（自有 `package.json`），不是 `apps/api`；禁止创建 `pnpm-workspace.yaml`。
- 栈锁定：Node 22（`engines.node` `>=22.23.4 <23`）+ **Koa2** + **MySQL 8 utf8mb4** + **Redis**。weapp 根 `package.json` 不得出现 `koa` / `mysql2` / `ioredis`。
- 首次启动强制登录：无有效 Bearer 时不能 `switchTab` 到「选品 / 方案 / 预算 / 我的」；登录页不进 `tabBar`。禁止「跳过登录」调试后门。
- 必须全量同步：`favorite` / `plan` / `preference(activePlanId)` / `budget` / `scan` / `aiPreview`。不同步 `uiStore`、商品 mock、2D 拖动坐标、扫描照片字节。
- 冲突按条目 `(kind, itemId)` 的 ISO 8601 `updatedAt` 比较：**严格晚者胜**；相等保留服务端副本。删除必须写 tombstone，禁止悄悄从数组拿掉。
- 密钥（`WECHAT_APPSECRET`、`MYSQL_PASSWORD`、`REDIS_PASSWORD`、`SESSION_SECRET`）只出现在 ECS / 本机环境变量。`.env.example` 只列名字。AppSecret 永不进仓库、不进聊天、不进测试真值。
- 未经 Nero 确认：不部署阿里云 ECS / RDS / Redis、不备案解析、不装证书、不提交小程序审核、不把体验版当正式发布。
- 客户端：Taro 4.3.2、React 18.3.1（不升 19）、Zustand `create`，持久化继续 `configureStorage` 包一层 `Taro.setStorageSync`，不用 `localStorage`。
- `config/dev.ts` 保持 `mini.debugReact: true`。
- 金额整数分；面积平方米；尺寸毫米；时间 ISO 8601 UTC（后缀 `Z`）。
- UI 文案简体中文；代码标识符英文。颜色与间距只用 `src/theme/tokens.ts` / `src/app.scss` CSS 变量。
- 基址只来自 `TARO_APP_API_BASE_URL`（无尾斜杠），未配置时不得对相对路径或猜测域名发请求。
- `session_key` 不得下发、不得写入 MySQL。响应不得包含 `openid` / `unionid`。
- 扫描 `photoPaths` 写入云端前一律 `[]`；客户端不 `Taro.uploadFile`。
- 规格来源：`docs/superpowers/specs/2026-11-03-openid-login-sync-design.md`。本计划覆盖该设计的实现，不改冲突策略、不放开手机号、不执行部署。
- weapp 测试命令必须带 `--import ./tests/preload-taro-globals.cjs`，并指向具体 `tests/*.test.ts` 文件。server 测试指向具体 `server/tests/*.test.ts`。
- 2D 拖动坐标仍不进 `fd:*`，因此也不进云端。M4「参考图不上云」继续有效。

---

## File Structure

本计划在 M0–M5 已落地的 weapp 上增量，并**新建**根目录 `server/`。不要用 `taro init` 重搭。不要改 mock 商品表。不要把登录页推进 `tabBar`。

```
server/package.json                      # name: furniture-decoration-server；engines 与根目录相同
server/tsconfig.json
server/.env.example                      # 只列变量名
server/src/env.ts                        # loadEnv；缺密钥拒绝 listen
server/src/errors.ts                     # ApiError + 统一 JSON 错误体
server/src/types/sync.ts                 # SyncKind / SyncItem（与 weapp 字段同名，不共享包）
server/src/app.ts                        # createApp(deps)；bodyparser 512 KiB
server/src/index.ts                      # 读 env、真实 mysql2/ioredis、listen PORT
server/src/routes/health.ts              # GET /api/health
server/src/routes/auth.ts                # POST /api/auth/login|logout
server/src/routes/sync.ts                # GET|PUT /api/sync
server/src/middleware/https.ts           # production 要求 X-Forwarded-Proto=https
server/src/middleware/auth.ts            # Bearer HMAC + Redis
server/src/middleware/errorHandler.ts
server/src/db/schema.sql                 # users + sync_items
server/src/db/ports.ts                   # MysqlPort / RedisPort / WechatPort / AppDeps
server/src/db/mysql.ts                   # mysql2 实现
server/src/db/redis.ts                   # ioredis 实现
server/src/services/session.ts           # {sid}.{sig}、TTL 30 天滑动
server/src/services/wechat.ts            # jscode2session，超时 5s
server/src/services/rateLimit.ts         # 登录 IP 20/60s；同步 userId 60/60s
server/src/services/merge.ts             # updatedAt 新者胜 + 时钟钳制
server/src/services/validateSync.ts      # kind / 上限 / payload
server/src/domain/enums.ts               # 与 src/types/domain.ts 一致的房间/阶段/品类枚举
server/tests/helpers.ts
server/tests/fakes.ts
server/tests/env.test.ts
server/tests/health.test.ts
server/tests/schema.test.ts
server/tests/session.test.ts
server/tests/auth-login.test.ts
server/tests/auth-middleware.test.ts
server/tests/merge.test.ts
server/tests/sync.test.ts
server/tests/smoke.test.ts

src/types/sync.ts                        # 客户端契约（字段与 server 相同）
src/types/domain.ts                      # FavoriteRecord / Budget / RoomScan 增加 updatedAt
src/constants/storageKeys.ts             # 追加 fd:auth / fd:tombstones / fd:aiPreviews
src/constants/labels.ts                  # 登录 / 同步 / 「我的」固定文案
src/stores/syncStore.ts                  # token + userId + pendingRetry
src/stores/aiPreviewStore.ts             # fd:aiPreviews
src/stores/favoriteStore.ts              # updatedAt + 取消收藏 tombstone
src/stores/planStore.ts                  # deletePlan + activePlanUpdatedAt
src/stores/budgetStore.ts                # 快照补 updatedAt；removePlan
src/stores/scanStore.ts                  # upsert 刷新 updatedAt；removePlan
src/utils/tombstones.ts                  # fd:tombstones，不 import 业务 store
src/utils/syncMerge.ts                   # GET 响应 vs 本机，相等取服务端
src/utils/syncEngine.ts                  # collect / apply / debounce PUT / 前台 GET
src/utils/apiClient.ts                   # TARO_APP_API_BASE_URL + Bearer
src/utils/authSession.ts                 # loginWithWeChat / logoutSession
src/utils/authGate.ts                    # guardAuthenticatedPage
src/hooks/useAuthGate.ts                 # 各业务页 useDidShow
src/pages/login/index.tsx
src/pages/login/index.config.ts
src/pages/login/index.scss
src/app.ts                               # hydrate auth/aiPreview；onShow pull
src/app.config.ts                        # pages[0]=pages/login/index
src/pages/mine/index.tsx                 # 退出登录 / 清除我的数据 / 隐私文案
config/index.ts                          # 注入 TARO_APP_API_BASE_URL
.env.example                             # 追加 TARO_APP_API_BASE_URL 名字
docs/weapp-publish-checklist.md          # openid 同步；仍不收集手机号
README.md                                # 当前里程碑改为登录 + 同步
tests/sync-types.test.ts
tests/sync-merge.test.ts
tests/tombstones.test.ts
tests/sync-store.test.ts
tests/ai-preview-store.test.ts
tests/sync-engine.test.ts
tests/api-client.test.ts
tests/auth-session.test.ts
tests/auth-gate.test.ts
tests/login-page.test.ts
tests/openid-no-phone.test.ts
tests/labels.test.ts                     # 追加登录文案
tests/tabs.test.ts                       # 登录页第一项、不进 tabBar
tests/favorite-store.test.ts             # updatedAt / tombstone
tests/plan-store.test.ts                 # deletePlan / activePlanUpdatedAt
tests/budget-store.test.ts               # updatedAt
tests/scan-store.test.ts                 # updatedAt
tests/reset-mock.test.ts                 # 改为清除我的数据语义
tests/navigation.test.ts                 # loginPageUrl
tests/taro-stub.mjs                      # login / reLaunch / toast / privacy
```

不要创建：支付、H5、后台管理、WebSocket、手机号字段、`apps/api`、pnpm-workspace、把 AppSecret 写进示例值、扫描照片上传接口。不要改 `src/types/domain.ts` 里已有的 `Plan` / `Product` 字段语义（只给 `FavoriteRecord` / `Budget` / `RoomScan` 增加 `updatedAt`）。不要把 2D 坐标写入任何 `fd:*`。

**取舍：** server 与 weapp **各写一份** `SyncKind` / `SyncItem` 类型（禁止为了共享类型建 workspace）。测试一律注入端口，不在 CI 起 Docker MySQL/Redis。

---

### Task 1: server 脚手架、env、health

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`
- Create: `server/src/env.ts`
- Create: `server/src/errors.ts`
- Create: `server/src/db/ports.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Create: `server/src/middleware/errorHandler.ts`
- Create: `server/src/middleware/https.ts`
- Create: `server/src/routes/health.ts`
- Create: `server/tests/helpers.ts`
- Create: `server/tests/fakes.ts`
- Create: `server/tests/env.test.ts`
- Create: `server/tests/health.test.ts`
- Modify: `package.json`（只加 `test:server` / `dev:server` script，不加后端依赖）
- Modify: `README.md`（追加本地启动 `server/` 的命令；里程碑名称放到 Task 9 再改文案主体）

**Interfaces:**
- Consumes: 设计里的环境变量名、`GET /api/health` → `{ ok: true }`、生产 HTTPS 检查
- Produces:
  - `loadEnv(source: NodeJS.Dict<string | undefined>): Env`
  - `Env` 字段：`WECHAT_APPID`、`WECHAT_APPSECRET`、`MYSQL_HOST`、`MYSQL_PORT`（默认 3306）、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`、`REDIS_HOST`、`REDIS_PORT`（默认 6379）、`REDIS_PASSWORD`、`REDIS_DB`（默认 0）、`SESSION_SECRET`、`PORT`（默认 3000）、`NODE_ENV`
  - `createApp(deps: AppDeps): Koa`
  - `ApiError(status: number, code: string, message: string)`
  - `errorHandler` 把 `ApiError` 写成 `{ error: { code, message } }`
  - `httpsGuard`：`NODE_ENV=production` 且非 `/api/health` 时要求 `X-Forwarded-Proto: https`，否则 `400 VALIDATION_ERROR`（中间件在路由之前，Task 1 即可测）
  - `listen(app)` 测试助手：随机端口 + `fetch`

- [ ] **Step 1: Write the failing test**

把 `server/tests/env.test.ts` 建成：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadEnv } from '../src/env.ts'

const VALID = {
  WECHAT_APPID: 'wx678305a130615b19',
  WECHAT_APPSECRET: 'x'.repeat(32),
  MYSQL_HOST: '127.0.0.1',
  MYSQL_USER: 'fd',
  MYSQL_PASSWORD: 'secret',
  MYSQL_DATABASE: 'furniture',
  REDIS_HOST: '127.0.0.1',
  REDIS_PASSWORD: 'redis-secret',
  SESSION_SECRET: 's'.repeat(32),
  NODE_ENV: 'production',
}

test('loadEnv fills MYSQL_PORT REDIS_PORT REDIS_DB PORT defaults', () => {
  const env = loadEnv(VALID)
  assert.equal(env.MYSQL_PORT, 3306)
  assert.equal(env.REDIS_PORT, 6379)
  assert.equal(env.REDIS_DB, 0)
  assert.equal(env.PORT, 3000)
  assert.equal(env.WECHAT_APPID, 'wx678305a130615b19')
})

test('loadEnv throws missing env when required secrets are absent', () => {
  for (const key of [
    'WECHAT_APPID',
    'WECHAT_APPSECRET',
    'MYSQL_HOST',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'MYSQL_DATABASE',
    'REDIS_HOST',
    'SESSION_SECRET',
  ]) {
    const source = { ...VALID }
    delete source[key as keyof typeof source]
    assert.throws(() => loadEnv(source), /missing env/)
  }
})

test('production rejects empty REDIS_PASSWORD; development allows empty string', () => {
  assert.throws(() => loadEnv({ ...VALID, REDIS_PASSWORD: '' }), /missing env/)
  const dev = loadEnv({ ...VALID, NODE_ENV: 'development', REDIS_PASSWORD: '' })
  assert.equal(dev.REDIS_PASSWORD, '')
})

test('SESSION_SECRET shorter than 32 characters is missing env', () => {
  assert.throws(() => loadEnv({ ...VALID, SESSION_SECRET: 'too-short' }), /missing env/)
})

test('loadEnv error message must not include secret values', () => {
  try {
    loadEnv({ ...VALID, WECHAT_APPSECRET: '' })
    assert.fail('expected throw')
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    assert.match(text, /missing env/)
    assert.equal(text.includes('x'.repeat(32)), false)
    assert.equal(text.includes(VALID.MYSQL_PASSWORD), false)
  }
})
```

把 `server/tests/health.test.ts` 建成：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { testDeps } from './fakes.ts'
import { listen } from './helpers.ts'

test('GET /api/health returns { ok: true } without Authorization', async () => {
  const { url, close } = await listen(createApp(testDeps()))
  try {
    const res = await fetch(`${url}/api/health`)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true })
  } finally {
    await close()
  }
})

test('production non-health requests without X-Forwarded-Proto https return 400', async () => {
  const deps = testDeps({ env: { NODE_ENV: 'production' } })
  const { url, close } = await listen(createApp(deps))
  try {
    const health = await fetch(`${url}/api/health`)
    assert.equal(health.status, 200)
    const res = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'wx-code' }),
    })
    assert.equal(res.status, 400)
    const body = await res.json()
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  } finally {
    await close()
  }
})

test('development allows http for health', async () => {
  const deps = testDeps({ env: { NODE_ENV: 'development' } })
  const { url, close } = await listen(createApp(deps))
  try {
    const res = await fetch(`${url}/api/health`)
    assert.equal(res.status, 200)
  } finally {
    await close()
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mkdir -p server/src server/tests
```

此时还没有 `server/package.json`。先写最小 `server/package.json` 以便 `pnpm --dir server test` 能跑（此步只加 script 与 engines，**先不要** `pnpm add`，让 import 失败）：

```json
{
  "name": "furniture-decoration-server",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.23.4 <23" },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "node --experimental-strip-types --test tests/*.test.ts"
  }
}
```

```bash
node --experimental-strip-types --test server/tests/env.test.ts server/tests/health.test.ts
```

Expected: FAIL（`Cannot find module` / `loadEnv` / `createApp` 未定义）。不要在这一步把测试改绿。

- [ ] **Step 3: Write minimal implementation**

`server/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["node"],
    "rootDir": ".",
    "outDir": "dist",
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

`server/.env.example`（真值一行都不要）：

```
# 不要把密钥粘贴到本文件。
WECHAT_APPID=
WECHAT_APPSECRET=
MYSQL_HOST=
MYSQL_PORT=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
REDIS_DB=
SESSION_SECRET=
PORT=
NODE_ENV=
```

然后安装（只在 `server/`）：

```bash
cd server
pnpm add koa@2 @koa/router @koa/bodyparser mysql2 ioredis
pnpm add -D typescript tsx @types/node @types/koa @types/koa__router
cd ..
```

根目录 `package.json` 的 `scripts` 增加（依赖数组不动）：

```json
"test:server": "pnpm --dir server test",
"dev:server": "pnpm --dir server dev"
```

`server/src/env.ts`：

```ts
export type Env = {
  WECHAT_APPID: string
  WECHAT_APPSECRET: string
  MYSQL_HOST: string
  MYSQL_PORT: number
  MYSQL_USER: string
  MYSQL_PASSWORD: string
  MYSQL_DATABASE: string
  REDIS_HOST: string
  REDIS_PORT: number
  REDIS_PASSWORD: string
  REDIS_DB: number
  SESSION_SECRET: string
  PORT: number
  NODE_ENV: 'production' | 'development'
}

function required(source: NodeJS.Dict<string | undefined>, key: string): string {
  const value = source[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('missing env')
  }
  return value
}

function optionalInt(source: NodeJS.Dict<string | undefined>, key: string, fallback: number): number {
  const raw = source[key]
  if (raw == null || raw === '') return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('missing env')
  return parsed
}

export function loadEnv(source: NodeJS.Dict<string | undefined>): Env {
  const nodeEnv = source.NODE_ENV === 'development' ? 'development' : 'production'
  const redisPassword = source.REDIS_PASSWORD ?? ''
  if (nodeEnv === 'production' && redisPassword.length === 0) {
    throw new Error('missing env')
  }
  const sessionSecret = required(source, 'SESSION_SECRET')
  if (sessionSecret.length < 32) throw new Error('missing env')
  return {
    WECHAT_APPID: required(source, 'WECHAT_APPID'),
    WECHAT_APPSECRET: required(source, 'WECHAT_APPSECRET'),
    MYSQL_HOST: required(source, 'MYSQL_HOST'),
    MYSQL_PORT: optionalInt(source, 'MYSQL_PORT', 3306),
    MYSQL_USER: required(source, 'MYSQL_USER'),
    MYSQL_PASSWORD: required(source, 'MYSQL_PASSWORD'),
    MYSQL_DATABASE: required(source, 'MYSQL_DATABASE'),
    REDIS_HOST: required(source, 'REDIS_HOST'),
    REDIS_PORT: optionalInt(source, 'REDIS_PORT', 6379),
    REDIS_PASSWORD: redisPassword,
    REDIS_DB: source.REDIS_DB == null || source.REDIS_DB === '' ? 0 : optionalInt(source, 'REDIS_DB', 0),
    SESSION_SECRET: sessionSecret,
    PORT: optionalInt(source, 'PORT', 3000),
    NODE_ENV: nodeEnv,
  }
}
```

`server/src/errors.ts`：

```ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function errorBody(code: string, message: string): { error: { code: string; message: string } } {
  return { error: { code, message } }
}
```

`server/src/db/ports.ts`：

```ts
import type { Env } from '../env.ts'
import type { SyncItem } from '../types/sync.ts'

export type UserRow = {
  id: string
  openid: string
  created_at: Date
  updated_at: Date
  last_login_at: Date
}

export type SyncItemRow = {
  user_id: string
  kind: SyncItem['kind']
  item_id: string
  payload: unknown | null
  updated_at: Date
  deleted: 0 | 1
  created_at: Date
}

export type MysqlPort = {
  upsertUserByOpenid(openid: string, now: Date, id: string): Promise<UserRow>
  listSyncItems(userId: string): Promise<SyncItemRow[]>
  getSyncItem(userId: string, kind: string, itemId: string): Promise<SyncItemRow | null>
  upsertSyncItem(row: SyncItemRow): Promise<void>
  withTransaction<T>(fn: (tx: MysqlPort) => Promise<T>): Promise<T>
}

export type RedisPort = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
  expire(key: string, ttlSeconds: number): Promise<void>
  incr(key: string): Promise<number>
}

export type WechatPort = {
  code2Session(code: string): Promise<{ openid: string } | { errcode: number; httpStatus?: number }>
}

export type AppDeps = {
  env: Env
  mysql: MysqlPort
  redis: RedisPort
  wechat: WechatPort
  clock: () => Date
  randomBytes: (size: number) => Buffer
  uuid: () => string
}
```

先放一个最小 `server/src/types/sync.ts`（Task 5 会补 payload 类型，此处 kind 枚举必须一次写对）：

```ts
export type SyncKind = 'favorite' | 'plan' | 'budget' | 'scan' | 'aiPreview' | 'preference'

export type SyncItem = {
  kind: SyncKind
  itemId: string
  updatedAt: string
  deleted: boolean
  payload: unknown | null
}
```

`server/src/middleware/errorHandler.ts`：

```ts
import type { Context, Next } from 'koa'
import { ApiError, errorBody } from '../errors.ts'

export async function errorHandler(ctx: Context, next: Next): Promise<void> {
  try {
    await next()
  } catch (error) {
    if (error instanceof ApiError) {
      ctx.status = error.status
      ctx.body = errorBody(error.code, error.message)
      return
    }
    const status = typeof error === 'object' && error != null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : 500
    if (status === 413) {
      ctx.status = 413
      ctx.body = errorBody('PAYLOAD_TOO_LARGE', '请求体过大')
      return
    }
    ctx.status = 500
    ctx.body = errorBody('INTERNAL', '服务器错误')
  }
}
```

`server/src/middleware/https.ts`：

```ts
import type { Context, Next } from 'koa'
import { ApiError } from '../errors.ts'
import type { AppDeps } from '../db/ports.ts'

export async function httpsGuard(ctx: Context, next: Next): Promise<void> {
  const deps = ctx.state.deps as AppDeps
  if (deps.env.NODE_ENV !== 'production') {
    await next()
    return
  }
  if (ctx.path === '/api/health') {
    await next()
    return
  }
  const proto = ctx.get('x-forwarded-proto')
  if (proto !== 'https') {
    throw new ApiError(400, 'VALIDATION_ERROR', '生产环境只允许 HTTPS')
  }
  await next()
}
```

`server/src/routes/health.ts`：

```ts
import Router from '@koa/router'

export function registerHealth(router: Router): void {
  router.get('/api/health', (ctx) => {
    ctx.status = 200
    ctx.body = { ok: true }
  })
}
```

`server/src/app.ts`：

```ts
import Koa from 'koa'
import Router from '@koa/router'
import { bodyParser } from '@koa/bodyparser'
import type { AppDeps } from './db/ports.ts'
import { errorHandler } from './middleware/errorHandler.ts'
import { httpsGuard } from './middleware/https.ts'
import { registerHealth } from './routes/health.ts'

export function createApp(deps: AppDeps): Koa {
  const app = new Koa()
  app.use(async (ctx, next) => {
    ctx.state.deps = deps
    await next()
  })
  app.use(errorHandler)
  app.use(httpsGuard)
  app.use(
    bodyParser({
      jsonLimit: '512kb',
      enableTypes: ['json'],
    }),
  )
  const router = new Router()
  registerHealth(router)
  app.use(router.routes())
  app.use(router.allowedMethods())
  return app
}
```

`server/src/index.ts`（本任务只要求能 typecheck；真实 listen 在接上 mysql/redis 的 Task 2 后再补全。本任务用占位 deps 会让生产起不来——**不要**在 index 里写死密钥。最小可编译入口：）

```ts
import { loadEnv } from './env.ts'

try {
  loadEnv(process.env)
} catch (error) {
  const text = error instanceof Error ? error.message : 'missing env'
  console.error(text.startsWith('missing env') ? 'missing env' : 'missing env')
  process.exit(1)
}

console.error('server bootstrap continues in later tasks')
```

`server/tests/helpers.ts`：

```ts
import http from 'node:http'
import type Koa from 'koa'

export async function listen(app: Koa): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(app.callback())
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('listen failed')
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  }
}
```

`server/tests/fakes.ts`（本任务只需让 `createApp` 拿到 `env`；mysql/redis/wechat 先空实现，后续任务填满）：

```ts
import { loadEnv, type Env } from '../src/env.ts'
import type { AppDeps, MysqlPort, RedisPort, WechatPort } from '../src/db/ports.ts'

export function baseEnv(patch: Partial<Env> = {}): Env {
  return {
    ...loadEnv({
      WECHAT_APPID: 'wx678305a130615b19',
      WECHAT_APPSECRET: 'x'.repeat(32),
      MYSQL_HOST: '127.0.0.1',
      MYSQL_USER: 'fd',
      MYSQL_PASSWORD: 'secret',
      MYSQL_DATABASE: 'furniture',
      REDIS_HOST: '127.0.0.1',
      REDIS_PASSWORD: 'redis-secret',
      SESSION_SECRET: 's'.repeat(32),
      NODE_ENV: 'development',
    }),
    ...patch,
  }
}

export function memoryMysql(): MysqlPort {
  return {
    async upsertUserByOpenid() {
      throw new Error('mysql not used in task 1')
    },
    async listSyncItems() {
      return []
    },
    async getSyncItem() {
      return null
    },
    async upsertSyncItem() {},
    async withTransaction(fn) {
      return fn(this)
    },
  }
}

export function memoryRedis(): RedisPort {
  const store = new Map<string, { value: string; exp: number }>()
  const now = () => Date.now()
  const live = (key: string) => {
    const row = store.get(key)
    if (!row) return null
    if (row.exp !== 0 && row.exp < now()) {
      store.delete(key)
      return null
    }
    return row
  }
  return {
    async get(key) {
      return live(key)?.value ?? null
    },
    async set(key, value, ttlSeconds) {
      store.set(key, { value, exp: ttlSeconds > 0 ? now() + ttlSeconds * 1000 : 0 })
    },
    async del(key) {
      store.delete(key)
    },
    async expire(key, ttlSeconds) {
      const row = live(key)
      if (row) store.set(key, { value: row.value, exp: now() + ttlSeconds * 1000 })
    },
    async incr(key) {
      const current = Number(live(key)?.value ?? '0')
      const next = current + 1
      const exp = live(key)?.exp ?? now() + 60_000
      store.set(key, { value: String(next), exp })
      return next
    },
  }
}

export function testDeps(patch: { env?: Partial<Env> } = {}): AppDeps {
  return {
    env: baseEnv(patch.env),
    mysql: memoryMysql(),
    redis: memoryRedis(),
    wechat: {
      async code2Session() {
        return { errcode: -1 }
      },
    } satisfies WechatPort,
    clock: () => new Date('2026-11-03T12:00:00.000Z'),
    randomBytes: (size) => Buffer.alloc(size, 7),
    uuid: () => '11111111-1111-4111-8111-111111111111',
  }
}
```

README 在「本地运行」代码块后追加（不要在本任务改简介里的「不登录」——那是 Task 9）：

```md
后端（仓库根目录 `server/`，自有 package.json）：

```bash
pnpm --dir server install
pnpm --dir server test
pnpm --dir server dev
```

`server/.env` 只放在本机，变量名见 `server/.env.example`。不要把 AppSecret 或数据库密码写进仓库。
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --test server/tests/env.test.ts server/tests/health.test.ts
```

Expected: PASS。若 `REDIS_DB` 空字符串路径失败，按 `loadEnv` 实现修，不要放宽 production 密钥。

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/tabs.test.ts
```

Expected: PASS（weapp 尚未改 pages）。

确认根 `package.json` 的 `dependencies` / `devDependencies` **没有** `koa`、`mysql2`、`ioredis`。

- [ ] **Step 5: Commit**

```bash
git add server package.json README.md
git commit -m "feat(server): scaffold Koa2 env loader and health endpoint"
```

---

### Task 2: MySQL schema 与 Redis 会话助手

**Files:**
- Create: `server/src/db/schema.sql`
- Create: `server/src/db/mysql.ts`
- Create: `server/src/db/redis.ts`
- Create: `server/src/services/session.ts`
- Create: `server/tests/schema.test.ts`
- Create: `server/tests/session.test.ts`
- Modify: `server/src/index.ts`（接真实驱动；缺 env 仍拒绝 listen）
- Modify: `server/tests/fakes.ts`（补齐 `memoryMysql` 的 users / sync_items 行为，供后续任务）

**Interfaces:**
- Consumes: Task 1 的 `Env` / `MysqlPort` / `RedisPort` / `randomBytes`
- Produces:
  - `schema.sql` 含表 `users`、`sync_items`，列名与设计一致
  - `signSid(secret: string, sid: string): string`
  - `createSessionToken(secret: string, sid: string): string` → `{sid}.{sig}`
  - `verifySessionToken(secret: string, token: string): string | null`（返回 sid，HMAC 失败返回 `null`）
  - `sessionKey(sid: string): string` → `sess:{sid}`
  - `SESSION_TTL_SECONDS = 2592000`
  - `createMysql(env: Env): MysqlPort`
  - `createRedis(env: Env): RedisPort`

- [ ] **Step 1: Write the failing test**

`server/tests/schema.test.ts`：

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const SQL = readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf8')

test('schema defines users and sync_items with locked columns', () => {
  assert.match(SQL, /CREATE TABLE[\s\S]*users/i)
  assert.match(SQL, /openid VARCHAR\(64\)/)
  assert.match(SQL, /UNIQUE/)
  assert.equal(/phone/i.test(SQL), false)
  assert.equal(/session_key/i.test(SQL), false)
  assert.equal(/nickname/i.test(SQL), false)
  assert.match(SQL, /CREATE TABLE[\s\S]*sync_items/i)
  assert.match(SQL, /ENUM\('favorite','plan','budget','scan','aiPreview','preference'\)/)
  assert.match(SQL, /PRIMARY KEY \(user_id, kind, item_id\)/)
  assert.match(SQL, /ON DELETE CASCADE/)
  assert.match(SQL, /utf8mb4/)
})
```

`server/tests/session.test.ts`：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SESSION_TTL_SECONDS,
  createSessionToken,
  sessionKey,
  signSid,
  verifySessionToken,
} from '../src/services/session.ts'
import { memoryRedis } from './fakes.ts'

const SECRET = 's'.repeat(32)
const OTHER = 't'.repeat(32)

test('token is sid.sig and HMAC must match SESSION_SECRET', () => {
  const sid = 'abcdefghijklmnopqrstuvwxyz012345'
  const token = createSessionToken(SECRET, sid)
  assert.equal(token, `${sid}.${signSid(SECRET, sid)}`)
  assert.equal(verifySessionToken(SECRET, token), sid)
  assert.equal(verifySessionToken(OTHER, token), null)
  assert.equal(verifySessionToken(SECRET, `${sid}.aaaa`), null)
  assert.equal(verifySessionToken(SECRET, 'noperiod'), null)
  assert.equal(sessionKey(sid), `sess:${sid}`)
  assert.equal(SESSION_TTL_SECONDS, 2592000)
})

test('redis session round-trip stores only userId JSON', async () => {
  const redis = memoryRedis()
  const sid = 'sid-1'
  await redis.set(sessionKey(sid), JSON.stringify({ userId: 'user-1' }), SESSION_TTL_SECONDS)
  assert.deepEqual(JSON.parse((await redis.get(sessionKey(sid)))!), { userId: 'user-1' })
  await redis.del(sessionKey(sid))
  assert.equal(await redis.get(sessionKey(sid)), null)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --test server/tests/schema.test.ts server/tests/session.test.ts
```

Expected: FAIL（缺 `schema.sql` / `createSessionToken`）。

- [ ] **Step 3: Write minimal implementation**

`server/src/db/schema.sql`：

```sql
CREATE DATABASE IF NOT EXISTS furniture DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 实际库名以 MYSQL_DATABASE 为准；本文件供人工在 ECS 执行。

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  openid VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  last_login_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_items (
  user_id CHAR(36) NOT NULL,
  kind ENUM('favorite','plan','budget','scan','aiPreview','preference') NOT NULL,
  item_id VARCHAR(64) NOT NULL,
  payload JSON NULL,
  updated_at DATETIME(3) NOT NULL,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (user_id, kind, item_id),
  KEY idx_sync_user_updated (user_id, updated_at),
  CONSTRAINT fk_sync_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`server/src/services/session.ts`：

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_TTL_SECONDS = 2592000

export function sessionKey(sid: string): string {
  return `sess:${sid}`
}

export function signSid(secret: string, sid: string): string {
  return createHmac('sha256', secret).update(sid).digest('base64url')
}

export function createSessionToken(secret: string, sid: string): string {
  return `${sid}.${signSid(secret, sid)}`
}

export function verifySessionToken(secret: string, token: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const sid = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = signSid(secret, sid)
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length) return null
  if (!timingSafeEqual(left, right)) return null
  return sid
}

export function encodeSid(bytes: Buffer): string {
  return bytes.toString('base64url')
}
```

`server/src/db/mysql.ts`（真实驱动；测试不调用，只保证 typecheck / 生产可接）：

```ts
import mysql from 'mysql2/promise'
import type { Env } from '../env.ts'
import type { MysqlPort, SyncItemRow, UserRow } from './ports.ts'
import type { SyncKind } from '../types/sync.ts'

export function createMysql(env: Env): MysqlPort {
  const pool = mysql.createPool({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  })

  const bind = (conn: mysql.Pool | mysql.PoolConnection): MysqlPort => ({
    async upsertUserByOpenid(openid, now, id) {
      const [existing] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id, openid, created_at, updated_at, last_login_at FROM users WHERE openid = ? LIMIT 1',
        [openid],
      )
      if (existing.length > 0) {
        const row = existing[0]
        await conn.execute(
          'UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?',
          [now, now, row.id],
        )
        return {
          id: String(row.id),
          openid: String(row.openid),
          created_at: new Date(row.created_at),
          updated_at: now,
          last_login_at: now,
        }
      }
      await conn.execute(
        'INSERT INTO users (id, openid, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?)',
        [id, openid, now, now, now],
      )
      return { id, openid, created_at: now, updated_at: now, last_login_at: now }
    },
    async listSyncItems(userId) {
      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT user_id, kind, item_id, payload, updated_at, deleted, created_at FROM sync_items WHERE user_id = ?',
        [userId],
      )
      return rows.map(mapRow)
    },
    async getSyncItem(userId, kind, itemId) {
      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT user_id, kind, item_id, payload, updated_at, deleted, created_at FROM sync_items WHERE user_id = ? AND kind = ? AND item_id = ? LIMIT 1',
        [userId, kind, itemId],
      )
      return rows[0] ? mapRow(rows[0]) : null
    },
    async upsertSyncItem(row) {
      await conn.execute(
        `INSERT INTO sync_items (user_id, kind, item_id, payload, updated_at, deleted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at), deleted = VALUES(deleted)`,
        [
          row.user_id,
          row.kind,
          row.item_id,
          row.payload == null ? null : JSON.stringify(row.payload),
          row.updated_at,
          row.deleted,
          row.created_at,
        ],
      )
    },
    async withTransaction(fn) {
      if ('getConnection' in conn) {
        const connection = await pool.getConnection()
        try {
          await connection.beginTransaction()
          const result = await fn(bind(connection))
          await connection.commit()
          return result
        } catch (error) {
          await connection.rollback()
          throw error
        } finally {
          connection.release()
        }
      }
      return fn(bind(conn))
    },
  })

  return bind(pool)
}

function mapRow(row: mysql.RowDataPacket): SyncItemRow {
  return {
    user_id: String(row.user_id),
    kind: row.kind as SyncKind,
    item_id: String(row.item_id),
    payload: row.payload == null ? null : typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    updated_at: new Date(row.updated_at),
    deleted: row.deleted ? 1 : 0,
    created_at: new Date(row.created_at),
  }
}

export type { UserRow }
```

`server/src/db/redis.ts`：

```ts
import Redis from 'ioredis'
import type { Env } from '../env.ts'
import type { RedisPort } from './ports.ts'

export function createRedis(env: Env): RedisPort {
  const client = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD.length > 0 ? env.REDIS_PASSWORD : undefined,
    db: env.REDIS_DB,
  })
  return {
    get: (key) => client.get(key),
    async set(key, value, ttlSeconds) {
      if (ttlSeconds > 0) await client.set(key, value, 'EX', ttlSeconds)
      else await client.set(key, value)
    },
    async del(key) {
      await client.del(key)
    },
    async expire(key, ttlSeconds) {
      await client.expire(key, ttlSeconds)
    },
    incr: (key) => client.incr(key),
  }
}
```

把 `server/tests/fakes.ts` 的 `memoryMysql` 换成可用的内存实现（后续 login/sync 测试依赖）：

```ts
export function memoryMysql(): MysqlPort {
  const users = new Map<string, UserRow>()
  const items = new Map<string, SyncItemRow>()
  const itemKey = (userId: string, kind: string, itemId: string) => `${userId}|${kind}|${itemId}`
  const api: MysqlPort = {
    async upsertUserByOpenid(openid, now, id) {
      for (const row of users.values()) {
        if (row.openid === openid) {
          const next = { ...row, updated_at: now, last_login_at: now }
          users.set(row.id, next)
          return next
        }
      }
      const created: UserRow = { id, openid, created_at: now, updated_at: now, last_login_at: now }
      users.set(id, created)
      return created
    },
    async listSyncItems(userId) {
      return [...items.values()].filter((row) => row.user_id === userId)
    },
    async getSyncItem(userId, kind, itemId) {
      return items.get(itemKey(userId, kind, itemId)) ?? null
    },
    async upsertSyncItem(row) {
      items.set(itemKey(row.user_id, row.kind, row.item_id), row)
    },
    async withTransaction(fn) {
      return fn(api)
    },
  }
  return api
}
```

并在 `fakes.ts` 顶部补 `import type { UserRow, SyncItemRow } from '../src/db/ports.ts'`。

`server/src/index.ts` 全文换成：

```ts
import { createApp } from './app.ts'
import { createMysql } from './db/mysql.ts'
import { createRedis } from './db/redis.ts'
import { loadEnv } from './env.ts'
import { createWechat } from './services/wechat.ts'
import { randomBytes, randomUUID } from 'node:crypto'

function fail(): never {
  console.error('missing env')
  process.exit(1)
}

let env
try {
  env = loadEnv(process.env)
} catch {
  fail()
}

const app = createApp({
  env,
  mysql: createMysql(env),
  redis: createRedis(env),
  wechat: createWechat(env),
  clock: () => new Date(),
  randomBytes,
  uuid: () => randomUUID(),
})

app.listen(env.PORT, () => {
  console.log(`listening on ${env.PORT}`)
})
```

本任务 `createWechat` 还不存在。为让 `index.ts` 能过后续 typecheck，先在 `server/src/services/wechat.ts` 放一个会在 Task 3 被测试锁死的骨架：

```ts
import type { Env } from '../env.ts'
import type { WechatPort } from '../db/ports.ts'

export function createWechat(env: Env): WechatPort {
  return {
    async code2Session() {
      void env
      return { errcode: -1 }
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --test server/tests/schema.test.ts server/tests/session.test.ts server/tests/env.test.ts server/tests/health.test.ts
```

Expected: PASS。`rg -n "phone|session_key" server/src/db/schema.sql` 无业务列匹配（`phone` 不得出现）。

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat(server): add MySQL schema and HMAC Redis session helpers"
```

---

### Task 3: POST /api/auth/login 与 logout（测试 mock WeChat）

**Files:**
- Modify: `server/src/services/wechat.ts`
- Create: `server/src/services/rateLimit.ts`
- Create: `server/src/routes/auth.ts`
- Modify: `server/src/app.ts`（注册 auth 路由）
- Create: `server/tests/auth-login.test.ts`

**Interfaces:**
- Consumes: `WechatPort.code2Session(code)`、`MysqlPort.upsertUserByOpenid`、`createSessionToken`、`SESSION_TTL_SECONDS`、`RedisPort`
- Produces:
  - `POST /api/auth/login` body `{ code: string }` → `200 { token, expiresIn: 2592000, user: { id } }`
  - 错误码：`INVALID_CODE` 401、`RATE_LIMITED` 429、`WECHAT_UNAVAILABLE` 502
  - `POST /api/auth/logout` 本任务可先 401（无 Bearer 中间件）；完整 204 在 Task 4 接上 auth 后锁定
  - `createWechat(env)`：`GET https://api.weixin.qq.com/sns/jscode2session?...`，`AbortSignal` 5s
  - 登录限流键 `rl:login:{ip}`，60 秒 20 次
  - 响应 JSON 不得出现 `openid` / `session_key` / `unionid`
  - 生产环境带 `X-Forwarded-Proto: https` 时登录成功；缺少该头时仍为 `400 VALIDATION_ERROR`
  - 处理器与 `createWechat` 不得 `console.log` / `console.error` `code`、token、openid、AppSecret

- [ ] **Step 1: Write the failing test**

`server/tests/auth-login.test.ts`：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { SESSION_TTL_SECONDS, sessionKey, verifySessionToken } from '../src/services/session.ts'
import { testDeps } from './fakes.ts'
import { listen } from './helpers.ts'
import type { AppDeps } from '../src/db/ports.ts'

async function postLogin(url: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function depsWithWechat(wechat: AppDeps['wechat'], extra: Parameters<typeof testDeps>[0] = {}) {
  const deps = testDeps(extra)
  deps.wechat = wechat
  return deps
}

test('login exchanges code for token without leaking openid', async () => {
  const deps = depsWithWechat({
    async code2Session(code) {
      assert.equal(code, 'wx-one-time')
      return { openid: 'oid-secret' }
    },
  })
  const { url, close } = await listen(createApp(deps))
  try {
    const res = await postLogin(url, { code: 'wx-one-time' })
    assert.equal(res.status, 200)
    const json = (await res.json()) as {
      token: string
      expiresIn: number
      user: { id: string }
    }
    assert.equal(json.expiresIn, SESSION_TTL_SECONDS)
    assert.equal(json.user.id, '11111111-1111-4111-8111-111111111111')
    const raw = JSON.stringify(json)
    assert.equal(raw.includes('oid-secret'), false)
    assert.equal(raw.includes('session_key'), false)
    assert.equal(raw.includes('unionid'), false)
    const sid = verifySessionToken(deps.env.SESSION_SECRET, json.token)
    assert.ok(sid)
    const sess = await deps.redis.get(sessionKey(sid!))
    assert.deepEqual(JSON.parse(sess!), { userId: json.user.id })
  } finally {
    await close()
  }
})

test('missing, empty, oversized, or WeChat 40029/40163 map to INVALID_CODE', async () => {
  for (const [wechat, body] of [
    [
      { async code2Session() { return { errcode: 40029 } } },
      { code: 'used' },
    ],
    [
      { async code2Session() { return { errcode: 40163 } } },
      { code: 'used2' },
    ],
  ] as const) {
    const { url, close } = await listen(createApp(depsWithWechat(wechat)))
    try {
      const res = await postLogin(url, body)
      assert.equal(res.status, 401)
      assert.equal((await res.json()).error.code, 'INVALID_CODE')
    } finally {
      await close()
    }
  }
  const { url, close } = await listen(createApp(testDeps()))
  try {
    for (const body of [{}, { code: '' }, { code: 'a'.repeat(129) }, { code: 1 }]) {
      const res = await postLogin(url, body)
      assert.equal(res.status, 401)
      assert.equal((await res.json()).error.code, 'INVALID_CODE')
    }
  } finally {
    await close()
  }
})

test('WeChat timeout or http 5xx maps to WECHAT_UNAVAILABLE', async () => {
  const { url, close } = await listen(
    createApp(
      depsWithWechat({
        async code2Session() {
          return { errcode: -1, httpStatus: 503 }
        },
      }),
    ),
  )
  try {
    const res = await postLogin(url, { code: 'wx' })
    assert.equal(res.status, 502)
    assert.equal((await res.json()).error.code, 'WECHAT_UNAVAILABLE')
  } finally {
    await close()
  }
})

test('production login succeeds only with X-Forwarded-Proto https', async () => {
  const deps = depsWithWechat(
    { async code2Session() { return { openid: 'oid-https' } } },
    { env: { NODE_ENV: 'production' } },
  )
  const { url, close } = await listen(createApp(deps))
  try {
    const blocked = await postLogin(url, { code: 'wx' })
    assert.equal(blocked.status, 400)
    const ok = await postLogin(url, { code: 'wx' }, { 'x-forwarded-proto': 'https' })
    assert.equal(ok.status, 200)
  } finally {
    await close()
  }
})

test('21st login from the same IP within 60s is RATE_LIMITED', async () => {
  const deps = depsWithWechat({
    async code2Session() {
      return { openid: 'oid-rl' }
    },
  })
  const { url, close } = await listen(createApp(deps))
  try {
    for (let i = 0; i < 20; i += 1) {
      const res = await postLogin(url, { code: `c${i}` }, { 'x-forwarded-for': '203.0.113.9' })
      assert.equal(res.status, 200)
    }
    const blocked = await postLogin(url, { code: 'c21' }, { 'x-forwarded-for': '203.0.113.9' })
    assert.equal(blocked.status, 429)
    assert.equal((await blocked.json()).error.code, 'RATE_LIMITED')
  } finally {
    await close()
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --test server/tests/auth-login.test.ts
```

Expected: FAIL（`/api/auth/login` 404 或无法登录）。

- [ ] **Step 3: Write minimal implementation**

`server/src/services/wechat.ts` 全文：

```ts
import type { Env } from '../env.ts'
import type { WechatPort } from '../db/ports.ts'

export function createWechat(env: Env): WechatPort {
  return {
    async code2Session(code) {
      const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
      url.searchParams.set('appid', env.WECHAT_APPID)
      url.searchParams.set('secret', env.WECHAT_APPSECRET)
      url.searchParams.set('js_code', code)
      url.searchParams.set('grant_type', 'authorization_code')
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 5000)
      try {
        const res = await fetch(url, { signal: ac.signal })
        if (res.status >= 500) return { errcode: -1, httpStatus: res.status }
        const json = (await res.json()) as { openid?: string; errcode?: number }
        if (typeof json.openid === 'string' && json.openid.length > 0) {
          return { openid: json.openid }
        }
        return { errcode: json.errcode ?? -1, httpStatus: res.status }
      } catch {
        return { errcode: -1, httpStatus: 503 }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
```

`server/src/services/rateLimit.ts`：

```ts
import { ApiError } from '../errors.ts'
import type { RedisPort } from '../db/ports.ts'

export async function hitRateLimit(
  redis: RedisPort,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, windowSeconds)
  if (count > limit) throw new ApiError(429, 'RATE_LIMITED', '请求过于频繁')
}

export function loginRateKey(ip: string): string {
  return `rl:login:${ip}`
}

export function syncRateKey(userId: string): string {
  return `rl:sync:${userId}`
}
```

`server/src/routes/auth.ts`：

```ts
import Router from '@koa/router'
import type { AppDeps } from '../db/ports.ts'
import { ApiError } from '../errors.ts'
import { hitRateLimit, loginRateKey } from '../services/rateLimit.ts'
import { SESSION_TTL_SECONDS, createSessionToken, encodeSid, sessionKey } from '../services/session.ts'

function clientIp(ctx: { ip: string; get: (h: string) => string }): string {
  const forwarded = ctx.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return ctx.ip || '0.0.0.0'
}

export function registerAuth(router: Router): void {
  router.post('/api/auth/login', async (ctx) => {
    const deps = ctx.state.deps as AppDeps
    const body = ctx.request.body as { code?: unknown }
    const code = body?.code
    if (typeof code !== 'string' || code.length === 0 || code.length > 128) {
      throw new ApiError(401, 'INVALID_CODE', '登录已过期，请再点一次')
    }
    await hitRateLimit(deps.redis, loginRateKey(clientIp(ctx)), 20, 60)
    const wx = await deps.wechat.code2Session(code)
    if ('openid' in wx) {
      const now = deps.clock()
      const user = await deps.mysql.upsertUserByOpenid(wx.openid, now, deps.uuid())
      const sid = encodeSid(deps.randomBytes(32))
      const token = createSessionToken(deps.env.SESSION_SECRET, sid)
      await deps.redis.set(sessionKey(sid), JSON.stringify({ userId: user.id }), SESSION_TTL_SECONDS)
      ctx.status = 200
      ctx.body = { token, expiresIn: SESSION_TTL_SECONDS, user: { id: user.id } }
      return
    }
    if (wx.httpStatus != null && wx.httpStatus >= 500) {
      throw new ApiError(502, 'WECHAT_UNAVAILABLE', '登录失败，请重试')
    }
    if (wx.errcode === -1) {
      throw new ApiError(502, 'WECHAT_UNAVAILABLE', '登录失败，请重试')
    }
    throw new ApiError(401, 'INVALID_CODE', '登录已过期，请再点一次')
  })
  // 本函数禁止 console.log code / token / openid / AppSecret；需要排障时只记 user.id 与微信 errcode。

  router.post('/api/auth/logout', async (ctx) => {
    ctx.status = 401
    ctx.body = { error: { code: 'UNAUTHORIZED', message: '请重新登录' } }
  })
}
```

在 `server/src/app.ts` 的 `registerHealth(router)` 之后调用 `registerAuth(router)`。

Koa 默认 `app.proxy` 在测试里可不设；IP 从 `x-forwarded-for` 读取即可。`memoryRedis.incr` 必须在键不存在时设置 60s 过期——`hitRateLimit` 在 `count === 1` 时 `expire`。若当前 fake 的 `incr` 在无 key 时把 `exp` 设成 `now+60s`，与测试兼容。

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --test server/tests/auth-login.test.ts server/tests/health.test.ts
```

Expected: PASS。登录成功体没有 `openid`。

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat(server): add WeChat code2Session login with rate limit"
```

---

### Task 4: Bearer 鉴权中间件（HMAC → Redis）

**Files:**
- Create: `server/src/middleware/auth.ts`
- Modify: `server/src/routes/auth.ts`（logout 删除 `sess:{sid}`，204）
- Modify: `server/src/app.ts`（/api/sync 与 /api/auth/logout 走鉴权；login/health 除外）
- Create: `server/tests/auth-middleware.test.ts`

**Interfaces:**
- Consumes: `verifySessionToken`、`sessionKey`、`SESSION_TTL_SECONDS`、`RedisPort.get` / `expire`
- Produces:
  - `requireAuth(ctx, next)`：缺 Bearer / HMAC 失败 / Redis miss → `401 UNAUTHORIZED` `{ error: { code: "UNAUTHORIZED", message: "请重新登录" } }`
  - 成功时 `ctx.state.userId: string`、`ctx.state.sid: string`，并 `EXPIRE sess:{sid} 2592000`
  - `POST /api/auth/logout` 需要 Bearer，删会话，`204` 空 body
  - 除 `/api/auth/login` 与 `/api/health` 外全部要 Bearer（含未来 `/api/sync`）

- [ ] **Step 1: Write the failing test**

`server/tests/auth-middleware.test.ts`（覆盖缺 Bearer、坏 HMAC、Redis miss、滑动续期、logout 204）：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { SESSION_TTL_SECONDS, createSessionToken, encodeSid, sessionKey } from '../src/services/session.ts'
import { testDeps } from './fakes.ts'
import { listen } from './helpers.ts'

test('sync and logout require a live HMAC+Redis session', async () => {
  const deps = testDeps()
  deps.wechat = { async code2Session() { return { openid: 'oid-a' } } }
  const { url, close } = await listen(createApp(deps))
  try {
    const missing = await fetch(`${url}/api/sync`)
    assert.equal(missing.status, 401)
    assert.equal((await missing.json()).error.message, '请重新登录')

    const bad = await fetch(`${url}/api/sync`, { headers: { authorization: 'Bearer not-a-token' } })
    assert.equal(bad.status, 401)

    const loginRes = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'wx' }),
    })
    const { token } = (await loginRes.json()) as { token: string }
    const ok = await fetch(`${url}/api/sync`, { headers: { authorization: `Bearer ${token}` } })
    assert.notEqual(ok.status, 401)

    const sid = encodeSid(Buffer.alloc(32, 7))
    await deps.redis.del(sessionKey(sid))
    const miss = await fetch(`${url}/api/sync`, { headers: { authorization: `Bearer ${token}` } })
    assert.equal(miss.status, 401)

    const forged = createSessionToken('u'.repeat(32), sid)
    const hmacFail = await fetch(`${url}/api/sync`, {
      headers: { authorization: `Bearer ${forged}` },
    })
    assert.equal(hmacFail.status, 401)
  } finally {
    await close()
  }
})

test('logout deletes redis session and returns 204', async () => {
  const deps = testDeps()
  deps.wechat = { async code2Session() { return { openid: 'oid-b' } } }
  const { url, close } = await listen(createApp(deps))
  try {
    const loginRes = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'wx' }),
    })
    const { token } = (await loginRes.json()) as { token: string }
    const sid = encodeSid(Buffer.alloc(32, 7))
    assert.ok(await deps.redis.get(sessionKey(sid)))
    const res = await fetch(`${url}/api/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    assert.equal(res.status, 204)
    assert.equal(await res.text(), '')
    assert.equal(await deps.redis.get(sessionKey(sid)), null)
    const again = await fetch(`${url}/api/sync`, { headers: { authorization: `Bearer ${token}` } })
    assert.equal(again.status, 401)
  } finally {
    await close()
  }
})

test('successful auth refreshes session TTL', async () => {
  const deps = testDeps()
  deps.wechat = { async code2Session() { return { openid: 'oid-c' } } }
  let expireCalls = 0
  const inner = deps.redis.expire.bind(deps.redis)
  deps.redis.expire = async (key, ttl) => {
    expireCalls += 1
    assert.equal(ttl, SESSION_TTL_SECONDS)
    await inner(key, ttl)
  }
  const { url, close } = await listen(createApp(deps))
  try {
    const loginRes = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'wx' }),
    })
    const { token } = (await loginRes.json()) as { token: string }
    await fetch(`${url}/api/sync`, { headers: { authorization: `Bearer ${token}` } })
    assert.ok(expireCalls >= 1)
  } finally {
    await close()
  }
})
```

注意：本任务结束前 `GET /api/sync` 可以 404，但**不能** 401 以外的「没走中间件」。测试用 `assert.notEqual(ok.status, 401)` 允许 404，直到 Task 5 实现同步。

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --test server/tests/auth-middleware.test.ts
```

Expected: FAIL（logout 仍 401，或 /api/sync 未走 Bearer）。

- [ ] **Step 3: Write minimal implementation**

`server/src/middleware/auth.ts`：

```ts
import type { Context, Next } from 'koa'
import type { AppDeps } from '../db/ports.ts'
import { ApiError } from '../errors.ts'
import { SESSION_TTL_SECONDS, sessionKey, verifySessionToken } from '../services/session.ts'

export async function requireAuth(ctx: Context, next: Next): Promise<void> {
  const deps = ctx.state.deps as AppDeps
  const header = ctx.get('authorization')
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) {
    throw new ApiError(401, 'UNAUTHORIZED', '请重新登录')
  }
  const token = header.slice(prefix.length).trim()
  const sid = verifySessionToken(deps.env.SESSION_SECRET, token)
  if (sid == null) throw new ApiError(401, 'UNAUTHORIZED', '请重新登录')
  const raw = await deps.redis.get(sessionKey(sid))
  if (raw == null) throw new ApiError(401, 'UNAUTHORIZED', '请重新登录')
  let userId = ''
  try {
    userId = JSON.parse(raw).userId
  } catch {
    throw new ApiError(401, 'UNAUTHORIZED', '请重新登录')
  }
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new ApiError(401, 'UNAUTHORIZED', '请重新登录')
  }
  await deps.redis.expire(sessionKey(sid), SESSION_TTL_SECONDS)
  ctx.state.userId = userId
  ctx.state.sid = sid
  await next()
}
```

`server/src/routes/auth.ts` 的 logout 换成：

```ts
  router.post('/api/auth/logout', requireAuth, async (ctx) => {
    const deps = ctx.state.deps as AppDeps
    await deps.redis.del(sessionKey(ctx.state.sid as string))
    ctx.status = 204
    ctx.body = null
  })
```

`server/src/routes/auth.ts` 顶部增加 `import { requireAuth } from '../middleware/auth.ts'`。

`server/src/app.ts` 在 router 上为同步预挂中间件（Task 5 用 `registerSync` 换掉这两条；本任务必须让 `/api/sync` 先经过 `requireAuth`，鉴权通过后返回 404，不要返回业务快照）：

```ts
import { registerAuth } from './routes/auth.ts'
import { requireAuth } from './middleware/auth.ts'

  registerHealth(router)
  registerAuth(router)
  router.get('/api/sync', requireAuth, (ctx) => {
    ctx.status = 404
    ctx.body = { error: { code: 'INTERNAL', message: '服务器错误' } }
  })
  router.put('/api/sync', requireAuth, (ctx) => {
    ctx.status = 404
    ctx.body = { error: { code: 'INTERNAL', message: '服务器错误' } }
  })
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --test server/tests/auth-middleware.test.ts server/tests/auth-login.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat(server): authenticate Bearer tokens via HMAC and Redis"
```

---

### Task 5: GET/PUT /api/sync（updatedAt 新者胜）

**Files:**
- Create: `server/src/domain/enums.ts`
- Create: `server/src/services/merge.ts`
- Create: `server/src/services/validateSync.ts`
- Create: `server/src/routes/sync.ts`
- Modify: `server/src/app.ts`（用 `registerSync` 替换占位）
- Create: `server/tests/merge.test.ts`
- Create: `server/tests/sync.test.ts`
- Modify: `server/src/types/sync.ts`（补 payload 形状注释类型）

**Interfaces:**
- Consumes: `SyncItem`、`MysqlPort`、`requireAuth`、`hitRateLimit` + `syncRateKey`（60/60s）
- Produces:
  - `clampUpdatedAt(client: Date, serverNow: Date): Date` — 超前 > 10 分钟钳成 `serverNow`
  - `shouldTakeIncoming(incoming: Date, existing: Date | null): boolean` — `existing == null` 或 `incoming > existing`
  - `GET /api/sync` → `{ serverTime, items }`（含 tombstone；空用户 `items: []`）
  - `PUT /api/sync` body `{ clientTime, items }`，单事务合并后返回完整快照
  - 扫描 payload 落库前 `photoPaths = []`
  - 上限：favorite 200、plan 50、budget 50、scan 50、aiPreview 50、preference 1、tombstone（`deleted:true`）合计 400；超限 `VALIDATION_ERROR`
  - `deleted === true` 时 `payload === null`，否则 `VALIDATION_ERROR`
  - 未在请求中出现的行保持不变
  - 忽略任何客户端 userId 字段（请求体本来就没有）
  - 服务端不得改写 `itemId` / `plan.id`；跨用户允许相同 `plan-…` 字符串

- [ ] **Step 1: Write the failing test**

`server/tests/merge.test.ts`：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { clampUpdatedAt, shouldTakeIncoming } from '../src/services/merge.ts'

const T1 = new Date('2026-11-03T12:00:00.000Z')
const T2 = new Date('2026-11-03T12:00:01.000Z')
const NOW = new Date('2026-11-03T12:00:00.000Z')

test('incoming wins only when strictly later; equal keeps server', () => {
  assert.equal(shouldTakeIncoming(T1, null), true)
  assert.equal(shouldTakeIncoming(T2, T1), true)
  assert.equal(shouldTakeIncoming(T1, T2), false)
  assert.equal(shouldTakeIncoming(T1, T1), false)
})

test('client clock more than 10 minutes ahead is clamped', () => {
  const fast = new Date('2026-11-03T12:11:00.001Z')
  const clamped = clampUpdatedAt(fast, NOW)
  assert.equal(clamped.toISOString(), NOW.toISOString())
  const ok = new Date('2026-11-03T12:09:00.000Z')
  assert.equal(clampUpdatedAt(ok, NOW).toISOString(), ok.toISOString())
})
```

`server/tests/sync.test.ts`（核心路径；实现时保持这些断言不变）：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { testDeps } from './fakes.ts'
import { listen } from './helpers.ts'

async function authed(url: string, token: string, method: 'GET' | 'PUT', body?: unknown) {
  return fetch(`${url}/api/sync`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function start() {
  const deps = testDeps()
  deps.wechat = { async code2Session() { return { openid: 'oid-sync' } } }
  const started = await listen(createApp(deps))
  const login = await fetch(`${started.url}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'wx' }),
  })
  const { token, user } = (await login.json()) as { token: string; user: { id: string } }
  return { ...started, token, user, deps }
}

const planPayload = {
  id: 'plan-abc',
  title: '客厅',
  roomType: 'living',
  areaM2: 20,
  stage: 'measure',
  productIds: [],
  createdAt: '2026-11-03T11:00:00.000Z',
  updatedAt: '2026-11-03T12:00:00.000Z',
}

test('empty GET then PUT insert, equal timestamp keeps server, later overwrites', async () => {
  const { url, close, token } = await start()
  try {
    const empty = await authed(url, token, 'GET')
    assert.equal(empty.status, 200)
    const emptyBody = await empty.json()
    assert.equal(emptyBody.serverTime, '2026-11-03T12:00:00.000Z')
    assert.deepEqual(emptyBody.items, [])

    const first = await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.100Z',
      items: [
        {
          kind: 'plan',
          itemId: 'plan-abc',
          updatedAt: '2026-11-03T12:00:00.000Z',
          deleted: false,
          payload: planPayload,
        },
      ],
    })
    assert.equal(first.status, 200)
    assert.equal((await first.json()).items[0].payload.title, '客厅')

    const stale = await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.200Z',
      items: [
        {
          kind: 'plan',
          itemId: 'plan-abc',
          updatedAt: '2026-11-03T12:00:00.000Z',
          deleted: false,
          payload: { ...planPayload, title: '旧标题会被丢掉' },
        },
      ],
    })
    assert.equal((await stale.json()).items[0].payload.title, '客厅')

    const newer = await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.300Z',
      items: [
        {
          kind: 'plan',
          itemId: 'plan-abc',
          updatedAt: '2026-11-03T12:00:05.000Z',
          deleted: false,
          payload: { ...planPayload, title: '设备B', stage: 'design', updatedAt: '2026-11-03T12:00:05.000Z' },
        },
      ],
    })
    const merged = await newer.json()
    assert.equal(merged.items[0].payload.title, '设备B')
    assert.equal(merged.items[0].payload.stage, 'design')
  } finally {
    await close()
  }
})

test('scan photoPaths are stored as [] and tombstones do not resurrect', async () => {
  const { url, close, token } = await start()
  try {
    await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.100Z',
      items: [
        {
          kind: 'scan',
          itemId: 'plan-abc',
          updatedAt: '2026-11-03T12:00:00.000Z',
          deleted: false,
          payload: {
            planId: 'plan-abc',
            source: 'manual',
            widthMm: 4000,
            depthMm: 3000,
            heightMm: 2800,
            photoPaths: ['tmp://secret.jpg'],
            capturedAt: '2026-11-03T11:00:00.000Z',
            updatedAt: '2026-11-03T12:00:00.000Z',
          },
        },
      ],
    })
    const got = await (await authed(url, token, 'GET')).json()
    const scan = got.items.find((row: { kind: string }) => row.kind === 'scan')
    assert.deepEqual(scan.payload.photoPaths, [])

    await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.200Z',
      items: [
        {
          kind: 'favorite',
          itemId: 'p-sofa-modern-01',
          updatedAt: '2026-11-03T12:00:10.000Z',
          deleted: true,
          payload: null,
        },
      ],
    })
    const after = await (await authed(url, token, 'GET')).json()
    const fav = after.items.find((row: { itemId: string }) => row.itemId === 'p-sofa-modern-01')
    assert.equal(fav.deleted, true)
    assert.equal(fav.payload, null)
  } finally {
    await close()
  }
})

test('validation rejects deleted+payload, unknown kind, and too many favorites', async () => {
  const { url, close, token } = await start()
  try {
    const badDeleted = await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.100Z',
      items: [{ kind: 'plan', itemId: 'x', updatedAt: '2026-11-03T12:00:00.000Z', deleted: true, payload: { id: 'x' } }],
    })
    assert.equal(badDeleted.status, 400)
    assert.equal((await badDeleted.json()).error.code, 'VALIDATION_ERROR')

    const badKind = await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.100Z',
      items: [{ kind: 'note', itemId: 'x', updatedAt: '2026-11-03T12:00:00.000Z', deleted: false, payload: {} }],
    })
    assert.equal(badKind.status, 400)

    const items = Array.from({ length: 201 }, (_, i) => ({
      kind: 'favorite',
      itemId: `p-${i}`,
      updatedAt: '2026-11-03T12:00:00.000Z',
      deleted: false,
      payload: { productId: `p-${i}`, savedAt: '2026-11-03T12:00:00.000Z', updatedAt: '2026-11-03T12:00:00.000Z' },
    }))
    const tooMany = await authed(url, token, 'PUT', { clientTime: '2026-11-03T12:00:00.100Z', items })
    assert.equal(tooMany.status, 400)
  } finally {
    await close()
  }
})

test('PUT body larger than 512 KiB is PAYLOAD_TOO_LARGE', async () => {
  const { url, close, token } = await start()
  try {
    const huge = 'x'.repeat(513 * 1024)
    const res = await fetch(`${url}/api/sync`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ clientTime: '2026-11-03T12:00:00.100Z', items: [], pad: huge }),
    })
    assert.equal(res.status, 413)
    assert.equal((await res.json()).error.code, 'PAYLOAD_TOO_LARGE')
  } finally {
    await close()
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --test server/tests/merge.test.ts server/tests/sync.test.ts
```

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

`server/src/domain/enums.ts` 必须与 `src/types/domain.ts` / `src/constants/labels.ts` 的集合一致：

```ts
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
```

`server/src/services/merge.ts`：

```ts
import { CLOCK_SKEW_MS } from '../domain/enums.ts'

export function clampUpdatedAt(client: Date, serverNow: Date): Date {
  if (client.getTime() - serverNow.getTime() > CLOCK_SKEW_MS) return serverNow
  return client
}

export function shouldTakeIncoming(incoming: Date, existing: Date | null): boolean {
  if (existing == null) return true
  return incoming.getTime() > existing.getTime()
}

export function parseIso(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function toIso(date: Date): string {
  return date.toISOString()
}
```

`server/src/services/validateSync.ts`：把每个 kind 的 payload 按设计校验。实现必须覆盖：

- `itemId` 非空字符串、长度 ≤ 64
- `updatedAt` 可解析
- `deleted === true` ⇒ `payload === null`
- `deleted === false` ⇒ payload 为对象且：
  - favorite：`productId` / `savedAt` / `updatedAt` 字符串
  - plan：`id` 等于 `itemId`，`roomType`∈枚举，`isValidArea` 同等规则（`areaM2 > 0 && <= 10000`），`stage`∈枚举，`productIds` 为字符串数组
  - budget：`planId`、非负整数 `totalFen`、四类目非负整数、`updatedAt`
  - scan：`source`∈枚举，毫米 `>0 && <= 100000`，`capturedAt` 字符串；`photoPaths` 允许任何数组但写入前丢弃
  - aiPreview：`planId`、`request`（含 `roomType`/`style`/`budgetFen`/`existingProductIds`）、`items` 数组元素含 `productId`/`score`/`reason`
  - preference：`itemId === 'activePlanId'`，`payload.activePlanId` 为 `string | null`
- 计数：每个 kind 的**非删除**条目 ≤ 上限；`deleted:true` 合计 ≤ 400
- preference 非删除最多 1 条

校验失败抛 `new ApiError(400, 'VALIDATION_ERROR', '同步数据不合法')`。

`server/src/routes/sync.ts` 核心合并循环（单事务）：

```ts
export function registerSync(router: Router): void {
  router.get('/api/sync', requireAuth, async (ctx) => {
    const deps = ctx.state.deps as AppDeps
    await hitRateLimit(deps.redis, syncRateKey(ctx.state.userId), 60, 60)
    const rows = await deps.mysql.listSyncItems(ctx.state.userId)
    ctx.body = { serverTime: toIso(deps.clock()), items: rows.map(rowToItem) }
  })

  router.put('/api/sync', requireAuth, async (ctx) => {
    const deps = ctx.state.deps as AppDeps
    await hitRateLimit(deps.redis, syncRateKey(ctx.state.userId), 60, 60)
    const body = ctx.request.body as { clientTime?: unknown; items?: unknown }
    if (!Array.isArray(body.items)) throw new ApiError(400, 'VALIDATION_ERROR', '同步数据不合法')
    validateSyncPut(body.items)
    const userId = ctx.state.userId as string
    const now = deps.clock()
    await deps.mysql.withTransaction(async (tx) => {
      for (const raw of body.items as SyncItem[]) {
        let incomingAt = parseIso(raw.updatedAt)
        if (incomingAt == null) throw new ApiError(400, 'VALIDATION_ERROR', '同步数据不合法')
        incomingAt = clampUpdatedAt(incomingAt, now)
        let payload = raw.deleted ? null : raw.payload
        if (raw.kind === 'scan' && payload != null && typeof payload === 'object') {
          payload = { ...(payload as object), photoPaths: [] }
        }
        const existing = await tx.getSyncItem(userId, raw.kind, raw.itemId)
        if (!shouldTakeIncoming(incomingAt, existing?.updated_at ?? null)) continue
        await tx.upsertSyncItem({
          user_id: userId,
          kind: raw.kind,
          item_id: raw.itemId,
          payload,
          updated_at: incomingAt,
          deleted: raw.deleted ? 1 : 0,
          created_at: existing?.created_at ?? now,
        })
      }
    })
    const rows = await deps.mysql.listSyncItems(userId)
    ctx.body = { serverTime: toIso(now), items: rows.map(rowToItem) }
  })
}

function rowToItem(row: SyncItemRow): SyncItem {
  return {
    kind: row.kind,
    itemId: row.item_id,
    updatedAt: toIso(row.updated_at),
    deleted: row.deleted === 1,
    payload: row.payload,
  }
}
```

`app.ts` 删除占位 GET/PUT，改为 `registerSync(router)`。

`validateSyncPut` 必须在写入前跑完，避免部分写入。面积与毫米上限分别用 10000 与 100000，与 `src/utils/domainLimits.ts` 的 `MAX_AREA_M2` / `MAX_SCAN_DIMENSION_MM` 相同。

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --test server/tests/merge.test.ts server/tests/sync.test.ts server/tests/auth-middleware.test.ts
pnpm --dir server test
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat(server): merge GET/PUT /api/sync by updatedAt"
```

---

### Task 6: weapp 文案常量、auth store、登录页与启动门闩

**Files:**
- Modify: `src/constants/storageKeys.ts`
- Modify: `src/constants/labels.ts`
- Modify: `src/constants/tabs.ts`（`mine` 的 duty 改为登录后同步说明，Tab 路径不变）
- Create: `src/types/sync.ts`
- Create: `src/stores/syncStore.ts`
- Create: `src/utils/authGate.ts`
- Create: `src/hooks/useAuthGate.ts`
- Create: `src/utils/navigation.ts` 追加 `loginPageUrl`
- Create: `src/pages/login/index.tsx`
- Create: `src/pages/login/index.config.ts`
- Create: `src/pages/login/index.scss`
- Modify: `src/app.config.ts`
- Modify: `src/app.ts`（hydrate `syncStore`；有 token 时由登录页 `reLaunch`）
- Modify: `tests/taro-stub.mjs`
- Create: `tests/sync-types.test.ts`
- Create: `tests/sync-store.test.ts`
- Create: `tests/auth-gate.test.ts`
- Create: `tests/login-page.test.ts`
- Modify: `tests/tabs.test.ts`
- Modify: `tests/labels.test.ts`
- Modify: `tests/navigation.test.ts`
- Modify: 所有业务页加上 `useAuthGate()`（catalog/index、catalog/detail、plans/index、plans/detail、budget/index、mine/index、packageScan scan、packagePreview ai/recommend、packagePreview preview）

**Interfaces:**
- Consumes: 设计登录文案、`fd:auth` 形状 `{ token, userId, loggedInAt }`
- Produces:
  - `AUTH_STORAGE_KEY = 'fd:auth'`
  - `TOMBSTONES_STORAGE_KEY = 'fd:tombstones'`
  - `AI_PREVIEWS_STORAGE_KEY = 'fd:aiPreviews'`
  - `LOGIN_BUTTON_TEXT = '微信登录'`
  - `LOGIN_SUBTITLE = '使用微信身份同步收藏、方案、预算等到云端。不获取手机号。'`
  - `LOGIN_PRIVACY_DENIED_TEXT = '需要同意隐私指引才能同步'`
  - `LOGIN_FAILED_TEXT = '登录失败，请重试'`
  - `LOGIN_CODE_EXPIRED_TEXT = '登录已过期，请再点一次'`
  - `SYNC_FAILED_TEXT = '同步失败，将在网络恢复后重试'`
  - `LOGIN_MISSING_BASE_TEXT = '未配置服务地址，无法登录'`
  - `useSyncStore`: `token: string | null`, `userId: string | null`, `loggedInAt: string | null`, `pendingRetry: boolean`, `hydrate()`, `setSession({ token, userId })`, `clearSession()`, `setPendingRetry(flag)`
  - `isLoggedIn(): boolean`
  - `guardAuthenticatedPage(): void` → 无 token 时 `Taro.reLaunch({ url: '/pages/login/index' })`
  - `loginPageUrl() => '/pages/login/index'`
  - 登录页主按钮可点；本任务点击只检查「无基址」toast，真正 `Taro.login` 在 Task 7 接上
  - `app.config.ts` 的 `pages[0] === 'pages/login/index'`；`tabBar.list` 仍四项且不含 login

- [ ] **Step 1: Write the failing test**

`tests/sync-types.test.ts`：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import type { SyncItem, SyncKind } from '../src/types/sync.ts'

test('SyncKind union matches the design', () => {
  const kinds: SyncKind[] = ['favorite', 'plan', 'budget', 'scan', 'aiPreview', 'preference']
  const item: SyncItem = {
    kind: 'preference',
    itemId: 'activePlanId',
    updatedAt: '2026-11-03T12:00:00.000Z',
    deleted: false,
    payload: { activePlanId: null },
  }
  assert.equal(kinds.length, 6)
  assert.equal(item.itemId, 'activePlanId')
})
```

在 `tests/labels.test.ts` 增加：

```ts
import {
  LOGIN_BUTTON_TEXT,
  LOGIN_CODE_EXPIRED_TEXT,
  LOGIN_FAILED_TEXT,
  LOGIN_MISSING_BASE_TEXT,
  LOGIN_PRIVACY_DENIED_TEXT,
  LOGIN_SUBTITLE,
  SYNC_FAILED_TEXT,
} from '../src/constants/labels.ts'

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
```

`tests/tabs.test.ts` 把 `appConfig.pages` 断言改成第一项为登录页，并断言 login 不在 tabBar：

```ts
  assert.deepEqual(appConfig.pages, [
    'pages/login/index',
    'pages/catalog/index',
    'pages/plans/index',
    'pages/budget/index',
    'pages/mine/index',
    'pages/catalog/detail',
    'pages/plans/detail',
  ])
  assert.ok(appConfig.tabBar.list.every((item) => item.pagePath !== 'pages/login/index'))
  assert.equal(appConfig.tabBar.list.length, 4)
```

`tests/navigation.test.ts` 追加：

```ts
import { loginPageUrl } from '../src/utils/navigation.ts'

test('loginPageUrl is a non-tab path', () => {
  assert.equal(loginPageUrl(), '/pages/login/index')
})
```

`tests/sync-store.test.ts`：

```ts
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { AUTH_STORAGE_KEY } from '../src/constants/storageKeys.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import { configureStorage, createMemoryStorage, readJSON } from '../src/utils/storage.ts'

describe('syncStore auth persistence', { concurrency: false }, () => {
  beforeEach(() => {
    configureStorage(createMemoryStorage())
    useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
  })

  it('setSession writes fd:auth and hydrate restores it', () => {
    useSyncStore.getState().setSession({ token: 'sid.sig', userId: 'user-1' })
    const stored = readJSON(AUTH_STORAGE_KEY, null) as { token: string; userId: string; loggedInAt: string }
    assert.equal(stored.token, 'sid.sig')
    assert.equal(stored.userId, 'user-1')
    assert.match(stored.loggedInAt, /^\d{4}-\d{2}-\d{2}T/)
    useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
    useSyncStore.getState().hydrate()
    assert.equal(useSyncStore.getState().token, 'sid.sig')
    assert.equal(useSyncStore.getState().userId, 'user-1')
  })

  it('clearSession drops token but does not touch other keys', () => {
    useSyncStore.getState().setSession({ token: 'sid.sig', userId: 'user-1' })
    useSyncStore.getState().clearSession()
    assert.equal(useSyncStore.getState().token, null)
    assert.deepEqual(readJSON(AUTH_STORAGE_KEY, { keep: true }), {
      token: null,
      userId: null,
      loggedInAt: null,
    })
  })
})
```

`tests/auth-gate.test.ts`：

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Taro from '@tarojs/taro'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import { guardAuthenticatedPage, isLoggedIn } from '../src/utils/authGate.ts'

test('guardAuthenticatedPage relaunches login when token missing', () => {
  configureStorage(createMemoryStorage())
  useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
  const calls: string[] = []
  Taro.reLaunch = async ({ url }) => { calls.push(url) }
  assert.equal(isLoggedIn(), false)
  guardAuthenticatedPage()
  assert.deepEqual(calls, ['/pages/login/index'])
  useSyncStore.getState().setSession({ token: 't', userId: 'u' })
  guardAuthenticatedPage()
  assert.deepEqual(calls, ['/pages/login/index'])
})

test('every business page installs useAuthGate and login page does not', () => {
  const pages = [
    'src/pages/catalog/index.tsx',
    'src/pages/catalog/detail.tsx',
    'src/pages/plans/index.tsx',
    'src/pages/plans/detail.tsx',
    'src/pages/budget/index.tsx',
    'src/pages/mine/index.tsx',
    'src/packageScan/pages/scan/index.tsx',
    'src/packagePreview/pages/ai/recommend.tsx',
    'src/packagePreview/pages/preview/index.tsx',
  ]
  for (const file of pages) {
    const src = readFileSync(file, 'utf8')
    assert.ok(src.includes('useAuthGate'), `${file} must call useAuthGate`)
  }
  const login = readFileSync('src/pages/login/index.tsx', 'utf8')
  assert.equal(login.includes('useAuthGate'), false)
  assert.equal(login.includes('getPhoneNumber'), false)
})
```

`tests/login-page.test.ts`：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import Taro from '@tarojs/taro'
import LoginPage from '../src/pages/login/index.tsx'
import { mount, textContent, nodes, tick } from './mount.mjs'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'

test('login page shows WeChat copy and blocks missing API base', async () => {
  configureStorage(createMemoryStorage())
  useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
  delete process.env.TARO_APP_API_BASE_URL
  Taro.lastToast = ''
  Taro.lastReLaunch = ''
  Taro.showToast = async ({ title }) => { Taro.lastToast = title }
  Taro.reLaunch = async ({ url }) => { Taro.lastReLaunch = url }
  const page = mount(LoginPage)
  try {
    assert.match(textContent(page.tree), /微信登录/)
    assert.match(textContent(page.tree), /不获取手机号/)
    nodes(page.tree, (node) => node.props?.onClick && textContent(node).includes('微信登录'))[0].props.onClick()
    await tick(); page.flush()
    assert.equal(Taro.lastToast, '未配置服务地址，无法登录')
    assert.equal(Taro.lastReLaunch, '')
  } finally {
    page.unmount()
  }
})

test('login page with existing token relaunches catalog', async () => {
  configureStorage(createMemoryStorage())
  useSyncStore.setState({ token: 't', userId: 'u', loggedInAt: '2026-11-03T12:00:00.000Z', pendingRetry: false })
  Taro.lastReLaunch = ''
  Taro.reLaunch = async ({ url }) => { Taro.lastReLaunch = url }
  const page = mount(LoginPage)
  try {
    Taro.testShow?.()
    await tick(); page.flush()
    assert.equal(Taro.lastReLaunch, '/pages/catalog/index')
  } finally {
    page.unmount()
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/sync-types.test.ts tests/sync-store.test.ts tests/auth-gate.test.ts tests/login-page.test.ts tests/tabs.test.ts tests/labels.test.ts tests/navigation.test.ts
```

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

`tests/taro-stub.mjs` 追加（保留现有字段）：

```js
taro.login = async () => ({ code: 'wx-code' })
taro.reLaunch = async ({ url }) => { taro.lastReLaunch = url }
taro.switchTab = async ({ url }) => { taro.lastSwitchTab = url }
taro.showToast = async ({ title }) => { taro.lastToast = title }
taro.showModal = async () => ({ confirm: true, cancel: false })
taro.requirePrivacyAuthorize = async () => {}
taro.lastReLaunch = ''
taro.lastToast = ''
taro.lastSwitchTab = ''
```

`src/constants/storageKeys.ts` 全文：

```ts
export const FAVORITES_STORAGE_KEY = 'fd:favorites'
export const PLANS_STORAGE_KEY = 'fd:plans'
export const BUDGETS_STORAGE_KEY = 'fd:budgets'
export const SCANS_STORAGE_KEY = 'fd:scans'
export const AUTH_STORAGE_KEY = 'fd:auth'
export const TOMBSTONES_STORAGE_KEY = 'fd:tombstones'
export const AI_PREVIEWS_STORAGE_KEY = 'fd:aiPreviews'
```

`src/types/sync.ts`：

```ts
export type SyncKind = 'favorite' | 'plan' | 'budget' | 'scan' | 'aiPreview' | 'preference'

export type SyncItem = {
  kind: SyncKind
  itemId: string
  updatedAt: string
  deleted: boolean
  payload: unknown | null
}

export type AuthRecord = {
  token: string | null
  userId: string | null
  loggedInAt: string | null
}
```

`src/stores/syncStore.ts`：用 `readJSON` / `writeJSON` 持久化 `AUTH_STORAGE_KEY`。`setSession` 写入 `{ token, userId, loggedInAt: new Date().toISOString() }`。`clearSession` 写成 `{ token: null, userId: null, loggedInAt: null }`（保留 key，避免与「未 hydrate」混淆）。`hydrate` 缺字段则视为未登录。

`src/utils/authGate.ts`：

```ts
import Taro from '@tarojs/taro'
import { useSyncStore } from '../stores/syncStore'
import { loginPageUrl } from './navigation'

export function isLoggedIn(): boolean {
  const token = useSyncStore.getState().token
  return typeof token === 'string' && token.length > 0
}

export function guardAuthenticatedPage(): void {
  if (!isLoggedIn()) {
    Taro.reLaunch({ url: loginPageUrl() })
  }
}
```

`src/hooks/useAuthGate.ts`：

```ts
import { useDidShow } from '@tarojs/taro'
import { guardAuthenticatedPage } from '../utils/authGate'

export function useAuthGate(): void {
  useDidShow(() => {
    guardAuthenticatedPage()
  })
}
```

`src/utils/navigation.ts` 追加：

```ts
export function loginPageUrl(): string {
  return '/pages/login/index'
}
```

`src/pages/login/index.config.ts`：

```ts
export default definePageConfig({
  navigationBarTitleText: '登录',
})
```

`src/pages/login/index.scss` 只用 CSS 变量（`.page` / `.login-title` / `.login-sub` / `.login-btn`），背景 `var(--color-surface)`，主按钮背景 `var(--color-primary)`，文字 `var(--color-card)`。

`src/pages/login/index.tsx`（本任务点击逻辑）：

```tsx
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  LOGIN_BUTTON_TEXT,
  LOGIN_MISSING_BASE_TEXT,
  LOGIN_SUBTITLE,
} from '../../constants/labels'
import { isLoggedIn } from '../../utils/authGate'
import { getApiBaseUrl } from '../../utils/apiClient'
import './index.scss'

export default function LoginPage() {
  useDidShow(() => {
    if (isLoggedIn()) {
      Taro.reLaunch({ url: '/pages/catalog/index' })
    }
  })

  const onLogin = () => {
    if (!getApiBaseUrl()) {
      Taro.showToast({ title: LOGIN_MISSING_BASE_TEXT, icon: 'none' })
      return
    }
  }

  return (
    <View className='page'>
      <Text className='login-title'>家具装修</Text>
      <Text className='login-sub'>{LOGIN_SUBTITLE}</Text>
      <View className='login-btn' onClick={onLogin}>
        <Text className='login-btn__text'>{LOGIN_BUTTON_TEXT}</Text>
      </View>
    </View>
  )
}
```

本任务会 import 还不存在的 `getApiBaseUrl`。为让登录页测试能跑，先在 `src/utils/apiClient.ts` 放：

```ts
export const API_BASE_URL_ENV = 'TARO_APP_API_BASE_URL'

export function getApiBaseUrl(): string | undefined {
  const value = process.env.TARO_APP_API_BASE_URL
  if (typeof value !== 'string') return undefined
  const trimmed = value.replace(/\/$/, '')
  return trimmed.length > 0 ? trimmed : undefined
}
```

完整 `apiRequest` 留到 Task 7。

`src/app.config.ts` 的 `pages` 数组把 `'pages/login/index'` 插到第一位，其余顺序不变。

每个业务页组件函数**第一行**调用 `useAuthGate()`。`src/pages/budget/index.tsx` 已有 `useDidShow`，在同一 hook 里先 `guardAuthenticatedPage()` 再跑原预算逻辑也可以，但测试要求源码包含字符串 `useAuthGate`，因此仍要 `import { useAuthGate }` 并调用。

`src/app.ts` 在现有 hydrate 之后增加 `useSyncStore.getState().hydrate()`。

`src/constants/labels.ts` 追加 Task 6 Interfaces 列出的 7 个登录文案常量。

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/sync-types.test.ts tests/sync-store.test.ts tests/auth-gate.test.ts tests/login-page.test.ts tests/tabs.test.ts tests/labels.test.ts tests/navigation.test.ts tests/page-regressions.test.ts
```

Expected: PASS。`page-regressions` 因业务页新 hook 失败时，确认 `useAuthGate` 不在 render 里无条件 `reLaunch`（只在 `useDidShow`）。

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(weapp): add login page and force auth before tabs"
```

---

### Task 7: API 客户端与 token 持久化（接上登录）

**Files:**
- Modify: `src/utils/apiClient.ts`
- Create: `src/utils/authSession.ts`
- Modify: `src/pages/login/index.tsx`（隐私 → `Taro.login` → POST login → 写 session → 同步占位）
- Modify: `config/index.ts`
- Modify: `.env.example`
- Create: `tests/api-client.test.ts`
- Create: `tests/auth-session.test.ts`
- Modify: `tests/login-page.test.ts`（成功登录 reLaunch 选品）

**Interfaces:**
- Consumes: `getApiBaseUrl`、`useSyncStore.setSession` / `clearSession`、`Taro.request`、`Taro.login`、`Taro.requirePrivacyAuthorize`
- Produces:
  - `apiRequest<T>(path: string, options): Promise<T>`
    - path 以 `/api/` 开头；url = `${base}${path}`
    - 自动加 `Authorization: Bearer ${token}`（有 token 时）
    - 401：`clearSession()` + `reLaunch` 登录页，throw；**不**清业务 `fd:*`
    - `INVALID_CODE` / `WECHAT_UNAVAILABLE` 原样抛出 `{ code, message }`
  - `loginWithWeChat(deps?)`：隐私授权 → 每次重新 `Taro.login`（禁止缓存 code）→ POST `/api/auth/login` → `setSession`
  - 隐私拒绝：toast `LOGIN_PRIVACY_DENIED_TEXT`，不进 Tab
  - `logoutSession()`：尝试 POST `/api/auth/logout`，无论成功失败都 `clearSession`
  - `config/index.ts` `env.TARO_APP_API_BASE_URL`

- [ ] **Step 1: Write the failing test**

`tests/api-client.test.ts`：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import Taro from '@tarojs/taro'
import { apiRequest, getApiBaseUrl } from '../src/utils/apiClient.ts'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import { FAVORITES_STORAGE_KEY } from '../src/constants/storageKeys.ts'

test('apiRequest uses env base, sends bearer, and 401 clears only auth', async () => {
  configureStorage(createMemoryStorage({
    [FAVORITES_STORAGE_KEY]: JSON.stringify([{ productId: 'p-sofa-modern-01', savedAt: '2026-11-03T00:00:00.000Z', updatedAt: '2026-11-03T00:00:00.000Z' }]),
  }))
  useSyncStore.setState({ token: 'sid.sig', userId: 'user-1', loggedInAt: '2026-11-03T12:00:00.000Z', pendingRetry: false })
  process.env.TARO_APP_API_BASE_URL = 'https://example.com/'
  assert.equal(getApiBaseUrl(), 'https://example.com')
  const calls: Array<{ url: string; header?: Record<string, string> }> = []
  Taro.request = async (options) => {
    calls.push(options)
    return {
      statusCode: 401,
      data: { error: { code: 'UNAUTHORIZED', message: '请重新登录' } },
    }
  }
  Taro.lastReLaunch = ''
  Taro.reLaunch = async ({ url }) => { Taro.lastReLaunch = url }
  await assert.rejects(() => apiRequest('/api/sync', { method: 'GET' }))
  assert.equal(calls[0].url, 'https://example.com/api/sync')
  assert.equal(calls[0].header?.Authorization, 'Bearer sid.sig')
  assert.equal(useSyncStore.getState().token, null)
  assert.equal(Taro.lastReLaunch, '/pages/login/index')
  const { readJSON } = await import('../src/utils/storage.ts')
  assert.equal(readJSON(FAVORITES_STORAGE_KEY, []).length, 1)
  delete process.env.TARO_APP_API_BASE_URL
})

test('apiRequest refuses to send when base URL is missing', async () => {
  delete process.env.TARO_APP_API_BASE_URL
  let sent = 0
  Taro.request = async () => { sent += 1; return { statusCode: 200, data: {} } }
  await assert.rejects(() => apiRequest('/api/auth/login', { method: 'POST', data: { code: 'x' } }))
  assert.equal(sent, 0)
})
```

`tests/auth-session.test.ts`：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import Taro from '@tarojs/taro'
import { loginWithWeChat, logoutSession } from '../src/utils/authSession.ts'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import { LOGIN_PRIVACY_DENIED_TEXT } from '../src/constants/labels.ts'

test('loginWithWeChat requests a fresh code and stores token', async () => {
  configureStorage(createMemoryStorage())
  useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
  process.env.TARO_APP_API_BASE_URL = 'https://example.com'
  let loginCalls = 0
  Taro.requirePrivacyAuthorize = async () => {}
  Taro.login = async () => { loginCalls += 1; return { code: `code-${loginCalls}` } }
  Taro.request = async (options) => {
    assert.equal(options.url, 'https://example.com/api/auth/login')
    assert.equal(options.method, 'POST')
    assert.deepEqual(options.data, { code: 'code-1' })
    return { statusCode: 200, data: { token: 'sid.sig', expiresIn: 2592000, user: { id: 'user-1' } } }
  }
  await loginWithWeChat()
  assert.equal(loginCalls, 1)
  assert.equal(useSyncStore.getState().token, 'sid.sig')
  assert.equal(useSyncStore.getState().userId, 'user-1')
  delete process.env.TARO_APP_API_BASE_URL
})

test('privacy denial stays on login page', async () => {
  configureStorage(createMemoryStorage())
  Taro.lastToast = ''
  Taro.showToast = async ({ title }) => { Taro.lastToast = title }
  Taro.requirePrivacyAuthorize = async () => { throw new Error('deny') }
  let loginCalls = 0
  Taro.login = async () => { loginCalls += 1; return { code: 'x' } }
  await assert.rejects(() => loginWithWeChat())
  assert.equal(Taro.lastToast, LOGIN_PRIVACY_DENIED_TEXT)
  assert.equal(loginCalls, 0)
  assert.equal(useSyncStore.getState().token, null)
})

test('logoutSession clears token even if network fails', async () => {
  configureStorage(createMemoryStorage())
  process.env.TARO_APP_API_BASE_URL = 'https://example.com'
  useSyncStore.getState().setSession({ token: 'sid.sig', userId: 'user-1' })
  Taro.request = async () => { throw new Error('offline') }
  await logoutSession()
  assert.equal(useSyncStore.getState().token, null)
  delete process.env.TARO_APP_API_BASE_URL
})
```

给 `tests/login-page.test.ts` 增加成功路径：基址存在、privacy ok、login 返回 token 后 `lastReLaunch === '/pages/catalog/index'`。本任务允许同步 GET/PUT 还是空实现（`runLoginSync` 先 resolve），但必须在登录成功后 `reLaunch`。

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/api-client.test.ts tests/auth-session.test.ts tests/login-page.test.ts
```

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

`apiRequest` 规则：

1. `const base = getApiBaseUrl()`；没有就 `throw new Error(LOGIN_MISSING_BASE_TEXT)`。
2. `Taro.request({ url: `${base}${path}`, method, data, header: { Authorization: token ? `Bearer ${token}` : undefined } })`。
3. `statusCode === 401`：`useSyncStore.getState().clearSession()`；`Taro.reLaunch({ url: loginPageUrl() })`；throw。
4. 其它 `statusCode >= 400`：从 `data.error.code` 抛出。
5. 返回 `data`（登录与同步都没有 `{ data }` 包一层）。

`loginWithWeChat`：

```ts
export async function loginWithWeChat(): Promise<{ token: string; userId: string }> {
  try {
    await Taro.requirePrivacyAuthorize()
  } catch {
    Taro.showToast({ title: LOGIN_PRIVACY_DENIED_TEXT, icon: 'none' })
    throw new Error('privacy')
  }
  const { code } = await Taro.login()
  try {
    const res = await apiRequest<{ token: string; user: { id: string } }>('/api/auth/login', {
      method: 'POST',
      data: { code },
    })
    useSyncStore.getState().setSession({ token: res.token, userId: res.user.id })
    return { token: res.token, userId: res.user.id }
  } catch (error) {
    const codeName = (error as { code?: string }).code
    Taro.showToast({
      title: codeName === 'INVALID_CODE' ? LOGIN_CODE_EXPIRED_TEXT : LOGIN_FAILED_TEXT,
      icon: 'none',
    })
    throw error
  }
}
```

登录页 `onLogin`：无基址 toast 并 return；否则 `loginWithWeChat()` 成功后调用 `runLoginSync()`（本任务在 `src/utils/syncEngine.ts` 先导出 `export async function runLoginSync(): Promise<void> {}`），然后 `Taro.reLaunch({ url: '/pages/catalog/index' })`。`runLoginSync` 失败也要 reLaunch（设计：同步最多 8s，失败仍进选品并 `pendingRetry`）。本任务空实现即可让成功测试通过；Task 8 填满。

`config/index.ts` 的 `env` 增加：

```ts
TARO_APP_API_BASE_URL: JSON.stringify(process.env.TARO_APP_API_BASE_URL || ''),
```

根目录 `.env.example`：

```
# 不要把密钥粘贴到本文件。
# TARO_APP_API_BASE_URL=
# TARO_APP_AI_RECOMMEND_URL=
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/api-client.test.ts tests/auth-session.test.ts tests/login-page.test.ts tests/auth-gate.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src tests config/index.ts .env.example
git commit -m "feat(weapp): persist Bearer token and login via Taro.login"
```

---

### Task 8: 业务 store 的 updatedAt、tombstone、aiPreview 与同步引擎

**Files:**
- Modify: `src/types/domain.ts`（`FavoriteRecord.updatedAt`、`Budget.updatedAt`、`RoomScan.updatedAt`）
- Create: `src/utils/tombstones.ts`
- Create: `src/stores/aiPreviewStore.ts`
- Create: `src/utils/syncMerge.ts`
- Modify: `src/utils/syncEngine.ts`（收集 / 合并 / debounce / 前台 pull / 登录后 GET+PUT）
- Modify: `src/stores/favoriteStore.ts`
- Modify: `src/stores/planStore.ts`
- Modify: `src/stores/budgetStore.ts`
- Modify: `src/stores/scanStore.ts`
- Modify: `src/utils/aiRecommendClient.ts` 不在 client 内写 store；在 `src/packagePreview/pages/ai/recommend.tsx` 成功回调里 `upsert`
- Modify: `src/app.ts`（hydrate aiPreview；`useDidShow` pull）
- Modify: `src/utils/resetMock.ts` → 保留函数但改为内部调用 `clearMyDataLocal()`；真正云端清除在 Task 9
- Create: `tests/tombstones.test.ts`
- Create: `tests/sync-merge.test.ts`
- Create: `tests/sync-engine.test.ts`
- Create: `tests/ai-preview-store.test.ts`
- Modify: `tests/favorite-store.test.ts`
- Modify: `tests/plan-store.test.ts`
- Modify: `tests/budget-store.test.ts`
- Modify: `tests/scan-store.test.ts`
- Modify: `tests/ai-recommend-client.test.ts`（失败不改快照的断言放 store 测试）
- Modify: `src/utils/planCascade.ts`（新建：删方案时连 tombstone 相关 kind）

**Interfaces:**
- Consumes: 各业务 store 当前写入函数、Task 5 的合并规则、`apiRequest`
- Produces:
  - `recordTombstone(kind, itemId, updatedAt)` / `listTombstones()` / `dropAckedTombstones(serverItems)`
  - `mergeByUpdatedAt(local: SyncItem[], remote: SyncItem[]): SyncItem[]` — 按 `(kind, itemId)` 新者胜，相等取 remote；只在一边出现的保留
  - `collectSyncItems(): SyncItem[]` — 含未确认 tombstone；scan 的 `photoPaths` 发出去必须是 `[]`
  - `applySyncItems(items: SyncItem[]): void` — 整表替换对应 store + `fd:*`，然后丢掉已 ACK tombstone
  - `schedulePush(): void` — 800ms debounce；已有 PUT 在飞则结束后若期间有写入再 PUT 一次
  - `pullIfDue(now): Promise<void>` — 距上次成功 pull 不足 5s 则跳过
  - `runLoginSync(): Promise<void>` — GET 再 PUT，合计超时 8s；失败 `setPendingRetry(true)` 仍让登录页 reLaunch
  - `useAiPreviewStore.upsert(planId, request, items)` 仅在 `fetchAiRecommendations` **成功**（含空数组）后调用
  - `deletePlanAndRelated(planId)` 同时 tombstone `plan`/`budget`/`scan`/`aiPreview`，并修正 `activePlanId`
  - 取消收藏、删除方案不得只从数组 splice
  - 登录后若 `userId !==` 上次 `fd:auth.userId`：先 `reset` 业务 store + tombstones 再 GET
  - 2D 坐标仍然只存在 preview 页面 state

- [ ] **Step 1: Write the failing test**

`tests/tombstones.test.ts`：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { TOMBSTONES_STORAGE_KEY } from '../src/constants/storageKeys.ts'
import {
  dropAckedTombstones,
  listTombstones,
  recordTombstone,
} from '../src/utils/tombstones.ts'
import { configureStorage, createMemoryStorage, readJSON } from '../src/utils/storage.ts'

test('tombstones persist until the server snapshot acks a newer or equal deleted item', () => {
  configureStorage(createMemoryStorage())
  recordTombstone('favorite', 'p-sofa-modern-01', '2026-11-03T12:00:00.000Z')
  assert.deepEqual(listTombstones(), [
    { kind: 'favorite', itemId: 'p-sofa-modern-01', updatedAt: '2026-11-03T12:00:00.000Z' },
  ])
  dropAckedTombstones([
    {
      kind: 'favorite',
      itemId: 'p-sofa-modern-01',
      updatedAt: '2026-11-03T11:59:59.000Z',
      deleted: true,
      payload: null,
    },
  ])
  assert.equal(listTombstones().length, 1)
  dropAckedTombstones([
    {
      kind: 'favorite',
      itemId: 'p-sofa-modern-01',
      updatedAt: '2026-11-03T12:00:00.000Z',
      deleted: true,
      payload: null,
    },
  ])
  assert.deepEqual(listTombstones(), [])
  assert.deepEqual(readJSON(TOMBSTONES_STORAGE_KEY, null), [])
})
```

`tests/sync-merge.test.ts`：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeByUpdatedAt } from '../src/utils/syncMerge.ts'
import type { SyncItem } from '../src/types/sync.ts'

const local: SyncItem = {
  kind: 'plan',
  itemId: 'plan-1',
  updatedAt: '2026-11-03T12:00:00.000Z',
  deleted: false,
  payload: { title: 'A' },
}
const remoteNewer: SyncItem = { ...local, updatedAt: '2026-11-03T12:00:05.000Z', payload: { title: 'B', stage: 'design' } }
const remoteEqual: SyncItem = { ...local, payload: { title: 'server' } }

test('newer remote replaces the whole item; equal keeps remote; local-only is kept', () => {
  assert.equal(mergeByUpdatedAt([local], [remoteNewer])[0].payload.title, 'B')
  assert.equal(mergeByUpdatedAt([local], [remoteEqual])[0].payload.title, 'server')
  const extra: SyncItem = { ...local, itemId: 'plan-2', payload: { title: 'only-local' } }
  const merged = mergeByUpdatedAt([local, extra], [remoteNewer])
  assert.ok(merged.some((row) => row.itemId === 'plan-2'))
})
```

`tests/favorite-store.test.ts` 增加：`toggleFavorite` 添加时写入 `updatedAt`；再次 toggle 后 `items` 为空且 `listTombstones()` 含该 `productId`。hydrate 旧数据只有 `savedAt` 时用它回填 `updatedAt`。

`tests/plan-store.test.ts` 增加：`deletePlan` 去掉该计划；`activePlanUpdatedAt` 在 `setActivePlanId` / `createPlan` 时刷新。`parsePersistedPlans` 读取新字段，缺省为 `null`。

`tests/budget-store.test.ts`：`ensureForPlan` 结果带 ISO `updatedAt`；hydrate 旧快照无该字段时补一个来自「现在」或保留并可被 sync 层覆盖——实现选择：parse 时若缺 `updatedAt` 则用 `1970-01-01T00:00:00.000Z`，避免旧数据永远打败云端。测试锁死这个回填值。

`tests/scan-store.test.ts`：`upsert` 刷新 `updatedAt`；缺省用 `capturedAt`。

`tests/ai-preview-store.test.ts`：upsert 成功快照到 `fd:aiPreviews`；`reset` 清空。

`tests/sync-engine.test.ts` 必须覆盖：

1. `collectSyncItems` 含 favorite/plan/preference/budget/scan/aiPreview/tombstone；scan.photoPaths 为 `[]`。
2. `applySyncItems` 把远程计划写入 `planStore` 并 persist。
3. 两次快速 `schedulePush` 只发出一次 PUT（用 fake timers：`setTimeout` 800ms）。
4. `runLoginSync` 先 GET 再 PUT；GET 超时后 `pendingRetry === true`。
5. 不同 `userId` 登录先清空业务数据。
6. 合并后 `preference.activePlanId` 指向已删方案时，改成剩余方案里 `updatedAt` 最新者或 `null`。

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/tombstones.test.ts tests/sync-merge.test.ts tests/favorite-store.test.ts tests/plan-store.test.ts tests/budget-store.test.ts tests/scan-store.test.ts tests/ai-preview-store.test.ts tests/sync-engine.test.ts
```

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

领域增量（只加字段，不改现有含义）：

```ts
export interface FavoriteRecord {
  productId: string
  savedAt: string
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
```

`favoriteStore.toggleFavorite`：存在则 `recordTombstone('favorite', productId, now)` 并 filter；不存在则 push `{ productId, savedAt: now, updatedAt: now }`。写完调用 `schedulePush()`。

`planStore` 增加 `activePlanUpdatedAt: string | null` 与 `deletePlan(planId: string): void`。`persist` 写入 `{ plans, activePlanId, activePlanUpdatedAt }`。所有改计划的路径继续刷新该 plan 的 `updatedAt`，并 `schedulePush()`。

`src/utils/planCascade.ts`：

```ts
export function deletePlanAndRelated(planId: string): void {
  const now = new Date().toISOString()
  usePlanStore.getState().deletePlan(planId)
  useBudgetStore.getState().removePlan(planId)
  useScanStore.getState().removePlan(planId)
  useAiPreviewStore.getState().removePlan(planId)
  recordTombstone('plan', planId, now)
  recordTombstone('budget', planId, now)
  recordTombstone('scan', planId, now)
  recordTombstone('aiPreview', planId, now)
  schedulePush()
}
```

本阶段 UI 可以暂不暴露「删除单个方案」按钮（设计未要求新按钮），但 store API 必须存在，供「清除我的数据」与测试调用。

`budgetStore.ensureForPlan`：`buildBudget` 之后设 `updatedAt: now`。增加 `removePlan(planId)`。`ensureForPlans` 给每条快照打 `updatedAt`。预算**页**继续 `buildBudget(plan, products)` 展示，不直接渲染 store 快照，避免 NaN。

`scanStore.upsert`：校验通过后 `updatedAt: new Date().toISOString()`（若调用方已传且合法可保留传入值，但每次 upsert 都必须是新的 ISO）。增加 `removePlan`。

`aiPreviewStore`：`previews: Record<string, { planId, request, items, updatedAt }>`，key=`planId`。

`recommend.tsx` 的 `fetchAiRecommendations(...).then((next) => { useAiPreviewStore.getState().upsert(plan.id, buildAiRecommendRequest(plan, products), next); setItems(next) })`。`.catch` 不调用 upsert。

`syncMerge.ts`：用 Map 键 `` `${kind}:${itemId}` ``。对每个键比较 `updatedAt` 字符串的 `Date` 毫秒；`incoming === existing` 取 remote。

`syncEngine.collectSyncItems`：

- favorites → kind `favorite`，itemId=`productId`，payload 含 productId/savedAt/updatedAt
- plans → kind `plan`，itemId=`plan.id`，payload 为 Plan
- preference → kind `preference`，itemId=`'activePlanId'`，payload `{ activePlanId }`，`updatedAt` 用 `activePlanUpdatedAt` 或 `'1970-01-01T00:00:00.000Z'`
- budgets / scans / aiPreviews 以 `planId` 为 itemId
- scan payload 复制后 `photoPaths: []`
- 再加上 `listTombstones()` 转成 `deleted: true, payload: null`（若同一键既有活条目又有更新的 tombstone，tombstone 的 `updatedAt` 更晚则覆盖）

`applySyncItems`：按 kind 分组，过滤 `deleted`，写入对应 store persist，然后 `dropAckedTombstones`。最后 `reconcilePreference()`：若 `activePlanId` 不在 plans 里，选 `updatedAt` 最大的 plan 或 `null`，并刷新 preference `updatedAt`。

`runLoginSync`：用 `Promise.race` 包 8000ms。步骤：若 `previousUserId != null && previousUserId !== newUserId` 则 reset 五类业务 store + tombstones；GET `/api/sync`；`mergeByUpdatedAt(collect, remote)`；`apply`；PUT `collect`；用响应 `apply`。失败 toast `SYNC_FAILED_TEXT` 并 `setPendingRetry(true)`。

`schedulePush`：模块级 `timer` + `inFlight` 标志。

`app.ts`：hydrate `useAiPreviewStore`；在 `App` 组件里 `useDidShow(() => { if (isLoggedIn()) void pullIfDue() })`。

旧 `resetMockData`：改为依次 `reset` 五个业务 store（含 aiPreview）并清空 tombstones。Task 9 再让按钮走云端 tombstone。

修 `tests/residual-boundaries.test.ts` 里构造 Budget / RoomScan 对象时补上 `updatedAt`，否则 typecheck 失败。

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/tombstones.test.ts tests/sync-merge.test.ts tests/favorite-store.test.ts tests/plan-store.test.ts tests/budget-store.test.ts tests/scan-store.test.ts tests/ai-preview-store.test.ts tests/sync-engine.test.ts tests/reset-mock.test.ts tests/page-regressions.test.ts tests/residual-boundaries.test.ts
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(weapp): stamp updatedAt and sync all user domains"
```

---

### Task 9: 「我的」文案、退出登录、清除我的数据、提审清单

**Files:**
- Modify: `src/constants/labels.ts`（我的 / 隐私 / 清除文案）
- Modify: `src/pages/mine/index.tsx`
- Modify: `src/utils/resetMock.ts` 或新建 `src/utils/clearMyData.ts`
- Modify: `docs/weapp-publish-checklist.md`（简介、§3、§4、request 合法域名）
- Modify: `README.md`
- Modify: `tests/labels.test.ts`
- Modify: `tests/reset-mock.test.ts`
- Create: `tests/mine-copy.test.ts`（mount 「我的」断言文案与未登录禁用清除）

**Interfaces:**
- Consumes: `logoutSession`、`recordTombstone`、`runLoginSync` / PUT、`isLoggedIn`
- Produces 精确文案：
  - `MINE_NOTE_TEXT = '登录后，收藏、方案、预算、房型尺寸和 AI 选品快照会同步到自建 HTTPS 服务器。使用微信 openid 识别同一用户，不获取手机号。扫描参考照片仍只留在本机，不会上传。可退出登录或清除我的数据。'`
  - `MINE_PRIVACY_MODAL_TEXT = '相机用于房型测量，参考照片由你主动选择且不上云。登录后业务数据同步到自建服务器；用户标识为微信 openid，不收集手机号。可通过「退出登录」清除本机会话，或「清除我的数据」删除云端与本机业务记录。'`
  - `LOGOUT_BUTTON_TEXT = '退出登录'`
  - `CLEAR_MY_DATA_TEXT = '清除我的数据'`
  - 清除确认框 title=`清除我的数据`，content=`将删除云端与本机的收藏、方案、预算、扫描和 AI 快照，商品列表不受影响。`，confirm=`清除`，cancel=`取消`
  - 未登录时「清除我的数据」不可用（无 `onClick` 或点击 toast `请先登录`）；商品 mock 仍不受影响
  - 退出登录：`logoutSession()` 后 `reLaunch` 登录页，**保留**业务 `fd:*`
  - 清单简介改为说明 openid 登录 + 自建 HTTPS 同步，并写明仍不收集手机号；§3 增加「用户标识（openid）」；§3.3 删除「不做登录」；§4 写明 request 合法域名为 `TARO_APP_API_BASE_URL` 主机名，仍无 uploadFile

- [ ] **Step 1: Write the failing test**

`tests/mine-copy.test.ts`：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import Taro from '@tarojs/taro'
import MinePage from '../src/pages/mine/index.tsx'
import { mount, textContent, nodes, tick } from './mount.mjs'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import {
  CLEAR_MY_DATA_TEXT,
  LOGOUT_BUTTON_TEXT,
  MINE_NOTE_TEXT,
} from '../src/constants/labels.ts'

test('mine page shows logout, clear-my-data, and openid privacy copy', async () => {
  configureStorage(createMemoryStorage())
  useSyncStore.getState().setSession({ token: 't', userId: 'u' })
  const page = mount(MinePage)
  try {
    const text = textContent(page.tree)
    assert.match(text, new RegExp(LOGOUT_BUTTON_TEXT))
    assert.match(text, new RegExp(CLEAR_MY_DATA_TEXT))
    assert.equal(text.includes(MINE_NOTE_TEXT), true)
    assert.equal(text.includes('重置 mock'), false)
    assert.match(text, /不获取手机号|不收集手机号/)
  } finally {
    page.unmount()
  }
})

test('logout keeps favorites and relaunches login', async () => {
  configureStorage(createMemoryStorage())
  const { useFavoriteStore } = await import('../src/stores/favoriteStore.ts')
  useFavoriteStore.getState().toggleFavorite('p-sofa-modern-01')
  useSyncStore.getState().setSession({ token: 't', userId: 'u' })
  Taro.request = async () => ({ statusCode: 204, data: '' })
  Taro.lastReLaunch = ''
  Taro.reLaunch = async ({ url }) => { Taro.lastReLaunch = url }
  const page = mount(MinePage)
  try {
    nodes(page.tree, (node) => node.props?.onClick && textContent(node).includes('退出登录'))[0].props.onClick()
    await tick(); page.flush()
    assert.equal(useSyncStore.getState().token, null)
    assert.equal(useFavoriteStore.getState().items.length, 1)
    assert.equal(Taro.lastReLaunch, '/pages/login/index')
  } finally {
    page.unmount()
  }
})
```

`tests/labels.test.ts` 断言上述四个常量精确相等。

给 `tests/reset-mock.test.ts` 改名语义：`clearMyDataLocal` 清 favorites/plans/budgets/scans/aiPreviews/tombstones，不动 `useCatalogStore.products`。保留「部分写入失败可 retry」用例，写入列表加上 `AI_PREVIEWS_STORAGE_KEY` 与 `TOMBSTONES_STORAGE_KEY`。

给清单加 `tests/publish-checklist.test.ts`：

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const TEXT = readFileSync('docs/weapp-publish-checklist.md', 'utf8')

test('publish checklist describes openid sync and still forbids phone number', () => {
  assert.match(TEXT, /openid/)
  assert.match(TEXT, /不收集手机号/)
  assert.match(TEXT, /request 合法域名/)
  assert.equal(TEXT.includes('不做登录'), false)
  assert.equal(TEXT.includes('默认不联网'), false)
  assert.match(TEXT, /扫描参考图|参考图.*不上云|照片.*不上云/)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/mine-copy.test.ts tests/labels.test.ts tests/reset-mock.test.ts tests/publish-checklist.test.ts
```

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

「我的」页结构：收藏列表保持；其下 `mine-note`、隐私入口、`退出登录`、`清除我的数据`（未登录时加 class `mine-reset--disabled` 且 onClick toast `请先登录`）、`重试本机保存`。

`clearMyDataCloud`：

1. 对当前 collect 里所有活条目 `recordTombstone`
2. `apiRequest('/api/sync', { method: 'PUT', data: { clientTime, items: collectSyncItems() } })`
3. 成功后 `clearMyDataLocal()` 并 toast `已清除`
4. 失败 toast `SYNC_FAILED_TEXT`

清单正文按 Interfaces 改写第 1、3、4 节。§3 新增 3.4：

```
### 3.4 用户标识（openid）

- **信息类型：** 用户标识（通过 wx.login 换取的 openid，仅保存在自建服务器）
- **使用目的：** 识别同一微信用户并同步收藏、方案、预算、房型尺寸与 AI 选品快照。不收集手机号、昵称或头像。
```

§3.3「明确不收集」改为：不收集手机号、位置、通讯录、身份证、好友关系、支付信息。登录只用 openid。

§4 提审说明改为有账号登录（openid）、有 request 合法域名（填 `TARO_APP_API_BASE_URL` 的主机名）、无 uploadFile、无支付。

README 当前里程碑改为 **OpenID 登录与全量同步**；本地运行补 `pnpm --dir server dev` 与 `TARO_APP_API_BASE_URL`。强调未经 Nero 确认不部署、不提审。

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/mine-copy.test.ts tests/labels.test.ts tests/reset-mock.test.ts tests/publish-checklist.test.ts tests/login-page.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src tests docs/weapp-publish-checklist.md README.md
git commit -m "docs: switch privacy copy to openid sync without phone number"
```

---

### Task 10: 集成冒烟与验收清单

**Files:**
- Create: `server/tests/smoke.test.ts`
- Create: `tests/openid-no-phone.test.ts`
- Modify: `tests/stores.test.ts`（默认值包含 aiPreview / syncStore）
- 不改生产部署脚本（本任务禁止 SSH 到 ECS）

**Interfaces:**
- Consumes: 全部前序模块
- Produces: 内存冒烟覆盖设计验收 1–10 的自动化部分；人工真机步骤写在本任务 Step 5 之后的验收清单里（每条都有命令或操作）

- [ ] **Step 1: Write the failing test**

`tests/openid-no-phone.test.ts`：

```ts
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('source has no phone-number login APIs and no skip-login backdoor', () => {
  const src = execSync('rg -n "getPhoneNumber|getUserProfile|open-type=.getPhoneNumber" src || true', {
    encoding: 'utf8',
  })
  assert.equal(src.trim(), '')
  const skip = execSync('rg -n "skipLogin|bypassAuth|debugLogin" src || true', { encoding: 'utf8' })
  assert.equal(skip.trim(), '')
  const rootPkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }
  for (const name of ['koa', 'mysql2', 'ioredis']) {
    assert.equal(rootPkg.dependencies?.[name], undefined)
    assert.equal(rootPkg.devDependencies?.[name], undefined)
  }
})

test('tracked files do not contain AppSecret or session secret assignments', () => {
  const hits = execSync(
    'rg -n "WECHAT_APPSECRET\\s*=\\s*[\'\\"][^\'\\"]+[\'\\"]|SESSION_SECRET\\s*=\\s*[\'\\"][^\'\\"]{8,}[\'\\"]" --glob "!docs/**" --glob "!server/tests/**" || true',
    { encoding: 'utf8' },
  )
  assert.equal(hits.trim(), '')
})
```

`server/tests/smoke.test.ts`：一条测试完成「登录 → PUT 六类 kind → 第二客户端 GET 一致 → 冲突整条以新 updatedAt 为准 → 取消收藏 tombstone 不复活 → 无 token 401」。用两套 `memoryMysql` 不行（要共享同一 mysql）。做法：同一 `deps.mysql`，两次 login 用**同一 openid** 发两个 token（第二次 upsert 同一 user）。设备 B 的 PUT 带更大 `updatedAt`。

- [ ] **Step 2: Run test to verify it fails**

若 Task 5–9 已完成，`openid-no-phone` 可能已绿。`smoke.test.ts` 在未写前 FAIL。跑：

```bash
node --experimental-strip-types --import ./tests/preload-taro-globals.cjs --test tests/openid-no-phone.test.ts
node --experimental-strip-types --test server/tests/smoke.test.ts
```

Expected: 前者在实现后 PASS；后者在本任务实现前 FAIL。

- [ ] **Step 3: Write minimal implementation**

只新增测试文件与 `tests/stores.test.ts` 对 `useSyncStore` / `useAiPreviewStore` 初始值的断言。不要加跳过登录的临时代码。不要在测试里写真实 AppSecret。

冒烟 PUT 的 items 至少包含：1 条 favorite、1 条 plan、1 条 preference、1 条 budget、1 条 scan（带非空 photoPaths，断言回来是 `[]`）、1 条 aiPreview。

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --dir server test
pnpm test
pnpm typecheck
pnpm build:weapp
```

Expected: 全部 PASS / `tsc` 无错误 / `dist/` 生成。`rg "getPhoneNumber" src` 无输出。

- [ ] **Step 5: Commit**

```bash
git add server/tests/smoke.test.ts tests/openid-no-phone.test.ts tests/stores.test.ts
git commit -m "test: cover openid sync smoke and ban phone-number login"
```

---

## 验收清单（实现 PR 必须逐条勾）

对应设计「验收标准」。自动化能覆盖的已在 Task 10；其余用微信开发者工具。

1. 冷启动无 `fd:auth.token`：模拟器第一屏路径为 `pages/login/index`，底部无 Tab 可点。  
2. 点「微信登录」不出现手机号按钮；`rg "getPhoneNumber|getUserProfile" src` 为空。登录副文案含「不获取手机号」。  
3. 配好 `TARO_APP_API_BASE_URL` 且服务端 mock/真微信 code 可用时，登录后进入「选品」；杀掉编译进程再进，token 未过期则登录页 `useDidShow` 立即 `reLaunch` 选品。  
4. 同一测试 openid：设备 A 写收藏/方案/当前方案/预算/扫描毫米/AI 快照，设备 B 清 `fd:*` 后重登，GET/PUT 后六类数据一致。  
5. 设备 A 改方案标题 `updatedAt=T1`，设备 B 改同一 `plan.id` 的阶段 `T2>T1`，合并后整条以 B 为准。取消收藏的 tombstone 在另一设备上使该收藏消失且不复活。  
6. 网络面板：扫描 PUT 的 `photoPaths` 为 `[]`，无 `uploadFile`。  
7. `rg "WECHAT_APPSECRET" -g '*.md' -g 'server/.env.example' -g '.env.example'` 只有变量名；仓库无 AppSecret 真值。  
8. 未设 `TARO_APP_API_BASE_URL` 时点登录得到「未配置服务地址，无法登录」，不能进 Tab。  
9. 删 Redis 会话后下一次 GET 401，回到登录页，业务 `fd:*` 仍在；同一 `user.id` 重登后未上传的新条目按 `updatedAt` 合并保留。  
10. `docs/weapp-publish-checklist.md` 与「我的」文案已改为 openid 同步且仍不收集手机号。

**明确不做：** ECS 实装、备案、提审、支付、真实大模型、手机号预埋字段。

---

## 自检（计划作者已跑，实现时不必重写本节）

### 规格覆盖

| 设计章节 | 任务 |
| --- | --- |
| 个人主体禁止手机号 | Task 6 文案、Task 9 清单、Task 10 `openid-no-phone` |
| `server/` + Node22 + Koa2 + MySQL + Redis | Task 1–5 |
| 强制登录门闩 | Task 6–7 |
| 全量同步六类域 | Task 5、Task 8 |
| `updatedAt` 新者胜 / 相等留服务端 | Task 5 `merge.ts`、Task 8 `syncMerge.ts` |
| tombstone | Task 5、Task 8 `tombstones.ts` |
| 密钥只在 env | Task 1 `loadEnv`、Task 9/10 扫描 |
| 扫描照片不上云 | Task 5 PUT 规范化、Task 8 collect |
| AI 快照落盘 | Task 8 `aiPreviewStore` |
| 2D 坐标不同步 | Task 8 收集列表不含 layout |
| 退出登录保留业务数据 | Task 7 `logoutSession`、Task 9 |
| 换 userId 防串号 | Task 8 `runLoginSync` |
| 401 不清业务数据 | Task 7 `apiRequest` |
| 未配置基址不能进 Tab | Task 6–7 登录页 |
| 清单与「我的」文案 | Task 9 |
| 不部署不提审 | Global Constraints + Task 10 禁止 ECS |

### 占位扫描

计划正文不含 `TBD` / `TODO` / `稍后` / `implement later`。错误码、TTL、限流、文案、路径均为字面量。

### 类型与命名一致性

前后端共用字面量：`SyncKind`、`SyncItem`、`itemId`、`updatedAt`、`deleted`、`payload`、`activePlanId`、`expiresIn=2592000`、storage key `fd:auth` / `fd:tombstones` / `fd:aiPreviews`。会话 token `{sid}.{sig}`。错误码与 HTTP 状态与设计表一致。weapp 测试一律 `--import ./tests/preload-taro-globals.cjs`。
