# 家具装修

微信小程序「家具装修」MVP。当前里程碑：**M3 成本预算进度条**（总额 / 类目占用 / 阶段进度 / 超支 / 重置 mock）。

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

## M3 行为

- 新建方案时按面积生成预算：`totalFen = round(areaM2 * 80000)`（800 元/㎡）。不手填总额。
- 家具占用 = 当前方案内商品 `priceFen` 之和。收藏未加入方案的商品不计。材料 35%、人工 25%、其他为剩余且不小于 0。
- 预算页展示总额、四类目占用条（百分比封顶 100%）、阶段进度（量房 15 / 设计 40 / 施工 75 / 验收 100）。家具超过总额时该类目条满格，总额旁显示「已超支」。
- 无当前方案时空态「还没有当前方案」+「去方案看看」。
- 「收藏中有 N 件尚未加入当前方案」在 N>0 时出现，点击跳转「我的」；全部加入后消失。
- 方案详情增删商品后切回预算 Tab，家具占用立即变化。切换当前方案，预算跟着变。
- 「我的」提供「重置 mock」：清除 `fd:favorites` / `fd:plans` / `fd:budgets` / `fd:scans`，商品 mock 不受影响。
- 预算写入 Taro storage，key 为 `fd:budgets`。

## 约束

- 密钥、云密钥、模型 Key 不进仓库、不在聊天明文粘贴。
- 未经 Nero 确认：不部署、不推生产、不提交小程序审核、不把体验版当正式发布。
- 本仓库只交付 weapp。不涉及支付、不生成订单。
