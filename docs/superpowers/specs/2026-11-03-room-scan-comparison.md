# M4 房型 / 空间扫描选型对比

日期：2026-11-03  
仓库：https://github.com/CoderSxy/furniture-decoration  
对照规格：`docs/superpowers/specs/2026-11-03-furniture-decoration-mvp-design.md`「### M4 房型 / 空间扫描选型」  
实现计划：`docs/superpowers/plans/2026-11-03-m4-room-scan.md`

本文只做选型。不引入 npm 重建模型、不改 `src/types/domain.ts`、不部署、不提审、不写密钥。实现 PR **不得删减**下表候选，**不得改推荐结论**，除非真机证明主方案不可行——那时只把「真机结论」节标为不可行并保留降级为必达。

## 对比要回答的问题

1. 哪个方案能在微信小程序 weapp 里量出房间长宽（毫米），并写入已有 `RoomScan`（`source: 'visionkit-v2' | 'manual'`）？
2. 许可证是否允许本仓库默认路径使用（明确排除 CC BY-NC / CC BY-NC-SA）？
3. 包体是否会把主包顶过 2MB，或把重建权重打进小程序包？
4. 照片 / 点云是否必须出端？摄像头隐私如何声明？

## 硬排除（本产品默认路径一律不做）

- 任何 **CC BY-NC** / **CC BY-NC-SA** 代码或权重进入本仓库、小程序包或默认推理路径。
- 任何把重建模型（DUSt3R / MASt3R / VGGT / MapAnything / Depth Anything 权重、glTF 家具库）打进小程序包的做法。
- 云端照片重建、第三方上传、支付、M5 AI / 3D 家具放置。
- 引入 `threejs-miniprogram` 做扫描（它也不能扫房间，且解压约 580KB）。

## 总表（设计调研范围，全部候选）

| 候选 | 许可证 | 维护度 | 包体 / 运行位置 | 小程序可行性 | 隐私 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| **微信 VisionKit v2 + xr-frame** | 平台能力，随微信客户端分发；无 npm 许可证 | 官方文档持续更新；xr-frame 基础库 2.32.0 起为稳定正式版 | **0 npm 体积**（运行时内置） | `wx.createVKSession({ version: 'v2', track: { plane: { mode: 1 } } })` + `hitTest` 得真实物理距离。iOS 基础库 2.22.0、安卓 2.25.1 起支持 v2；**安卓 v2 不支持竖直平面** | 须在用户隐私保护指引声明「访问你的摄像头」；调用前 `requirePrivacyAuthorize` + `scope.camera`。POC 结果只存本地 `fd:scans`，照片不上云 | **主方案** |
| **threejs-miniprogram** | MIT | 停更于 2021-04（Three r108），npm `0.0.8` | 解压约 580KB，易挤压主包 | 只能 WebGL 展示，**不能扫房间** | 不涉及摄像头，但解决不了扫描 | **排除**（不做扫描、不进包） |
| **DUSt3R / MASt3R**（Naver，2024） | **CC BY-NC-SA 4.0**（代码与权重均非商用） | 研究活跃（仓库 2025 仍有提交） | GPU 服务端，模型数百 MB，无法进小程序 | 多视图点图重建，与 weapp 无原生桥 | 房间照片必须出端 | **排除**（许可 + 出端 + 包体） |
| **Depth Anything V2 Small** | Small 权重 Apache-2.0；Base / Large / Giant 为 CC BY-NC 4.0 | 2024 活跃 | 服务端推理（Small 约 25M 参数，仍不宜进小程序） | 单目相对深度，**不是户型矢量** | 需上传图片 | **排除**（不是长宽高；默认证不把模型打进包） |
| **VGGT / MapAnything 等 2025 前馈重建** | 代码可商用；默认真权重普遍 CC BY-NC。MapAnything 另有 `facebook/map-anything-apache`；VGGT 商用权重须申请 `VGGT-1B-Commercial` | 论文级，迭代快 | 服务端 1B 级模型 | 无小程序运行时 | 同照片出端；商用常须另购/另训/申请权重 | **排除**（服务端 + 出端；不把权重打进包） |
| **Roomform**（2026） | 代码 Apache-2.0；训练权重 / 合成数据 CC BY-NC 4.0；部分 lifter（SpatialLM / UniDet3D）亦 CC BY-NC | 新仓库（2026-08） | 服务端；输入是已配准点云（`.ply` / `.npz`），不是手机视频 | 不能替代手机扫描 | 点云 / 照片出端 | **排除**（输入形态不对 + 权重 NC） |
| **COLMAP / GLOMAP** | BSD（new BSD / 3-clause） | 长期维护。GLOMAP 独立仓库已 deprecated，能力并入 COLMAP 4.x `global` mapper | 服务端 SfM，多图 + 算力 | 与小程序无直接关系 | 照片出端 | **排除**（无 weapp 运行时） |

