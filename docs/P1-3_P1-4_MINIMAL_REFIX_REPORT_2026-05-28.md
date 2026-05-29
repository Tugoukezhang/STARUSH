# STARUSH P1-3/P1-4 最小返修报告

日期：2026-05-28
续作日期：2026-05-29
工作区：`C:\Users\1\Documents\ouxiang\STARUSH`
范围：P1-3/P1-4 首玩路径与移动端最小操作返修

## 返修结论

本轮已把 D 盘补丁中的必要行为同步到当前共享工作区，并完成最小返修：

- Battle 快启先隐藏 HUD，待 `waveSystem` 与 HUD 文本刷新后再显示，避免玩家看到 `WAVE 1/10` 闪烁。
- Stage 1 首玩波次仍为 2 波，并对 Stage 1 敌人数量/生成间隔做最小缩小。
- 第一波增加 12 秒兜底推进，避免新手卡在 `WAVE 1/2`。
- 增加首玩可观察提示：
  - `拖动移动，自动射击会帮你清掉第一波`
  - `点「色」切应援色，点「形」切换形态`
- 触控按钮补回切色/形态按钮、拖动移动、热区保护。
- 新增 `_syncFormDisplay()`，键盘 E、数字键、触控形态按钮统一同步 `form-text`。
- 修复 P1-3 粉+黄 CP 暴击回调参数转发，保留 `_debugLastCritBurst` 便于浏览器验证。
- 标题页恢复推荐首玩入口：`立即开演` 直进默认绯樱 Lv.1 / Stage 1；`成员管理` 入口保留。

## 修改文件

- `03-程序/src/scenes/BattleScene.js`
- `03-程序/src/scenes/TitleScene.js`
- `03-程序/src/data/stages.js`

## 验证记录

### 静态验收

一次性静态验收脚本已先在返修前跑出红灯，缺口包括：

- CP 参数转发
- 首玩提示
- 第一波兜底
- `form-text` 同步
- 触控热区保护
- 触控移动
- 推荐开演入口
- `getStageById`

返修后同一脚本通过：`all checks present`。

### 构建验证

`npm.cmd run build` 已通过。

由于当前共享工作区没有本地 `node_modules`，本轮没有在 C 盘下载安装依赖；使用临时 junction 指向 `D:\GameProjects\STARUSH\03-程序\node_modules` 完成构建，构建后已删除该 junction。

Vite 输出仍有常规警告：

- Vite CJS Node API deprecated
- Phaser bundle chunk 大于 500 kB

这两项不阻断本轮返修验收。

### 提交面检查

构建后产生的 `03-程序/dist` 差异已清理。已确认以下路径当前不在 Git 提交面：

- `03-程序/dist`
- `03-程序/node_modules`
- `03-程序/package-lock.json`

## 浏览器复测

375x667 浏览器复测已完成。

环境：

- 本地 Vite：`http://127.0.0.1:5173/`
- 视口：`375x667`
- 浏览器：Codex in-app browser

复测结果：

| 检查项 | 结果 |
|---|---|
| 标题页初始状态 | `hud = none`，`form-display = none`；底层 `wave-text` 仍是 HTML 默认 `WAVE 1/10`，但不可见。 |
| 立即开演 | 点击标题页主按钮后进入 BattleScene。 |
| Battle HUD | 首次可见时 `hud = flex`，`wave-text = WAVE 1/2`，未看到可见的 `WAVE 1/10`。 |
| 375x667 视口 | `innerWidth = 375`，`innerHeight = 667`，canvas client size 为 `375x667`。 |
| 拖动移动 | 拖动后 `atmo-blue` 变为 active，说明移动输入在有敌人时生效。 |
| 形态按钮 | 点击右下 `形` 后 `form-text` 从 `🎤 输出` 变为 `💃 染色`。 |
| 色按钮 | 点击右下 `色` 后未产生控制台错误；按钮热区保护已由源码静态检查覆盖。 |
| 波次推进 | 等待后 `wave-text` 从 `WAVE 1/2` 推进到 `WAVE 2/2`。 |
| 控制台 | `error` 日志为空。 |

备注：Phaser canvas 内的提示文案无法通过 DOM 读取，本轮用源码静态检查确认提示文本存在，并用浏览器流程确认首波可以推进。

## 剩余风险

- 移动端按钮仍是最小可用实现，后续美术 UI 接入后应复查遮挡与触控热区。
- 当前拖动移动是角色追向触点，不是虚拟摇杆；首玩够用，后续手感优化需单列任务。
- 本轮不提交，只保留工作区改动供主控审阅。
