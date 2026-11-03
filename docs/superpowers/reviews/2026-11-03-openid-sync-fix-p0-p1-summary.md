# OpenID P0 / 关键 P1 修复交接

日期：2026-11-03。分支：`fix/openid-sync-p0-p1`。起点 HEAD：`88f2c3410509b0d59d4fe2429b0fd6a65e40e6ac`。

代码与测试已修改，但交付未全部完成：当前沙箱把 `.git` 设置为只读，因此不能创建本地 commit。未推送、未建 PR、未部署、未提审；原 review 保留原文，未改成通过。

## 已实现

1. P0 账号隔离：新增独立持久化的 `fd:dataOwner`。退出、401 保留归属；新微信身份确认以及冷启动 Bearer 验证后，检查归属，先清业务数据及 tombstone 再开放同步。旧有效 auth 迁移归属，无法确认旧归属时保守清理。归属写入或旧数据清理失败不接纳新身份。
2. P0 在途修改：PUT 使用深拷贝发送快照，响应逐键与当前条目比较；保留在途新增、修改、删除，并安排后续 PUT。
3. P0 删除确认：apply 合并结果不再 dropAck；只用真实 GET/PUT 响应确认 tombstone。PUT 发送后未变化的 tombstone 可由钳制后的真实删除响应确认。
4. P0 MySQL 并发写：SQL upsert 在写入侧以严格 `>` 原子判断 payload/deleted/updated_at，时间最后赋值，相等保留已有。PUT 同时锁当前用户行，与全量清除串行。
5. P1 权威时间：服务端存储及返回 payload 使用规范化外层 updatedAt；客户端 apply 回写五类业务条目的 updatedAt，preference 使用外层时间，collect 不再重建未来版本。
6. P1 会话边界：内存 generation、同步上下文取消、定时器失效；超时/退出/换账号后的旧响应不写 store、不继续 PUT；旧 401 不清新会话。退出立即清本机会话，不等待网络。
7. P1 登录门闩：新增受保护的 GET `/api/auth/session`。恢复 token 未经真实验证不进入 Tab；过期、网络失败或身份不符留在登录页。
8. P1 全量清除：新增 DELETE `/api/sync`，只按 Bearer 用户全量删除云端同步行，包括本机未拉取的记录。客户端暂停同步、等待在途 PUT、验证明确 `cleared: true` 且 items 为空，再清本机；本机保存失败或会话变化不假报成功。
9. P1 隐私文案：摄像头用途与提审说明统一为尺寸数字登录后同步、参考照片和录像不上云。
10. 小范围修正现有安全扫描：rg 显式路径与关闭 stdin，防止全套测试等待 stdin；工具错误不再被 `|| true` 掩盖；扩展数据库/Redis 密码赋值扫描。
11. 设计文档追加归属、在途请求、会话和全量清除语义，保留原 review。

清除并发语义：同一用户的 PUT 与 DELETE 以用户行锁排序，清除前完成的写入被删除；清除之后执行的 PUT 可以作为新数据写入。此操作不是账号注销，不禁止其他设备未来重新写入。

## 测试与命令

均使用 Node `v22.23.4`：

```sh
export PATH="/home/box/.local/share/fnm/node-versions/v22.23.4/installation/bin:$PATH"
export COREPACK_HOME=/home/box/.local/share/corepack
```

- `pnpm test`：退出 0，49 个测试文件通过，0 失败。最终日志 `/tmp/openid-final-client-tests.log`。
- `pnpm typecheck`：退出 0。
- `node --experimental-strip-types --import ./tests/preload-taro-globals.cjs tests/sync-safety.test.ts`：9 条通过；最初 6 条已先观测到原实现的断言失败后修复。
- `tests/clear-cloud.test.ts`：2 条先红后绿，覆盖明确确认、网络失败保留本机、等待在途 PUT 并取消排队同步。
- `tests/login-page.test.ts` 与 `tests/auth-gate.test.ts`：过期/离线门闩及恢复身份与归属不一致均先观测失败后修复。
- `node --experimental-strip-types --test server/tests/mysql-write.test.ts`：退出 0；无条件 SQL 先触发断言失败，修复原子比较后通过。此项只验证生产 SQL 发出契约，不等价于真实 MySQL 并发验证。
- `pnpm --dir server install`：默认缓存路径只读（EROFS）。改用 `/tmp/openid-pnpm-store` 后网络 EAI_AGAIN；复制只读现有缓存到 /tmp 后离线安装仍缺少 `@koa/bodyparser` 等包，无法完成依赖安装。
- `pnpm --dir server test`：退出 1；10 个文件中 5 通过，5 因缺少 Koa 不能加载：auth-login、auth-middleware、health、smoke、sync。最终日志 `/tmp/openid-final-server-tests.log`；直接运行 sync 测试确认 `ERR_MODULE_NOT_FOUND: koa`，见 `/tmp/openid-server-missing.log`。
- `pnpm --dir server typecheck`：退出 1，`tsc: not found`（服务端依赖未装完整）。
- `git diff --check`：退出 0。
- `git add src tests`、`git commit -m "fix(sync): isolate account data and preserve in-flight changes"`：均因无法创建 `.git/index.lock`，只读文件系统而失败，无 commit 产生。

## 待协调者完成

- 在可写 .git 的环境按多 commit 提交；已准备三份补丁：
  - `/tmp/openid-sync-fixes/001-client.patch` → `fix(sync): isolate account data and preserve in-flight changes`
  - `/tmp/openid-sync-fixes/002-server.patch` → `fix(server): atomically merge sync writes and clear all user data`
  - `/tmp/openid-sync-fixes/003-docs.patch` → `docs: clarify sync ownership and camera privacy`
  补丁基于上述 HEAD，包含本次新增文件，不含原先未跟踪的 review。当前工作区已包含补丁内容，不应重复 apply。
- 依赖可安装后重跑服务端 test/typecheck。新增路由回归（有效/撤销会话、全量清除未拉取条目、权威时间、旧 PUT 最后完成不覆盖新 tombstone）未能在本沙箱执行，不能声称服务端通过或完成全套服务端 TDD 验证。
- 真实 MySQL 并发、事务回滚、Redis 失效、微信开发者工具/真机门闩与请求边界尚未覆盖。
- 未修纯 P2 payload 键校验、INVALID_CODE 映射、.env 自动加载。
- 指定交付路径 `/workspace/reviews/openid-sync-fix-p0-p1-summary.md` 位于沙箱可写根之外；复制被权限阻挡时，本文件及 `/tmp/openid-sync-fix-p0-p1-summary.md` 为完整替代件。
