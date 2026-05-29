# STARUSH P1-3/P1-4 程序执行报告

日期：2026-05-28
执行对象：`D:\GameProjects\STARUSH`
阶段：Phase 1 / First Play Polish Pass
范围：P1-3 CP 暴击参数修复 + 推荐开演路径 + P1-4 最小移动端操作

## 结论

本轮可以按“程序最小 patch 已完成并通过冒烟验证”处理。

已实现：

- 粉+黄 CP 暴击爆发回调正确传入 `critBonus = 0.15` 与 `duration = 3000`。
- 暴击加成会写入 `atmosphere.tempCritBonus`，3000ms 后清掉。
- 标题页主入口改为“立即开演”，直达默认绯樱 Lv.1 输出型 Stage 1。
- 标题页保留较小的“成员管理”入口。
- BattleScene 支持 375x667 下拖动移动、切色按钮、形态按钮。
- 键盘 WASD / Q / E 仍保留。

未做：

- 未重做 P1-1 / P1-2。
- 未拆 `BattleScene`。
- 未引入新框架。
- 未扩 GDD、队伍系统、养成、抽卡、商店或社交。
- 未提交 `dist`、`node_modules`、`package-lock.json`、截图或日志。

## 修改文件

- `03-程序/src/scenes/BattleScene.js`
  - 修正 `onCritBurst` 回调参数转发。
  - 增加 `_debugLastCritBurst`，用于本轮数值验证。
  - 增加触控拖动移动状态。
  - 增加战斗内切色按钮与形态按钮。
  - 抽出 `_switchColor()`，保持键盘 Q 与触控按钮共用同一逻辑。
- `03-程序/src/scenes/TitleScene.js`
  - 主按钮文案改为“立即开演”。
  - 主按钮直达 BattleScene，传入默认绯樱 Lv.1 输出型 Stage 1 `battleData`。
  - 保留较小“成员管理”入口，继续进入 CharacterScene。

## CP 数值验证

粉+黄 CP 配置：

```js
CP_EFFECTS['pink+yellow'] = {
  effectType: 'crit_burst',
  critBonus: 0.15,
  duration: 3000
}
```

浏览器实测：

| 时间点 | 结果 |
|---|---|
| 触发前 | `tempCritBonus = 0` |
| 触发粉+黄 CP 后 | `tempCritBonus = 0.15` |
| `_debugLastCritBurst` | `{ critBonus: 0.15, duration: 3000 }` |
| 3300ms 后 | `tempCritBonus = 0`，`cpHandler.isActive('pink+yellow') = false` |

## 375x667 浏览器验证

环境：

- 本地 Vite：`http://127.0.0.1:5173/`
- 浏览器：Edge headless / CDP
- 视口：`375x667`

验证结果：

| 项 | 结果 |
|---|---|
| 标题页 | 存在 `▶ 立即开演` 与 `成员管理`。 |
| 推荐开演 | 点击主入口后直接进入 `BattleScene`。 |
| 默认 battleData | `characterId = sakura`，`level = 1`，`stageId = 1`，`stageWaves = 2`。 |
| HUD | BattleScene 中 `hud = flex`，非战斗 DOM 未残留。 |
| 波次 | 立即开演进入后显示 `WAVE 1/2`。 |
| 切色按钮 | 点击后 `currentColor: pink -> blue`，按钮文案变为 `色/蓝`。 |
| 形态按钮 | 点击后 `currentForm: attack -> stain`，按钮文案变为 `形/染`。 |
| 拖动移动 | 玩家坐标从约 `(188, 587)` 移动到约 `(89, 469)`。 |
| 控制台 | 未捕获 error。 |

## 命令验证

已运行：

```powershell
node --check src/scenes/TitleScene.js
node --check src/scenes/BattleScene.js
npm.cmd run build
```

结果：通过。

备注：Vite 仍输出 Phaser bundle 体积警告和 CJS Node API 弃用提示，不阻塞本轮验收。

## 提交面检查

构建产生的 `dist` 变更已清理。

已确认无待提交变更：

- `03-程序/dist`
- `03-程序/node_modules`
- `03-程序/package-lock.json`

## 剩余风险

1. 移动端按钮是最小可用实现，视觉还不是最终 UI；后续美术接入后需要重新检查遮挡和触控热区。
2. 拖动移动当前是“角色追向触点”，不是虚拟摇杆；首玩足够，但后续如果要更强手感需要另立任务。
3. CP 暴击加成现在能正确加减，但触发频率仍依赖现有氛围/Combo 逻辑，本轮没有调战斗节奏。
4. 标题页立即开演会跳过 StageScene，这是为了最快首玩路径；成员管理入口仍保留给非默认路线。

## 主控补充说明

当前报告来自 `D:\GameProjects\STARUSH`。本主控共享工作区为 `C:\Users\1\Documents\ouxiang\STARUSH`，截至回收报告时，当前共享工作区中的程序文件尚未体现该补丁。因此 QA / 集成回归必须满足其一：

1. 直接在 `D:\GameProjects\STARUSH` 补丁工作区运行。
2. 先将补丁同步到 `C:\Users\1\Documents\ouxiang\STARUSH` 后再运行。

不要在未同步补丁的旧工作区上做本轮通过/失败结论。

## 建议主控裁决

建议接受 P1-3 / 推荐开演 / P1-4 最小移动端操作，进入 QA / 集成专项回归。

QA 建议优先验证：

1. 标题页主按钮是否能 60 秒内直进战斗。
2. WASD/Q/E 与触控拖动/切色/形态按钮是否同时可用。
3. 粉+黄 CP 是否稳定 `+0.15` 暴击率并在 3000ms 后清除。
4. Stage 1 仍保持 P1-2 的 2 波，不回归成 10 波。
