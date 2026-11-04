# MySQL → Supabase Postgres 设计

日期：2026-11-04  
仓库：https://github.com/CoderSxy/furniture-decoration  
默认分支：`main`  
对照规格：[openid 登录与全量同步设计](2026-11-03-openid-login-sync-design.md)（含文末修复补充）  
代码基线：`5f0232f`；openid 登录与同步已合入 main（PR #14 / #15）。  
文档范围：仅设计。本 PR 只新增本文，不修改 `server/`、小程序业务代码、依赖、schema 文件或环境变量示例。设计确认后另写实现计划、另开实现 PR。

本文件锁定 Nero 已确认的决策：**只把 MySQL 替换为 Supabase 托管的 Postgres**。Node 22 + Koa2 API 与 Redis 会话仍运行在阿里云 ECS；服务端用 `pg` 和 Supabase 连接池 URI 访问数据库。新建家具装修专用 Supabase 项目，区域固定为 **`ap-southeast-1`（新加坡）**，不复用 `jnbjt` / `food-notes`。不使用 `@supabase/supabase-js`、`service_role` 数据 API 或 Supabase Auth 承接现有登录同步。

## 背景

当前 `server/` 使用 `mysql2/promise`；`server/src/db/mysql.ts` 提供用户读写、同步条目读写、用户行锁及事务，`server/src/db/syncItemWrite.ts` 使用 MySQL 原子条件 upsert。`server/src/db/schema.sql` 包含 `users`、`sync_items` 两表。`server/src/routes/sync.ts` 已在 PUT 与 DELETE 中锁定用户行，避免清除与写入穿插。

ECS 尚未部署生产，没有 MySQL 生产数据需要迁移。后续实现按**空库切换**处理：在专用 Postgres 空库建表，替换驱动与环境变量，保留既有 API 行为。不设计数据导出导入、双写、增量追平或在线切库。

## 目标

1. `users` 与 `sync_items` 持久化改为 Supabase Postgres，唯一键、外键、索引和条目语义等价。
2. 保留微信 `code2Session`、Koa2 API、Bearer 鉴权、Redis `sess:*` 会话及登录 / 同步限流；小程序只访问既有 ECS HTTPS API。
3. 保留 `GET|PUT /api/sync`、`DELETE /api/sync`，以及 PR #15 修复的身份归属、在途请求、时间与清除语义。
4. 锁定 Postgres schema、参数绑定、事务连接和原子新者胜写法，使后续实现无需重新选择数据库方案。
5. 后续实现移除 `mysql2`、加入 `pg`，更新假实现与 SQL 测试，现有登录 / 同步 / 小程序回归测试继续通过。

## 非目标

本设计 PR 不做：

- 创建真实 Supabase 项目、执行建表或写入任何远端数据库。
- 部署 ECS、推生产、配置微信域名、提交审核或发布小程序；未经 Nero 确认不得部署或推生产。
- 修改 `server/` 或小程序业务代码、安装驱动、更新 lockfile、修改 `.env.example`。

本次数据库替换及后续实现也不做：

- 复用 `jnbjt` / `food-notes` 项目，迁移 MySQL 生产历史数据，或引入双写。
- 改小程序同步协议、增加字段级合并或实时订阅。
- 把会话 / 限流迁出 Redis，使用 Supabase Auth 替代微信 openid。
- 使用 Edge Functions、Supabase REST / GraphQL 数据 API、`supabase-js` 或 `service_role` key 作为数据访问路径。
- 上传扫描照片、保存 2D 拖动坐标、收集手机号，或新增原设计范围外的业务能力。

## 技术栈（已确认）

