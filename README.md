# 家具装修

微信小程序「家具装修」MVP。当前里程碑：**OpenID 登录与全量同步**（强制微信登录，收藏 / 方案 / 预算 / 扫描 / AI 快照按 `updatedAt` 同步到仓库根目录 `server/`）。

## 环境

- Node.js `>=22.23.4 <23`（推荐 22.23.4）
- pnpm 10.x
- 微信开发者工具（稳定版）
- 本地联调后端需要 MySQL 8（utf8mb4）与 Redis；测试用内存假实现，不连真实 RDS
- 预览 3D 需要基础库 `>= 2.32.0`。开发者工具或真机若不支持 xr-frame，页面隐藏 2D/3D 切换并显示「当前基础库不支持 3D 预览」，2D 仍可用。

`project.config.json` 已写入 Nero 的 AppID `wx678305a130615b19`。`project.private.config.json` 仍 gitignore，只放本机覆盖，不要提交 AppSecret。个人主体提审准备（简介、类目、隐私指引、体验版上传）见 [docs/weapp-publish-checklist.md](docs/weapp-publish-checklist.md)。备案 / 提审 / 正式发布由 Nero 本人操作。

在未跟踪的根目录 `.env` 里设置 `TARO_APP_API_BASE_URL`（无尾斜杠）后，登录才会请求自建 API。不要把模型 Key、Authorization、AppSecret 或真实 URL 写进仓库。未设置 `TARO_APP_AI_RECOMMEND_URL` 时 AI 选品仍用 `src/mocks/aiRecommend.ts`。

## 本地运行

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build:weapp
```

后端（仓库根目录 `server/`，自有 `package.json`，不进 weapp 依赖）：

```bash
pnpm --dir server install
pnpm --dir server test
pnpm --dir server dev
```

`server/.env` 只放在本机，变量名见 `server/.env.example`：`WECHAT_APPID`、`WECHAT_APPSECRET`、`MYSQL_*`、`REDIS_*`、`SESSION_SECRET`、`PORT`、`NODE_ENV`。不要把 AppSecret 或数据库密码写进仓库。小程序侧同步依赖根目录 `.env` 的 `TARO_APP_API_BASE_URL`。

AI / 预览在分包 `packagePreview`。**xr-frame 热更新不可用**。请用 `pnpm build:weapp` 后用微信开发者工具打开 `dist/` 预览 3D，不要只靠 `dev:weapp` HMR 判断 cube 场景。

`pnpm dev:weapp` 仍会把 weapp 产物写到 `dist/`。用微信开发者工具「导入项目」：

1. 目录选本仓库根目录。
2. 确认 `project.config.json` 的 `miniprogramRoot` 为 `dist/`（或 `./dist`）。
3. 确认 AppID 为 `wx678305a130615b19`。上传体验版与提审文案见清单；不要把体验版当正式发布。
4. 冷启动无 token 时第一屏为登录页。登录后底部四个 Tab 为「选品 / 方案 / 预算 / 我的」。
5. 封面使用 `picsum.photos` 占位图：详情里勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」，否则封面可能空白。

生产构建：

```bash
pnpm build:weapp
```

## Zustand + Vite 开发编译

开发配置 `config/dev.ts` 已设置 `mini.debugReact: true`，用于规避 Zustand 5 在 Taro Vite `dev:weapp` 下的 `taro.react_production_min.create is not a function`。修改该配置后必须重新跑 `pnpm dev:weapp`。

## OpenID 登录与同步

- 登录页是 `app.config.ts` 的 `pages` 第一项，不进 `tabBar`。无有效 Bearer 时不能进入选品 / 方案 / 预算 / 我的。
- 只使用 `Taro.login` 的 `code` 换 openid，**不获取手机号**，没有跳过登录后门。
- 登录后全量同步：收藏、方案、当前方案、预算、扫描尺寸、AI 选品快照。冲突按条目 `updatedAt` 严格晚者胜。
- 扫描 `photoPaths` 上云前一律 `[]`，客户端不 `Taro.uploadFile`。2D 拖动坐标仍不进 `fd:*`。
- 「我的」可退出登录（保留本机业务数据）或清除我的数据（tombstone 后清空云端与本机业务记录）。

## M5 行为（仍有效）

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

## 隐私指引

可粘贴的完整文案、类目建议与提审补充说明见 [docs/weapp-publish-checklist.md](docs/weapp-publish-checklist.md)。公众平台填写时（不要把 AppSecret 写进仓库）：

1. **访问你的摄像头**：用于量房时识别地面并测量长宽。
2. **选中的照片或视频信息**：用于降级路径选择最多 3 张参考图，仅保存在本机，不会上传。
3. **用户标识（openid）**：识别同一微信用户并同步业务数据。不收集手机号、昵称或头像。

代码在调用相机前走 `requirePrivacyAuthorize` 与 `scope.camera`。备案 / 提审 / 发布由 Nero 本人操作。

## 约束

- 密钥、云密钥、模型 Key 不进仓库、不在聊天明文粘贴。
- 未经 Nero 确认：不部署阿里云 ECS / RDS / Redis、不备案解析、不装证书、不提交小程序审核、不把体验版当正式发布。
- 个人主体禁止 `getPhoneNumber` / `getUserProfile`。openid 是唯一用户标识，不得下发客户端。
- 后端在 `server/`（Node 22 + Koa2 + MySQL + Redis），根目录 weapp 的 `package.json` 不含 `koa` / `mysql2` / `ioredis`。