为何不进小程序包（逐行）：VisionKit 本就在客户端里，无需打包；threejs 不能扫描且浪费主包；其余全部是服务端模型或 SfM 工具，体积与运行时都不属于 weapp。

## 分候选说明

### 1. 微信 VisionKit v2 + xr-frame（主方案）

- **许可证：** 微信客户端内置能力，不经过 npm，无 CC 条款。
- **维护度：** 微信公开文档持续更新（`wx.createVKSession` / `VKSession.hitTest` / `VKSession.start`）。xr-frame 自基础库 2.32.0 标为稳定正式版。Taro 4 文档有 `Taro.createVKSession` / `VKSession.hitTest`，**没有**把 xr-frame 当一等 React 组件。
- **包体 / 运行位置：** 0 npm。扫描逻辑必须放分包 `packageScan`，避免撑主包。
- **小程序可行性：**
  - v2 提供真实物理距离；`hitTest(x, y)` 返回列主序 4×4 `transform`，平移在 `[12, 13, 14]`，单位米。
  - 平面 `mode`：`1` 水平、`2` 竖直、`3` 水平+竖直。**POC 只用 `mode: 1`**，避开安卓 v2 无竖直平面。
  - 版本：设计能力探测阈为 `SDKVersion < 2.22.0` 直接降级；安卓实际 v2 要 2.25.1，更低的安卓会在 `start` 失败后降级。
  - `start` 失败常见：`104` 用户取消授权、`112` 隐私未声明、`2000002/2000003/2000004` 设备/系统不支持、`2003001/2003002` 无相机权限。失败必须 `destroy` 并走手填，不白屏。
- **隐私：** `createVKSession` 使用 `scope.camera`。隐私指引必须出现精确文案 **「访问你的摄像头」**。代码里先 `requirePrivacyAuthorize`，再 `authorize({ scope: 'scope.camera' })`。拒绝 → 降级。测量结果写入 `scanStore` / `fd:scans`；`photoPaths` 在主路径为空数组。
- **Taro 接入（本 POC 落地方式）：**
  1. **测量不依赖 xr-frame 场景。** 用 Taro 一等组件 `Camera`（编译为微信原生 `<camera>`）做取景，叠加透明 `View` 接收点击；JS 侧 `wx.createVKSession` / `Taro.createVKSession`。类型用本地 `src/types/vk.ts` + 可注入 factory，便于单测，不改 `domain.ts`。
  2. **不要**为了测量去渲染 `<xr-scene>`。社区结论：Taro 官方未把 xr-frame 当一等组件；Vite + TS 下原生 xr-frame 合成不稳定，且 **热更新不可用**，必须 `pnpm build:weapp` 后用微信开发者工具预览。xr-frame 留给 M5 轻量 3D，失败不挡 M4。
  3. 条件编译：本仓库只交付 weapp，扫描页不要写 H5 分支。`createVKSession` 仅在 weapp 运行时存在；探测函数对缺失 API 返回 `'manual'`。
- **主路径行为：** 地面两对点 → 第一对欧氏距离 `widthMm`，第二对 `depthMm`（米×1000 四舍五入）；`heightMm` 手填，默认 **2800**；`source = 'visionkit-v2'`；`photoPaths = []`。

### 2. threejs-miniprogram（排除）

- **许可证：** MIT（https://www.npmjs.com/package/threejs-miniprogram）。
- **维护度：** 最新 npm `0.0.8`，发布于 2021-04-25；内置 Three r108。GitHub `wechat-miniprogram/threejs-miniprogram` 基本停更。
- **包体：** unpacked ≈ 586.8KB（`dist/index.js` ≈ 583KB）。放主包会明显挤压 2MB 限额。
- **小程序可行性：** 只是 WebGL / Three 适配层，**没有**平面检测、没有米制 hitTest、不能扫房间。
- **隐私：** 不申请摄像头也无助于量房。
- **为何不进包：** 不能完成 M4 验收；浪费体积；与「扫描用微信 VisionKit v2（0 npm）；不新增 threejs / 重建模型 npm」冲突。

