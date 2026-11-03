# 家具装修

微信小程序「家具装修」MVP。当前里程碑：**M2 装修方案流程**（方案卡片 / 新建 / 当前方案 / 四阶段 / 加入当前方案）。

## 环境

- Node.js `>=22.23.4 <23`（推荐 22.23.4）
- pnpm 10.x
- 微信开发者工具（稳定版）

本机自备 AppID。把真实 `appid` 写在 `project.private.config.json`（已 gitignore），仓库内 `project.config.json` 只保留占位 `touristappid`。

## 本地运行

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm dev:weapp
```

`pnpm dev:weapp` 会把 weapp 产物写到 `dist/`。用微信开发者工具「导入项目」：

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

## M2 行为

- 方案 Tab：卡片展示标题、房间、面积、当前阶段（量房 / 设计 / 施工 / 验收）、封面。当前方案有「当前」标记。空态为「还没有方案」+「新建方案」。
- 新建必填标题、房间、面积（面积 > 0）。新建后 `stage = measure`，并成为 `activePlanId`。
- 「设为当前」只切换 `activePlanId`；点卡片进入 `pages/plans/detail?planId=`，不自动切换当前方案。
- 详情：四阶段时间轴；已选商品可移除；「推进到下一阶段」。量房→设计要求至少 1 件商品，否则按钮禁用并提示「请先去选品」。阶段只能前进一档，验收为终态。
- 选品详情：「加入当前方案」。无当前方案时按钮为「请先新建方案」，并 `switchTab` 到方案 Tab。
- 方案写入 Taro storage，key 为 `fd:plans`（含列表与 `activePlanId`）。杀掉编译进程后重进，方案、当前方案与阶段仍在。

## 约束

- 密钥、云密钥、模型 Key 不进仓库、不在聊天明文粘贴。
- 未经 Nero 确认：不部署、不推生产、不提交小程序审核、不把体验版当正式发布。
- 本仓库只交付 weapp。
