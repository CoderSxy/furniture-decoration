# OpenID 登录与全量同步 Codex Review（PR #14）

## 总评

**不建议合并。** 基于当前分支相对 `origin/main` 的差异审查，最大风险是换账号后将前一用户的数据上传给后一用户，以及同步过程中丢失修改、删除记录。六类同步域、Bearer/HMAC、Redis 会话和 SQL 参数绑定已实现，但核心数据隔离与冲突处理尚未满足验收。以下两个客户端数据问题已通过只读内存复现确认；全程未修改文件、提交或推送。

## 问题清单（按严重度）

| 严重度 | 位置 | 问题 | 建议 |
|---|---|---|---|
| **P0** | `src/stores/syncStore.ts:46`；`authSession.loginWithWeChat`；`syncEngine.runLoginSync` | **退出或 401 后换账号会串数据。** `clearSession()` 同时清掉 `userId`，却保留业务数据；随后登录 B 时 `previousUserId` 为 `null`，跳过跨用户清理，把 A 的本地记录合并并上传到 B。持久化重新启动后也无法判断原数据归属。 | 独立持久化业务数据所属用户；清会话时保留归属信息，确认新用户身份后先隔离或清理旧数据，再启动同步。 |
| **P0** | `src/utils/syncEngine.ts:162–171`，`schedulePush` | **PUT 响应覆盖请求期间的新修改。** 请求发送快照后，用户新增或修改条目，返回时仍直接 `applySyncItems(snapshot.items)` 整表替换。后续 queued PUT 收集到的已是被覆盖的数据。已复现：请求期间新增收藏，旧响应到达后收藏消失。 | 记录请求发送时的版本；响应到达后保留请求期间产生的修改，再安排下一轮 PUT，并正确处理服务端时钟钳制。 |
| **P0** | `src/utils/syncEngine.ts:149、210–211、230–232`；`tombstones.dropAckedTombstones` | **本地 tombstone 被误当作服务端确认。** GET 后把本地与远端合并，再传给 `applySyncItems`；其中本地 tombstone 被 `dropAckedTombstones` 自行确认并删除。随后 PUT 不含删除，云端旧记录下次拉取会复活。已复现登录 PUT 缺少待上传删除记录。 | 仅使用真实服务端响应确认 tombstone；本地合并结果不得充当确认凭据。 |
| **P0** | `server/src/routes/sync.ts` 的读后比较；`server/src/db/mysql.ts:51–62` | **并发 PUT 可让旧条目覆盖新条目。** 两个事务均可读到相同旧版本，各自通过比较；最终 upsert 无条件覆盖。较旧请求最后写入时，会覆盖新版本或新 tombstone。普通事务并未消除这个窗口，违反“updatedAt 新者胜”。 | 在数据库写入中原子比较时间，或采用完整的锁与并发重试方案；同时保证相等时保留已有版本。 |
| **P1** | `server/src/routes/sync.ts` 的 `clampUpdatedAt`；`src/utils/syncEngine.ts` 的 collect/apply | **钳制后的同步时间没有传回业务条目。** 服务端只修改外层 `updatedAt`，payload 内仍是超前时间；客户端应用时丢弃外层时间，再从 payload 重建上传时间。快时钟设备的旧记录因此会反复被当作“新修改”，再次覆盖正常设备数据。 | 明确唯一权威版本时间；服务端响应与客户端存储、收集必须一致使用该时间。 |
| **P1** | `src/utils/syncEngine.ts:235–245`；`apiClient.apiRequest` | **同步缺少会话边界与取消机制。** 8 秒 `Promise.race` 超时不会停止旧任务；退出或换用户后，旧响应仍能写当前 store，后续 `pushNow()` 又读取当前 token。旧请求的 401 也可能清掉新会话。 | 请求绑定用户及会话代次；响应应用、401 清理和后续 PUT 前核对代次，退出时取消或废弃旧任务与定时器。 |
| **P1** | `src/utils/authGate.ts:isLoggedIn`；`src/pages/login/index.tsx:useDidShow` | **登录门闩只判断非空 token。** Redis 会话已过期或被删除时，登录页仍立即进入 Tab，等待异步同步得到 401 才退出；离线或服务异常时则可一直停留。未实现设计要求的“有效 Bearer 会话”门闩。 | 恢复会话时先验证，再开放 Tab；明确并测试验证失败时的行为。 |
| **P1** | `src/utils/resetMock.ts:clearMyDataCloud` | **“清除我的数据”只清除本机已知条目。** 另一设备新建、当前设备尚未拉取的云端记录不会产生 tombstone；PUT 响应被忽略，却提示“已清除”。重新同步后这些记录重新出现。 | 提供当前用户全量清除的服务端操作，并定义并发写入语义；客户端根据确认结果清理本地数据。 |
| **P1** | `docs/weapp-publish-checklist.md:60` | 可直接粘贴的摄像头隐私用途仍承诺测量数字“只保存在用户本机，不上传服务器”，但 `scan` 域实际上传长宽高，与清单 §3.3 及实现矛盾。 | 改为明确尺寸数字会同步，参考照片和录像不上云；检查所有可粘贴隐私文案。 |
| **P2** | `server/src/services/validateSync.ts`；`syncEngine.applySyncItems` | 除 plan 外，多类 payload 标识未与 `itemId` 校验一致，内部时间仅检查非空。客户端却按 payload 的 `planId/productId/updatedAt` 重建条目，可能改变同步键或冲突结果。 | 校验条目键与 payload 标识一致，并统一验证、规范化时间；客户端按契约解析响应。 |
| **P2** | `src/utils/apiClient.ts`；`src/utils/authSession.ts` | 登录接口的 `401 INVALID_CODE` 被统一转换为 `UNAUTHORIZED`，导致专门的“登录已过期，请再点一次”分支无法命中，还触发重新打开登录页。 | 区分登录业务错误与受保护接口的会话失效，保留服务端错误码。 |
| **P2** | `server/package.json`；`server/src/index.ts`；README 后端启动说明 | 文档要求配置 `server/.env` 后运行 `dev`，但脚本及入口没有加载 `.env`；仅创建文件不会将变量注入 `process.env`，会报 `missing env`。 | 显式加载环境文件，或把文档改为准确的环境变量注入命令。 |