### 3. DUSt3R / MASt3R（排除）

- **许可证：** Naver 官方仓库声明代码与权重均为 **CC BY-NC-SA 4.0**（非商用）。https://github.com/naver/dust3r 、https://github.com/naver/mast3r 。商用须另签 Naver。
- **维护度：** 2024 论文；2025 仍有 submodule / demo 更新。属研究代码，不是小程序 SDK。
- **包体 / 运行位置：** PyTorch 权重数百 MB，需 GPU 服务端。无法进 2MB 主包或 20MB 分包。
- **小程序可行性：** 无 weapp 原生桥。即使自建云推理，也要把房间照片传出端，且违反本 MVP「不接真实后端 / 云开发」。
- **隐私：** 多视图重建默认上传照片；本 POC 禁止。
- **为何不进包：** CC BY-NC-SA 直接否决默认路径；模型体积否决；出端否决。

### 4. Depth Anything V2 Small（排除）

- **许可证：** 源码 Apache-2.0。**Small 权重 Apache-2.0**；Base / Large / Giant **CC BY-NC 4.0**。Giant 公开权重长期未放。https://github.com/DepthAnything/Depth-Anything-V2
- **维护度：** 2024 发布后有 Hugging Face 卡与社区跟进。
- **包体 / 运行位置：** Small ≈ 24.8M 参数，仍需深度学习运行时，定位服务端 / 端侧 App，不是小程序。
- **小程序可行性：** 输出单目相对深度图，**不是**长×宽×高矢量，也不能生成户型矩形。要得到毫米尺寸还得另做标定与平面拟合。
- **隐私：** 典型路径上传一张图到推理服务。
- **为何不进包：** 解决不了 `RoomScan` 的 width/depth/heightMm；禁止把权重打进小程序包；Base/Large/Giant 还踩 NC。

### 5. VGGT / MapAnything（排除）

- **许可证：** 2025 前馈重建常见切法是「代码可商用 / 默认真权重 CC BY-NC」。
  - VGGT（facebookresearch/vggt）：代码后来允许商用（排除军事）；**仅** `VGGT-1B-Commercial` 可商用，须申请；原权重仍非商用。
  - MapAnything（facebookresearch/map-anything）：代码 Apache-2.0；`facebook/map-anything` 为 CC BY-NC 4.0；另有 `facebook/map-anything-apache`（Apache-2.0，训练数据更少）。Apache 变体仍是服务端 1B 级模型。
- **维护度：** 论文级，仓库迭代快，API 与权重许可会变，不适合绑死小程序 MVP。
- **包体 / 运行位置：** 约 1B 参数，只能云 GPU。
- **小程序可行性：** 无运行时。要照片或多视图出端。
- **隐私：** 房间照片离开设备。
- **为何不进包：** 默认权重常 NC；即使 Apache 变体也不能塞进 weapp；本 MVP 不做云重建。

### 6. Roomform（排除）

- **许可证：** 代码 Apache-2.0；**训练权重 + 合成数据 CC BY-NC 4.0**。默认 lifter `pointlabel` 偏 MIT（ScanNet ToU 另计）；`spatiallm` / `unidet3d` 为 CC BY-NC 4.0。https://github.com/johnathanchiu/roomform
- **维护度：** 2026-08 新仓库，面向「已配准室内点云 → 墙体/开口/物体框」。
- **包体 / 运行位置：** Python + torch，服务端；输入 `.ply` / `.npz` 点云，不是手机相机视频。
- **小程序可行性：** 不能从微信摄像头得到已配准点云。即使用户相册三张图，也不是它的输入。
- **隐私：** 点云 / 照片出端。
- **为何不进包：** 输入形态与 M4 POC 不符；权重 NC 不可作默认路径。

### 7. COLMAP / GLOMAP（排除）