| 层 | 选择 | 约束 |
| --- | --- | --- |
| 小程序 | 现有 Taro + React + TypeScript + Zustand | 本次不改代码、依赖、`fd:*` 或 HTTP 协议。 |
| 服务端 | Node 22（`>=22.23.4 <23`）+ Koa2 | 保留 `server/` 自有包与阿里云 ECS 运行形态。 |
| 数据库 | Supabase 托管 Postgres | 新建专用项目；固定 `ap-southeast-1`；空库建表。 |
| 数据访问 | `pg` 的 `Pool` + Supabase Transaction pooler URI | 单一 `DATABASE_URL`；SQL 用 `$1` 等参数绑定；不用 Supabase SDK。 |
| 会话 / 限流 | ECS 上既有 Redis + `ioredis` | 保留 `sess:*`、会话 TTL / 滑动续期、登录与同步限流。 |
| API 入口 | ECS Nginx HTTPS → Koa2 | 小程序 request 合法域名仍指向 ECS，客户端不访问数据库。 |

## 架构

```text
微信小程序（fd:*、fd:auth、fd:dataOwner、tombstone）
    │ Taro.login 获取 code；HTTPS /api/*；Bearer
    ▼
阿里云 ECS：Nginx → Node 22 + Koa2
    ├─ POST /api/auth/login → 微信 code2Session → openid
    ├─ Redis：sess:*、会话续期、登录 / 同步限流
    ├─ GET /api/auth/session、POST /api/auth/logout
    └─ GET / PUT / DELETE /api/sync
           │ pg.Pool；DATABASE_URL；TLS
           ▼
Supabase Transaction pooler
           ▼
专用 Postgres（ap-southeast-1）
    public.users + public.sync_items
```

微信 AppSecret、微信 `session_key` 和数据库凭据不发给小程序；Koa 签发的 Bearer token 继续按现有协议返回客户端并存入 `fd:auth`。Koa 继续从 Redis 会话取得 `userId`；所有条目读写都限定 `user_id = 会话 userId`，不接受请求体指定归属。Supabase 只提供托管数据库，不参与微信身份验证、会话签发或 API 路由。

### 连接与连接池

- **运行时固定使用 Transaction pooler**：从新项目控制台 Connect 取得对应 URI，注入 `DATABASE_URL`，不根据项目名猜主机、账号或拼接连接串。`pg.Pool` 每个 Koa 进程一份，初始 `max = 10`、`connectionTimeoutMillis = 5000`、`idleTimeoutMillis = 30000`；多进程连接总数必须纳入项目连接额度。
- Transaction 模式不依赖跨事务会话状态：不使用命名 prepared statements（不传 `query.name`）、会话级 `SET`、临时表或 `LISTEN/NOTIFY`。参数化查询仍使用 `$1` 等占位符，不拼接用户输入。
- **Session pooler** 只用于确有连接级状态要求的工具或运维任务，或需要 IPv4 且直连不可达的迁移工具；不作为本次 API 默认模式。
- **直连**用于一次性 schema 管理、迁移、备份等管理操作，前提是执行环境具有相应 IPv6 / IPv4 可达性。运行 API 不持有额外直连环境变量，也不在启动时自动建表。管理操作使用单独的临时管理连接配置，值不落仓库。
- ECS 到 pooler 必须 TLS 加密并验证证书与主机名；需要项目 CA 时通过部署环境信任库安装。禁止以 `rejectUnauthorized: false` 绕过验证。初始化失败、连接失败或事务失败均不打印 `DATABASE_URL`、密码或完整驱动配置。
- `withTransaction` 必须 `pool.connect()` 借出一个 client，在**同一 client** 上完成 `BEGIN`、用户行锁、全部写入、`COMMIT`；失败 `ROLLBACK`，最后 `release()`。不得通过多次 `pool.query()` 分散执行一个事务。Transaction pooler 在事务期间绑定后端连接，能承载该行锁语义。

