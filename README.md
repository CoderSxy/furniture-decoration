# 家具装修

微信小程序「家具装修」MVP。当前里程碑：**M4 房型 / 空间扫描**（VisionKit v2 水平面测量 / 手填降级 / 方案详情平面图）。

## 环境

- Node.js `>=22.23.4 <23`（推荐 22.23.4）
- pnpm 10.x
- 微信开发者工具（稳定版）
- M4 主路径建议真机（至少 1 台 iOS 或安卓）。没有真机时只验收手填降级，并在对比文档标明「缺真机，VisionKit 主路径未测」。

本机自备 AppID。把真实 `appid` 写在 `project.private.config.json`（已 gitignore），仓库内 `project.config.json` 只保留占位 `touristappid`。

## 本地运行

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build:weapp
```

扫描页使用原生 `Camera` + VisionKit，**热更新不可用**。请用 `pnpm build:weapp` 后用微信开发者工具打开 `dist/` 预览，不要只靠 `dev:weapp` HMR 判断摄像头是否工作。

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

## M4 行为

- 方案详情且阶段为「量房」时显示「采集房型」，进入分包页 `/packageScan/pages/scan/index?planId=`。
- 基础库 `SDKVersion >= 2.22.0` 时尝试 VisionKit v2 水平面（`track.plane.mode: 1`）。地面两对点分别得到长度、宽度（毫米）；层高默认 2800mm 可改；`source` 为 VisionKit 测量。
- 不支持 v2、会话 `start` 失败、拒绝隐私或摄像头、开发者工具无 VK 时，降级为手填长宽高（均须 >0）+ 最多 3 张相册参考图。图片只存本地临时路径，不上云。`source` 为手动填写。
- 方案详情有扫描时显示「长 × 宽 × 高 mm」、简易矩形平面图、来源文案；无扫描不崩溃。
- 扫描写入 Taro storage，key 为 `fd:scans`，每方案一条，后写覆盖。
- 不引入 `threejs-miniprogram`，不把重建模型打进小程序包。不接支付、不接 AI。

## 隐私指引（实现期配置，本 MVP 不提审）

在微信公众平台 → 用户隐私保护指引声明（不要把密钥或真实 AppID 写进仓库）：

1. **访问你的摄像头**：用于量房时识别地面并测量长宽。
2. **选中的照片或视频信息**：用于降级路径选择最多 3 张参考图，仅保存在本机，不会上传。

代码在调用相机前走 `requirePrivacyAuthorize` 与 `scope.camera`。未经 Nero 确认不提交审核。

## 约束

- 密钥、云密钥、模型 Key 不进仓库、不在聊天明文粘贴。
- 未经 Nero 确认：不部署、不推生产、不提交小程序审核、不把体验版当正式发布。
- 本仓库只交付 weapp。不涉及支付、不生成订单。