- **许可证：** COLMAP new BSD；GLOMAP 3-clause BSD。https://github.com/colmap/colmap 、https://github.com/colmap/glomap（独立仓库已 **deprecated**，global SfM 并入 COLMAP 4.x）。
- **维护度：** COLMAP 长期活跃（2026 仍有 release）。GLOMAP 作为独立产品不再维护，但不改变「这是服务端 SfM」的事实。
- **包体 / 运行位置：** 原生 C++/CUDA 流水线，多图 + CPU/GPU，跑在服务器或工作站。
- **小程序可行性：** 无 JS / weapp 端口。需要多张已拍摄照片上传后离线重建，得到的是稀疏/稠密点云，不是三边毫米。
- **隐私：** 照片出端。
- **为何不进包：** 与小程序无运行时关系；违反「不上云」。

## 推荐（与设计一致，取舍已定）

1. **主方案（POC 必须做）：** VisionKit v2 **水平面**测量。用户在地面点两对点：第一对 → `widthMm`，第二对 → `depthMm`。层高手填，默认 **2800mm**。`RoomScan.source = 'visionkit-v2'`，`photoPaths = []`。方案详情展示长×宽×高 + 简易矩形平面图。3D 家具放置留 M5。
2. **降级方案（POC 必须同时做）：** 机型不支持 v2、`start` 失败、用户拒绝隐私 / `scope.camera`、或开发者工具无真实 VK 时，手填长宽高（均 **>0**）+ 最多 **3** 张 `chooseMedia` 相册图，`source = 'manual'`。参考图只存本地临时路径，**不上传**。

不引入 `threejs-miniprogram`。不把任何重建模型打进小程序包。

## 隐私与合规（实现期写代码，本 MVP 仍不提审）

| 项 | 要求 |
| --- | --- |
| 隐私指引文案 | 必须声明 **「访问你的摄像头」**（VisionKit / Camera）。降级相册另声明「选中的照片或视频信息」，用途写清：最多 3 张参考图，仅本机，不上云。 |
| 代码顺序 | `requirePrivacyAuthorize` → `Taro.authorize({ scope: 'scope.camera' })` → `createVKSession` / `<Camera>`。拒绝或失败走手填。 |
| `app.config.ts` | `permission['scope.camera'].desc` 使用「访问你的摄像头」。不写密钥、不填真实 AppID。 |
| 数据 | `fd:scans` 本地；禁止 `Taro.uploadFile` / 云开发 / 第三方推理。 |
| 提审 | 未经 Nero 确认不提交审核。POC 按合规路径写，避免以后返工。 |

## 真机 / 开发者工具结论（实现期填写）

撰写本对比时：**缺真机，VisionKit 主路径未测**。开发者工具通常无完整 v2 平面 hitTest，验收允许主路径标「缺真机未测」；**降级手填 + 单元测试 + typecheck + `build:weapp` 必须过**。

实现 PR 仅允许在本节追加：

| 日期 | 机型 | 微信 / 基础库 | 路径 | 结果 | 错误信息 |
| --- | --- | --- | --- | --- | --- |
| 2026-11-03（计划） | （无） | （无） | visionkit-v2 | 缺真机未测 | — |
| 2026-11-03（实现） | （无） | （无） | visionkit-v2 | 缺真机未测 | — |

若主方案在目标机型上不可行：在上表写「不可行」+ 基础库 + `start`/`hitTest` 错误码，**不删除本文件其它候选**，降级路径仍须可跑。

## 与 `RoomScan` 的映射

已有类型（**不要改**）：

```ts
interface RoomScan {
  planId: string
  source: 'visionkit-v2' | 'manual'
  widthMm: number
  depthMm: number
  heightMm: number
  photoPaths: string[]
  capturedAt: string
}
```

| 字段 | 主方案 | 降级 |
| --- | --- | --- |
| `source` | `'visionkit-v2'` | `'manual'` |
| `widthMm` / `depthMm` | 两对 hitTest 点的欧氏距离（m→mm） | 用户手填，>0 |
| `heightMm` | 手填，默认 2800 | 手填，默认 2800，>0 |
| `photoPaths` | `[]` | 最多 3 个本地临时路径 |
| 持久化 | `scanStore` → `fd:scans`，每 `planId` 一条，后写覆盖 | 同左 |

方案详情展示文案：`VisionKit 测量` / `手动填写`。入口按钮：「采集房型」。只在 `stage === 'measure'` 显示。