连接模式与 prepared statements 限制参见 [Supabase 连接文档](https://supabase.com/docs/guides/database/connecting-to-postgres)；事务使用同一 client 参见 [node-postgres 事务文档](https://node-postgres.com/features/transactions)。

### 数据库访问边界

业务表留在 `public`，但**不开放给客户端 Data API**：在专用项目禁用 Data API；schema 同时撤销 `anon` / `authenticated` 对两表的权限并启用 RLS，不创建客户端访问策略。Koa 继续负责用户级鉴权与 `user_id` 过滤，不把微信 openid 转成 Supabase JWT。

运行连接使用专用数据库登录角色 `fd_server`，只授予 `public` schema 的 `USAGE` 和两表 `SELECT / INSERT / UPDATE / DELETE`，不授予建表或其他项目资源权限。该角色密码由管理通道在仓库外设置；pooler URI 使用此角色对应的连接信息。角色仅对这两张表授予显式的服务端 RLS 策略，以便跨用户的 Koa 请求通过同一连接角色处理；不能把它作为终端用户权限隔离。schema 由管理角色拥有，`fd_server` 不作表 owner，也不使用 `BYPASSRLS`。这一取舍把现有 Koa / Redis 信任边界保留在服务端，同时阻断公开 Data API 访问。RLS 与表权限的关系参见 [Supabase RLS 文档](https://supabase.com/docs/guides/database/postgres/row-level-security)。

## 领域与表结构

领域保持不变：`users.id` 是服务端生成的稳定用户 UUID，`openid` 唯一识别同一小程序的微信用户；`sync_items` 按 `(user_id, kind, item_id)` 保存整条 payload 或 tombstone。`kind` 保留 `favorite`、`plan`、`budget`、`scan`、`aiPreview`、`preference`；`preference` 继续承载当前方案等既有偏好。金额仍为整数分、面积平方米、尺寸毫米，API 时间继续输出 UTC ISO 8601 毫秒格式。

| MySQL 现状 | Postgres 决策 | 理由 / 兼容规则 |
| --- | --- | --- |
| `CHAR(36)` 用户主键 / 外键 | **UUID** | 继续由服务端 UUID 工厂生成，API 仍传字符串；测试夹具改用合法 UUID。`item_id` 保留 `VARCHAR(64)`，不强制 UUID。 |
| `kind ENUM(...)` | **TEXT + CHECK** | 保留六个允许值；不引入独立 Postgres ENUM 类型。 |
| `DATETIME(3)` | **TIMESTAMPTZ(3)** | 保留毫秒精度；驱动传 `Date` / 含时区 ISO，输出 `toISOString()`；不依赖 ECS 本地时区。 |
| `JSON` | **JSONB**，允许 SQL NULL | 保留 JSON 对象与 tombstone 的空 payload；不将 SQL NULL 写成 JSON 字面量 null。 |
| `TINYINT(1)` | **BOOLEAN NOT NULL DEFAULT FALSE** | 数据库与后续仓库行类型统一 boolean；API 的 `deleted` 仍是 boolean。 |
| `utf8mb4_unicode_ci` | UTF-8 + 标识符列 `COLLATE "C"` | `openid`、`kind`、`item_id` 以区分大小写的精确值比较，不用 `citext`，不改变值大小写。无历史数据需要处理旧排序规则碰撞。 |
| 主键、唯一键、级联外键、复合索引 | 等价约束与 B-tree 索引 | 保留 `ON DELETE CASCADE` 与 `(user_id, updated_at)`。不为当前全量同步额外增加 GIN 索引。 |

### 完整 schema 草案（后续实现写入 `server/src/db/schema.sql`）

在已存在的专用 Supabase 数据库中由管理角色执行，不执行 MySQL `CREATE DATABASE` 或创建新数据库。以下为全新空库一次性初始化脚本；角色无密码，必须经仓库外管理通道设置密码后才可登录。Data API 禁用为项目设置，不由此 SQL 代替。

```sql
BEGIN;

CREATE ROLE fd_server LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS;

CREATE TABLE public.users (
  id UUID NOT NULL,
  openid VARCHAR(64) COLLATE "C" NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  last_login_at TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT uk_users_openid UNIQUE (openid)
);

CREATE TABLE public.sync_items (
  user_id UUID NOT NULL,
  kind TEXT COLLATE "C" NOT NULL,
  item_id VARCHAR(64) COLLATE "C" NOT NULL,
  payload JSONB NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT sync_items_pkey PRIMARY KEY (user_id, kind, item_id),
  CONSTRAINT ck_sync_kind CHECK (
    kind IN ('favorite', 'plan', 'budget', 'scan', 'aiPreview', 'preference')
  ),
  CONSTRAINT fk_sync_user FOREIGN KEY (user_id)
    REFERENCES public.users (id) ON DELETE CASCADE
);

CREATE INDEX idx_sync_user_updated
  ON public.sync_items (user_id, updated_at);

REVOKE ALL ON TABLE public.users, public.sync_items
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO fd_server;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.users, public.sync_items TO fd_server;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_server_access ON public.users
  FOR ALL TO fd_server USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY sync_items_server_access ON public.sync_items
  FOR ALL TO fd_server USING (TRUE) WITH CHECK (TRUE);

COMMIT;
```

不额外增加业务字段、时间更新触发器或数据库生成 UUID。`created_at` 由服务端写入，冲突更新不覆盖；`updated_at` 是条目版本，不自动改成数据库当前时间。扫描照片继续由 API 把 `photoPaths` 规范化为 `[]`，原有 payload 校验留在 Koa。

## 并发、登录与同步协议

### 用户与条目写入

登录按 `openid` 原子 upsert 用户，避免并发首次登录的查后插入竞态；冲突时只更新登录时间，保留已有 `id` / `created_at`，返回实际用户行再签发 Redis 会话：

```sql
INSERT INTO public.users (id, openid, created_at, updated_at, last_login_at)
VALUES ($1, $2, $3, $3, $3)
ON CONFLICT (openid) DO UPDATE SET
  updated_at = EXCLUDED.updated_at,
  last_login_at = EXCLUDED.last_login_at
RETURNING id, openid, created_at, updated_at, last_login_at;
```

PUT 与清除共同使用默认 **READ COMMITTED** 隔离级别；先在同一事务锁定对应 `users` 行，再逐条写入或删除，直到提交才释放锁：

```sql
BEGIN;
SELECT id FROM public.users WHERE id = $1 FOR UPDATE;
-- PUT：在同一 client 上逐条执行下面的条件 upsert。
-- DELETE：在同一 client 上执行 DELETE FROM public.sync_items WHERE user_id = $1。
COMMIT;
```

锁定不到用户行视为无效身份，回滚并返回既有 `401 UNAUTHORIZED`，不绕过锁写入。用户锁确保同一用户的 PUT / DELETE 串行，不阻塞其他用户的正常同步。单条写入固定采用以下 SQL，**禁止先读时间再无条件 UPDATE**：

```sql
INSERT INTO public.sync_items
  (user_id, kind, item_id, payload, updated_at, deleted, created_at)
VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
ON CONFLICT (user_id, kind, item_id) DO UPDATE SET
  payload = EXCLUDED.payload,
  deleted = EXCLUDED.deleted,
  updated_at = EXCLUDED.updated_at
WHERE EXCLUDED.updated_at > sync_items.updated_at;
```

`payload`、`deleted`、`updated_at` 共享一个原子条件；严格较新才一起覆盖，相等或较旧整行不变，`created_at` 始终保留。不存在则插入。批量请求仍逐条处理，兼容同一请求重复键，不引入多行 upsert 的重复冲突限制。`ON CONFLICT` 的条件与原子行为参见 [PostgreSQL INSERT 文档](https://www.postgresql.org/docs/current/sql-insert.html)。

现有 `getSyncItem` 可保留作仓库接口读取，但不得用它的结果决定冲突覆盖。PUT 提交后读取该用户全量快照返回，继续允许快照包含其间其他已提交请求的结果；不升级为新的响应隔离协议。任何 SQL / 提交失败均回滚且不返回成功；数据库连接失败沿用统一错误处理，不发出部分成功结果。

### 必须保留的协议与 PR #15 修复语义

- `GET|PUT /api/sync` 保留 Bearer、`items` / `serverTime` 响应、全量快照与整条 `updatedAt` 新者胜，相等取服务端。漏传条目不删除云端，删除继续使用 tombstone。
- 服务端继续校验 kind / itemId / payload / 时间；超过服务端时间 10 分钟的客户端 `updatedAt` 钳制为服务端当前时间，落后的时间不改。行版本与 payload `updatedAt` 使用规范化后的同一时间，客户端接受响应外层条目 `updatedAt`。
- `deleted` 在 Postgres 映射为 boolean，路由不再用 `row.deleted === 1` 判断；驱动返回的 JSONB 对象无需按 MySQL 字符串重复解析。tombstone 的 payload 为 SQL NULL，不丢弃未确认删除。
- `fd:dataOwner` 独立于 `fd:auth`，退出 / 401 保留归属。身份确认后若归属不同或无法确认，先清业务域与 tombstone；清理或归属落盘失败不接纳新身份。冷启动 token 仍经 `/api/auth/session` 验证。
- 会话设置、恢复、退出、开始清除均推进内存代次；请求、响应、401、防抖任务绑定代次。登录同步超时作废上下文，迟到任务不能覆盖新会话或继续 PUT。
- PUT 发送深拷贝快照，响应与当前本地条目逐键比较；在途修改保留并触发下一轮 PUT，未改动项接受服务端版本。仅真实服务端 GET/PUT 条目确认删除；被钳制且仍与发送快照一致的 tombstone 继续可由 PUT 确认。
- `DELETE /api/sync` 按 Bearer 用户删除全部同步行，包括其他设备创建而当前设备未拉取的条目；事务提交后返回 `{ cleared: true, items: [], serverTime }`。不删除 `users` 行或 Redis 会话，不注销账号。
- 清除前暂停同步、作废旧上下文并等待已发 PUT 结束；只有服务端明确确认且本机落盘成功才提示已清除。会话切换后不清新会话数据。用户锁之前完成的 PUT 被清除，锁之后执行的 PUT 属于清除后的新写入；其他在线 / 离线设备未来仍可写入。
- 401 保留本地业务数据供同一身份重登合并；同步限流、512 KiB body 限制、扫描 `photoPaths: []`、照片不上云、2D 拖动不落盘等约束全部延续。

本节约束后续 server 改造不得破坏既有行为；不是要求在本 PR 或实现 PR 重写小程序同步层。

## 环境变量（仅名字）

后续实现从 `server/src/env.ts`、启动组装、测试夹具与 `server/.env.example` 移除 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`。数据库连接配置只保留单一 `DATABASE_URL`，不新增 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 或拆分的 `PG*` 环境变量。

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | 专用项目 Transaction pooler 的 Postgres URI；包含数据库登录信息，只从受保护环境注入。 |
| `WECHAT_APPID` | 与小程序 AppID 相同。 |
| `WECHAT_APPSECRET` | 微信 code2Session，永不提交。 |
| `REDIS_HOST` | ECS / 内网 Redis 主机。 |
| `REDIS_PORT` | 未设时进程默认 `6379`。 |
| `REDIS_PASSWORD` | 仅 development 允许空字符串；production 必填。 |
| `REDIS_DB` | 未设时进程默认 `0`。 |
| `SESSION_SECRET` | HMAC 会话密钥，至少 32 字符。 |
| `PORT` | Koa 端口，未设时进程默认 `3000`。 |
| `NODE_ENV` | `production` / `development`。 |

缺少 `DATABASE_URL`、微信必填变量或合格 `SESSION_SECRET` 时拒绝启动，错误不带密钥；production 的 Redis 密码要求不变。`.env.example` 只列上述名字与空值槽、保密注释，默认值在代码内处理，不粘贴 URI 模板或任何真实连接串、密码、`service_role` key。测试连接配置只用人工构造的非真实凭据。小程序构建变量 `TARO_APP_API_BASE_URL` / `TARO_APP_AI_RECOMMEND_URL` 保持不变。

## 后续实现的文件与依赖边界（本 PR 不修改）

| 真实路径 | 后续实现动作 |
| --- | --- |
| `server/src/db/mysql.ts` | 用 `server/src/db/postgres.ts` 替代；实现 `pg.Pool`、结果行映射、同一 client 事务与锁。 |
| `server/src/db/schema.sql` | 替换为本文 Postgres 初始化 schema，不保留 MySQL DDL。 |
| `server/src/db/syncItemWrite.ts` | 替换占位符与冲突 SQL，采用本文严格大于的条件 upsert。 |
| `server/src/db/ports.ts` | `MysqlPort` 改为中性 `DatabasePort`，`AppDeps.mysql` 改为 `db`；`SyncItemRow.deleted` 改 boolean。 |
| `server/src/index.ts`、`server/src/routes/auth.ts`、`server/src/routes/sync.ts` | 机械适配新依赖名与 boolean，不改路由、会话或协议。 |
| `server/src/env.ts`、`server/.env.example` | 移除 `MYSQL_*`，改为单一 `DATABASE_URL`；保留其他环境变量。 |
| `server/package.json`、`server/pnpm-lock.yaml` | 移除 `mysql2`，加入 `pg` 与开发期 `@types/pg`；不增加 `supabase-js`。 |
| `server/tests/fakes.ts`、`server/tests/mysql-write.test.ts` 及引用旧端口的测试 | 内存 MySQL 假实现改为中性内存仓库 / Postgres 兼容假实现；SQL 测试改测 Postgres 参数、boolean、原子条件与事务行为。 |

内存仓库必须模拟严格新者胜、`created_at` 不变、用户隔离、按用户串行及失败回滚，不能以现有空操作 `lockSyncUser` 证明真实锁语义。另用可注入的 `pg` 假 client 验证事务固定连接、提交 / 回滚与释放；真实 Postgres 集成测试验证 SQL、约束和竞争行为。常规单测不依赖真实微信、Redis 或 Supabase 项目。

## 对现有文档的关系

| 文档 / 约束 | 本设计如何对待 |
| --- | --- |
| `2026-11-03-openid-login-sync-design.md` 的 MySQL 栈、表结构、驱动、环境变量、ECS MySQL 部署指针 | **仅数据库部分被本文取代**：数据库改为专用 Supabase Postgres，ECS 不再要求安装 MySQL 或开放 `3306`。原文留作历史记录，本 PR 不重写。 |
| 同一设计的登录 / API / 会话 / 同步，以及文末 PR #15 修复补充 | 继续有效；MySQL 原子 upsert 与用户行锁的语义由本文 Postgres SQL 承接。 |
| `docs/superpowers/plans/2026-11-03-openid-login-sync.md` | 已落地的历史计划，不在本 PR 改写；数据库替换另写实现计划。 |
| MVP、M4 / M5 的照片不上云、布局坐标不持久化、个人主体不收手机号 | 全部继续有效。 |
| `docs/weapp-publish-checklist.md` 与「我的」隐私文案 | 微信 openid 登录、云同步、退出 / 清除语义继续有效；本次不提审、不新增数据类别或权限，不修改这些文件。 |
| 现有 `server/`、依赖与 `.env.example` | 本设计描述目标状态，当前实现仍是 MySQL；仅在后续实现 PR 同步更新，不能把本文当作已经切库。 |

## 验收标准（本设计落地后）

本设计 PR 验收：仅新增本文件，schema 与事务 SQL 完整，无真实凭据、占位待决项或业务代码改动。下列条目用于后续实现计划与实现 PR，不表示本 PR 已实现或已连接 Supabase：

1. 专用项目区域为 `ap-southeast-1`，未复用 `jnbjt` / `food-notes`；空库 schema 可执行，用户唯一键、六种 kind、条目主键、外键级联和索引均存在。非法 kind / 外键被拒绝；用户删除级联清条目。
2. API 通过 `pg` + Transaction pooler URI 访问 Postgres；运行依赖无 `mysql2` / `@supabase/supabase-js`，无 `service_role` 数据访问；根目录小程序依赖不加入服务端驱动。
3. 两次及并发相同 openid 登录得到同一个 `user.id`；微信 `code2Session`、Redis `sess:*`、Bearer 验证、会话恢复 / 退出和原有限流继续工作。无效会话仍返回 401。
4. UUID 以字符串往返，JSONB 对象 / SQL NULL、boolean、UTC 毫秒时间映射正确；不因数据库布尔类型改变而丢失 tombstone，不因时区改变而改写冲突顺序。
5. 较新 / 相等 / 较旧版本、删除与复活、10 分钟钳制、重复请求键、跨用户同 itemId 均通过回归。较新版本的 payload / deleted / updated_at 一起更新，其他版本不覆盖，`created_at` 不变。
6. 用真实隔离 Postgres 测试库、两个独立连接及可控锁顺序验证：同用户 PUT 串行；PUT 先于清除则条目被删；清除先于 PUT 则允许新写入；不同用户互不清除。故意使事务中途失败后无部分写入，连接被释放。内存测试不能替代该 SQL 集成验证；测试库不使用生产数据。
7. `GET|PUT /api/sync` 响应与 `DELETE /api/sync` 的提交后确认保持兼容；跨设备全量清除、`fd:dataOwner`、代次、迟到响应、在途编辑、401 不丢本地数据与 tombstone 确认测试保持通过，小程序业务代码无需改动。
8. 通过 `pnpm --dir server test`、`pnpm --dir server typecheck`、`pnpm test`、`pnpm typecheck`，并执行第 6 项真实 Postgres 集成测试；普通单测使用 Postgres 兼容假实现 / 内存仓库，不连接线上服务。
9. 环境校验与示例不再使用 `MYSQL_*`；`DATABASE_URL` 缺失时启动失败；其他必填与默认值保持原规则。仓库、示例、PR 说明和日志不包含真实连接串、密码或 key。匿名 / authenticated 角色无两表访问权限，Data API 已禁用。

## 后续工作（实现顺序指针）

1. **确认本设计**，以本设计 PR 审阅结果锁定数据库替换边界。
2. **写实现计划**：另建 `docs/superpowers/plans/2026-11-04-mysql-to-supabase-postgres.md`，据本文拆解驱动、schema、端口映射、假实现与集成验收。
3. **创建专用项目**：由 Nero 在 Supabase 新建 `ap-southeast-1` 项目；或助手获得明确确认后调用 `create_project`。设置访问边界，经受保护渠道提供管理 / pooler 配置，不向仓库或 PR 粘贴凭据。
4. **改 server 驱动与 schema**：按计划替换 `mysql2` 为 `pg`、初始化空库、适配事务和 boolean、更新 `DATABASE_URL` 与测试，不改小程序协议。
5. **跑测试**：完成单测、类型检查和真实隔离 Postgres 的 schema / 并发验证，记录结果；不部署 ECS、不推生产。
6. **开实现 PR**：提交上述实现与测试证据，单独审阅。后续 ECS 配置只需 Node 22 + Koa2 + Redis 与出站数据库 TLS；实际部署仍须另获 Nero 确认。

## 范围锁定（自检）

- 本文已选定 `pg`、Transaction pooler、UUID、`TEXT + CHECK`、`TIMESTAMPTZ(3)`、JSONB、BOOLEAN 与完整约束，不留待决占位。
- 用户行锁串行 PUT / 清除与原子严格新者胜已写成 Postgres SQL，不弱化 PR #15 的归属、代次、tombstone 或清除边界。
- 本 PR 唯一交付物为本规格；不改 `server/`、小程序、示例或依赖，不创建真实项目、不执行 SQL、不部署、不提审、不推生产。
- 数据库凭据与所有密钥只经受保护环境注入，不进入仓库、示例、日志或 PR。
