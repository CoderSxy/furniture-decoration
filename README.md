# 家具装修

微信小程序「家具装修」MVP。当前里程碑：**M5 AI 选品 + 2D/轻量 3D 预览**（本地 mock 推荐 / 2D 俯视必达 / xr-frame cube 增强）。

## 环境

- Node.js `>=22.23.4 <23`（推荐 22.23.4）
- pnpm 10.x
- 微信开发者工具（稳定版）
- 预览 3D 需要基础库 `>= 2.32.0`。开发者工具或真机若不支持 xr-frame，页面隐藏 2D/3D 切换并显示「当前基础库不支持 3D 预览」，2D 仍可用。

`project.config.json` 已写入 Nero 的 AppID `wx678305a130615b19`。`project.private.config.json` 仍 gitignore，只放本机覆盖，不要提交 AppSecret。个人主体提审准备（简介、类目、隐私指引、体验版上传）见 [docs/weapp-publish-checklist.md](docs/weapp-publish-checklist.md)。备案 / 提审 / 正式发布由 Nero 本人操作。

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
3. 确认 AppID 为 `wx678305a130615b19`。上传体验版与提审文案见清单；不要把体验版当正式发布。
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

## 隐私指引

可粘贴的完整文案、类目建议与提审补充说明见 [docs/weapp-publish-checklist.md](docs/weapp-publish-checklist.md)。公众平台填写时（不要把 AppSecret 写进仓库）：

1. **访问你的摄像头**：用于量房时识别地面并测量长宽。
2. **选中的照片或视频信息**：用于降级路径选择最多 3 张参考图，仅保存在本机，不会上传。

代码在调用相机前走 `requirePrivacyAuthorize` 与 `scope.camera`。备案 / 提审 / 发布由 Nero 本人操作。

## 约束

- 密钥、云密钥、模型 Key 不进仓库、不在聊天明文粘贴。
- 未经 Nero 确认：不部署、不推生产、不提交小程序审核、不把体验版当正式发布。
- 本仓库只交付 weapp。不涉及支付、不生成订单。
