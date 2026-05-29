# STARUSH P1-3/P1-4 QA Regression Report

日期：2026-05-28
测试工作区：`D:\GameProjects\STARUSH`
阶段：Phase 1 / First Play Polish Pass
范围：P1-3 CP 暴击参数修复 + recommended start + P1-4 最小移动端操作
主控结论：暂不接受，退回程序专项做最小返修

## Producer Decision

暂不建议接受 P1-3 / recommended start / P1-4。

本轮 QA 明确确认测试工作区为 `D:\GameProjects\STARUSH`，不是 C 盘旧工作区，因此结论有效。当前状态改为：程序专项返修后再做 QA 复测。

## Blocking Findings

| 严重度 | 发现 | 证据 |
|---|---|---|
| P1 | 快启进入 Battle 后，HUD 短暂显示旧默认 `WAVE 1/10` | 375x667 采样：进入后 100-400ms 为 `WAVE 1/10`，500ms 后才变 `WAVE 1/2`。源头是 `index.html` 默认文本。 |
| P1 | 首玩自动清波不稳定或过慢，未能在 QA 窗口内稳定进入 `WAVE 2/2` | 两轮复测中，`SCORE: 0 WAVE 1/2` 持续 35-45 秒；未观察到“WAVE 1 自动清掉 -> WAVE 2 -> 结算”的完整闭环。 |
| P1 | `WAVE 1/2` 教学提示验收不足 | 静态检索未发现“拖动移动 / 切色 / 形态”波次提示文案；浏览器 DOM 也只看到 HUD/Form 文本。 |
| P1 | 触控形态按钮未通过可观察验证 | 战斗内点击右下形态按钮后 `form-text` 仍为 `🎤 输出`；键盘 `E` 可切到 `💃 染色`。 |

## Passing Items

- `npm.cmd run build` 通过；仅 Vite CJS API 和大 chunk 常规警告。
- `node --check` 覆盖 `TitleScene.js`、`BattleScene.js`、`StageScene.js`、`CharacterScene.js`、`WaveSystem.js`、`CPComboHandler.js`，均通过。
- 标题主入口 `▶ 立即开演` 能在 1 秒内进入 BattleScene；`成员管理` 保留为次入口。
- CP 参数链路通过静态/小型 instrumentation：`pink+yellow` 捕获 `{ critBonus: 0.15, duration: 3000 }`，BattleScene 中按 duration 加/减 `tempCritBonus`。
- 提交面已清理本轮 build 产物；最终 `git status --short` 未包含 `dist`、`node_modules`、`package-lock.json`。

## Required Program Rework

1. BattleScene 进入后不得短暂显示旧默认 `WAVE 1/10`。
2. 首玩 `WAVE 1/2` 必须能在 375x667 QA 窗口内稳定自动清掉并进入 `WAVE 2/2`。
3. 补齐 `WAVE 1/2` / `WAVE 2/2` 最小教学提示文案，并能在浏览器中观察到。
4. 修复或重测触控形态按钮，确保触控按钮和键盘 `E` 走同一切形态逻辑并更新 `form-text`。

## Next QA Gate

返修后 QA 复测必须至少覆盖：

- `WAVE 1/10` 不再出现，哪怕是 100-400ms 的短暂闪现也不接受。
- 推荐开演进入后 `WAVE 1/2` 可以稳定清掉，进入 `WAVE 2/2`。
- 教学提示在对应波次可见。
- 触控形态按钮可以从 `🎤 输出` 切到 `💃 染色` 或下一个形态。
- 已通过项不得回归：build、node check、CP 参数、快启、成员管理、提交面。
