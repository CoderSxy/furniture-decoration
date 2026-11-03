# 家具装修

微信小程序「家具装修」MVP。当前里程碑：**M1 家具选品**（列表 / 筛选 / 详情 / 收藏）。

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
5. 详情封面使用 `picsum.photos` 占位图：详情里勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」，否则封面可能空白。

生产构建：

```bash
pnpm build:weapp
```

## Zustand + Vite 开发编译

开发配置 `config/dev.ts` 已设置 `mini.debugReact: true`，用于规避 Zustand 5 在 Taro Vite `dev:weapp` 下的 `taro.react_production_min.create is not a function`。修改该配置后必须重新跑 `pnpm dev:weapp`。

## M1 行为

- 选品 Tab：卡片展示封面、名称、品类、风格、价格（元，由 `priceFen` 四舍五入）。
- 点「筛选」展开品类 / 房间 / 风格 / 价格区间，条件可组合；「清空筛选」恢复全量。
- 点卡片进入 `pages/catalog/detail?productId=`；详情可收藏 / 取消收藏。收藏写入 Taro storage，key 为 `fd:favorites`。
- 「我的」展示收藏列表。杀掉编译进程后重进，收藏仍在。
- M1 没有「加入方案」按钮（M2 才加）。

## 约束

- 密钥、云密钥、模型 Key 不进仓库、不在聊天明文粘贴。
- 未经 Nero 确认：不部署、不推生产、不提交小程序审核、不把体验版当正式发布。
- 本仓库只交付 weapp。