## 与设计的偏差

**可接受／已符合：**

- `server/` 独立 Koa2 工程；微信 code 仅在服务端换取 openid。
- 会话采用 HMAC 校验、Redis 查询及滑动续期；登录响应不返回 openid 或 `session_key`。
- SQL 使用参数绑定，同步查询和写入均以会话 `userId` 限定；未发现直接 SQL 注入或通过请求体指定其他用户的路径。
- 六类 kind 已接入；客户端上传和服务端存储均将扫描 `photoPaths` 置空。未发现新增手机号采集接口或真实密钥。

**需回写设计：**

- “清会话但保留业务数据”必须同时定义独立的数据归属标识。
- PUT 整表替换必须定义在途修改如何保留。
- 全量清除、同步取消及跨会话响应处理需要明确语义。部分实现虽沿用了计划示例，仍不满足设计验收目标。

**需改代码：**

上述 P0/P1 均应在合并前解决；其中用户隔离、删除不复活、updatedAt 新者胜属于核心验收要求。

## 测试与验证缺口

- **已执行：** 根目录 `tsc --noEmit` 通过；使用现有 TypeScript 编译器做内存转译、运行原实现，复现了 tombstone 提前丢失和在途修改被覆盖。
- **未完成：** 环境为 Node `v20.19.2`，执行仓库测试命令报 `bad option: --experimental-strip-types`；服务端依赖未安装。因此不能声称前后端测试全绿。未安装依赖、生成构建产物或执行真实服务联调。
- `tests/sync-engine.test.ts` 覆盖了请求顺序与防抖次数，但未验证在途修改保留、GET 合并后删除仍会上传、换账号完整流程及超时任务迟到。
- `server/tests/fakes.ts:memoryMysql` 不模拟事务隔离、锁、回滚和数据库排序规则。现有顺序冒烟无法发现真实 MySQL 的并发覆盖问题。
- `tests/auth-gate.test.ts` 用非空测试 token 及源码包含 hook 验证门闩，不能证明失效会话进不了 Tab。
- `tests/publish-checklist.test.ts` 检查关键词，仍会放过“尺寸不上传”的矛盾声明。
- `tests/openid-no-phone.test.ts` 的密钥扫描仅覆盖有限赋值格式，不含数据库密码，且 `rg ... || true` 会掩盖工具失败，存在假绿风险。

还需用 Node 22、真实 MySQL/Redis 验证并发写入、会话过期和回滚；用微信开发者工具或真机验证启动门闩、合法域名和照片请求边界。当前无 CORS 中间件对限定 weapp 的范围不构成缺陷；代理部署则需明确由 Nginx 覆写转发头、限制 Koa 端口访问，当前 `clientIp()` 直接信任 `X-Forwarded-For`。

## 建议下一步（最多 5 条）

1. 优先修复业务数据归属与会话代次，补完整的退出、401、换账号回归。
2. 修复 PUT 在途修改覆盖和 tombstone 确认来源，增加可控延迟的同步测试。
3. 将时间比较落实为数据库原子操作，并统一钳制后的权威时间。
4. 实现可靠的全量清除，修正隐私文案及环境加载说明。
5. 在 Node 22、真实 MySQL/Redis 和微信环境完成验收，再考虑合并。
