# STARUSH Phase 1 P0/P1 Program Fix Prep

日期：2026-05-24

用途：给制作人转发和排期使用。本文只做程序接手审查与最小修复方案，不代表已经开工实现。

## 制作人优先级

1. `playerGfx === null` 崩溃必须第一个修。
2. HUD 生命周期验证/补齐。
3. 选人数据链路 `CharacterScene -> StageScene -> BattleScene`。
4. 第一关使用 `stages.js` 的 `waves`。
5. CP 暴击爆发参数修复。
6. 标题页推荐开演，缩短首玩路径。
7. 移动端最小操作：拖动移动 + 切色按钮 + 形态按钮。
8. P0 美术接入：舞台背景 + 五色弹幕/拖尾。

## 总体接手判断

- 当前 P0-1 崩溃风险仍存在，必须先修。
- HUD 生命周期已有本地修复雏形，但需要浏览器验证和返回路径补齐。
- P1 多数问题不是缺系统，而是数据、关卡配置、输入和资产没有接上。
- 本轮不拆 `BattleScene`，不引入新框架，不扩系统，不做战斗手感大调参。
- 本轮不提交 `dist`、`node_modules`、截图、日志或临时文件。

## 1. P0-1: `playerGfx === null` 崩溃

### 当前状态

存在，且可复现。

正常 atlas 资源加载时：

- `03-程序/src/scenes/BattleScene.js:100` 设置 `this.playerGfx = null`。
- `03-程序/src/scenes/BattleScene.js:491` 受击 tween 直接以 `this.playerGfx` 为 target。
- `03-程序/src/scenes/BattleScene.js:496` tween 完成后直接调用 `this.playerGfx.setAlpha(1)`。
- `03-程序/src/scenes/BattleScene.js:1443` 保卫战失败直接调用 `this.playerGfx.setAlpha(0)`。
- `03-程序/src/scenes/BattleScene.js:1802` 死亡直接调用 `this.playerGfx.setAlpha(0)`。

### 最小修法

- 在 `BattleScene` 增加本地 helper，不拆文件：
  - `_getPlayerVisualTarget()`：优先返回 `this.playerGfx`，否则返回 `this.player`。
  - `_setPlayerVisualAlpha(alpha)`：对 `playerGfx` 或 `player` 做安全 alpha 设置。
- 受击 tween target 改为 helper 返回的目标。
- 死亡和保卫战失败隐藏玩家时走 `_setPlayerVisualAlpha(0)`。
- 保留 atlas 模式下玩家 sprite 闪烁，不能只是空判断。

### 风险点

- 如果只写 `if (this.playerGfx)`，atlas 模式会没有受击反馈，不满足制作人验收。
- `this.player` sprite 和 fallback graphics 的 alpha 恢复路径要一致，否则重开后可能看不到玩家。

### 验证步骤

1. 正常资源加载进入战斗，故意让玩家被敌弹或敌人碰撞。
2. 确认受击不报错，玩家 sprite 有闪烁。
3. 让玩家死亡，确认不报错。
4. 死亡后点击重开，确认能重新进入战斗。
5. 进入保卫战模式并触发颜料罐全毁，确认不报错。
6. 临时制造 atlas fallback，确认 fallback graphics 模式也不报错。

## 2. P0-2: HUD 生命周期验证/补齐

### 当前状态

部分存在，待验证。

- `03-程序/src/utils/ui.js:9` 已有 `setBattleHudVisible()`。
- `03-程序/src/scenes/TitleScene.js:15` 调隐藏。
- `03-程序/src/scenes/CharacterScene.js:23` 调隐藏。
- `03-程序/src/scenes/StageScene.js:20` 调隐藏。
- `03-程序/src/scenes/BattleScene.js:39` 调显示。
- `03-程序/index.html:118` HUD 是全局 DOM，不属于 Phaser scene 私有对象。

### 最小修法

- 保留 `setBattleHudVisible()`，不重构 HUD。
- 补齐 BattleScene 返回路径：
  - 胜利返回 Stage 前确保后续 StageScene 会隐藏 HUD。
  - 死亡 restart 后 HUD 正常显示。
  - 保卫战失败返回 Stage 后 HUD 隐藏。
- 可在 `BattleScene` 的 shutdown 事件上加一次 `setBattleHudVisible(false)` 作为兜底，但要确认 restart 时不会造成 HUD 闪烁或残留。

### 风险点

- HUD 是全局 DOM，任何 scene 漏调都会残留。
- 后续移动端按钮如果也放 DOM，必须纳入同一显隐生命周期。

### 验证步骤

1. 标题页不显示战斗 HUD。
2. 成员管理页不显示战斗 HUD。
3. 关卡页不显示战斗 HUD。
4. 战斗页显示分数、HP、波次、应援、形态。
5. 战斗胜利返回关卡页后 HUD 消失。
6. 死亡重开后 HUD 正常。
7. 控制台无核心错误。

## 3. P1: 选人数据链路

### 当前状态

不存在。

- `03-程序/src/scenes/CharacterScene.js:318` 只 `scene.start('StageScene')`，未传角色数据。
- `03-程序/src/scenes/StageScene.js:217` 只传 `stageId` 和 `defenseMode`。
- `03-程序/src/scenes/BattleScene.js:73` 读取 `scene.settings.data`。
- `03-程序/src/scenes/BattleScene.js:75` 没数据时默认绯樱 Lv.1。

### 最小修法

- CharacterScene 进入 StageScene 时传最小 `battleData`：
  - `characterId`
  - `level`
  - `formType`
  - `team`
- StageScene 保存 `this.battleData`，出战时合并：
  - `stageId`
  - `defenseMode`
- BattleScene 使用 `battleData.team` 初始化 `ResonanceSystem`。
- 不做完整编队，不做养成存档，不扩角色系统。

### 风险点

- 当前详情页“形态”只是展示，不是选择控件。第一轮可默认使用角色第一个已解锁形态。
- 如果标题页推荐开演也需要默认数据，应复用同一份默认 battleData 构造逻辑，避免两套默认。

### 验证步骤

1. 选择不同角色进入战斗。
2. BattleScene 收到不同 `characterId/name/color/atk`。
3. StageScene 出战后仍保留角色数据。
4. 第一关 `stageId=1` 正确进入战斗。
5. 仅开发期可用临时 debug text 或 console 验证，最终不保留噪音日志。

## 4. P1: 第一关使用 `stages.js.waves`

### 当前状态

配置存在，但未生效。

- `03-程序/src/data/stages.js:11` 第 1 关配置 `waves: 2`。
- `03-程序/src/systems/WaveSystem.js:52` 固定使用全局 `WAVE_DEFS.length`。
- `03-程序/src/systems/WaveSystem.js:57` 固定读取 `WAVE_DEFS[this.currentWave]`。
- `03-程序/src/scenes/BattleScene.js:939` HUD 总波数固定显示 `WAVE_DEFS.length`。

### 最小修法

- `WaveSystem` 构造函数增加可选参数 `waveDefs = WAVE_DEFS`。
- 内部统一使用 `this.waveDefs`。
- 增加 `getTotalWaves()`。
- BattleScene 根据 `battleData.stageId` 找到 stage。
- 第一轮只让第 1 关按 `stage.waves` 截取前 2 波。
- 其它关卡先 fallback 到当前默认逻辑，避免一次性改完整 33 关。

### 风险点

- 不要改全局 `WAVE_DEFS`，否则所有关卡都会被误改。
- 如果第 1 关只有 2 波，必须确认玩家仍能看到至少一次应援、安可或 C 位高潮；这可能需要策划脚本配合，但本轮不做战斗调参。

### 验证步骤

1. 从第 1 关进入战斗。
2. HUD 显示 `WAVE 1/2`。
3. 清完第 2 波后进入通关反馈。
4. StageScene 展示的第 1 关波次数和战斗实际一致。

## 5. P1: CP 暴击爆发参数

### 当前状态

存在 bug。

- `03-程序/src/systems/CPComboHandler.js:100` 正确调用 `onCritBurst(config.critBonus, config.duration)`。
- `03-程序/src/scenes/BattleScene.js:65` 错误写成 `this._showCritBurstFx(duration)`。
- `03-程序/src/scenes/BattleScene.js:1166` `_showCritBurstFx(critBonus, duration)` 需要两个参数。

### 最小修法

- 改为：

```js
this.cpHandler.onCritBurst = (critBonus, duration) => this._showCritBurstFx(critBonus, duration);
```

- 在 `_showCritBurstFx` 内给 `critBonus` 和 `duration` 做兜底，防止未来配置缺字段导致永久或超大 buff。

### 风险点

- 这是数值稳定修复，不顺手调整暴击率、持续时间或战斗手感。

### 验证步骤

1. 触发粉+黄 CP。
2. 确认暴击加成为 `0.15`。
3. 确认持续时间为 `3000ms`。
4. 确认不会出现 `undefined duration` 或超大暴击率。

## 6. P1: 标题页推荐开演

### 当前状态

不存在。

- `03-程序/src/scenes/TitleScene.js:60` 当前只有“开始公演”按钮。
- `03-程序/src/scenes/TitleScene.js:77` 点击后进入 CharacterScene。

### 最小修法

- 主按钮改成“推荐开演”，直接带默认数据进入第 1 关战斗，或进入 StageScene 并自动带默认数据。
- 保留较小入口“成员管理”，让玩家仍能走完整选人流程。
- 默认数据复用选人链路的数据结构：
  - 默认角色：绯樱。
  - 默认等级：1。
  - 默认形态：输出。
  - 默认关卡：第 1 关。

### 风险点

- 直接进战斗会减少角色展示，但符合 60 秒内进入第一局的 Phase 1 目标。
- 不要额外做新手教程系统；本轮只缩短路径。

### 验证步骤

1. 标题页点击“推荐开演”。
2. 60 秒内进入第一场战斗。
3. 点击“成员管理”仍能进入选人页。
4. 推荐开演带入默认 `battleData`。

## 7. P1: 移动端最小操作

### 当前状态

不存在。

- `03-程序/src/scenes/BattleScene.js:249` 只有键盘方向键/WASD。
- `03-程序/src/scenes/BattleScene.js:251` Q 切色。
- `03-程序/src/scenes/BattleScene.js:260` E 切形态。
- `03-程序/index.html:148` 形态显示是只读 DOM，`pointer-events: none`。

### 最小修法

- BattleScene 增加触控状态，不引入新框架：
  - pointer down 记录起点。
  - pointer move 计算方向。
  - pointer up 清空触控移动。
- update 中将键盘输入和触控输入合并。
- 增加两个最小按钮：
  - 切色：等价 Q。
  - 形态：等价 E。
- 按钮只在 Battle 显示，并纳入 HUD 生命周期。

### 风险点

- 按钮不能遮挡底部玩家活动区域。
- 如果用 DOM 按钮，要避免吞掉拖动移动。
- 如果用 Phaser 按钮，要确认触控点击不会和移动拖动冲突。

### 验证步骤

1. 375x667 竖屏下拖动可移动玩家。
2. 切色按钮等价 Q。
3. 形态按钮等价 E。
4. 键盘操作仍可用。
5. HUD/按钮不遮挡玩家、敌弹和高潮反馈。

## 8. P0 美术接入：舞台背景 + 五色弹幕/拖尾

### 当前状态

资产存在，接入不完整。

`03-程序/public` 已有：

- `stage-bg-v3-clear.png`
- `bullets-v4-clear.png`
- `particles-trail-v1-clear.png`

当前代码：

- `03-程序/src/scenes/BattleScene.js:34` 已 preload `particles-trail`。
- `03-程序/src/scenes/BattleScene.js:35` 已 preload `bullets-sheet`，但没有帧 JSON 接入。
- `03-程序/src/scenes/BattleScene.js:1350` 子弹仍由 Graphics 按颜色画形状。
- `03-程序/src/scenes/BattleScene.js:1387` `_drawStageFloor()` 仍是程序绘制舞台线。
- `03-程序/src/scenes/BattleScene.js:1603` 拖尾已使用 `particles-trail` 图片。

### 最小修法

- 优先接舞台背景：
  - preload `stage-bg-v3-clear.png`。
  - 在 `_drawStageFloor()` 前后放底层背景图。
  - 低 alpha 或暗化处理，确保中心和底部可读。
- 五色弹幕本轮保留现有 Graphics 形状，因为已经满足“颜色 + 形状”的最小要求。
- 拖尾继续使用 `particles-trail`，只验证不遮挡敌弹。
- `bullets-v4-clear.png` 如果没有配套 atlas JSON，本轮不硬切，避免扩大风险。

### 风险点

- 背景图约 1.6MB，移动端首包风险较高。
- 背景不能抢过弹体、敌人、玩家判定点。
- 不要把美术接入变成重做弹幕系统。

### 验证步骤

1. 战斗中能看出偶像舞台氛围。
2. 玩家、敌人、子弹、敌弹仍清晰。
3. 拖尾不遮挡敌弹。
4. 不提交截图或临时视觉验证文件。

## 可合并开发

- 选人数据链路 + 第一关 waves：都依赖 `battleData.stageId`。
- 标题页推荐开演 + 选人数据链路：共用默认 `battleData`。
- HUD 生命周期 + 移动端按钮显隐：可以同批开发，但必须分开验收。
- 舞台背景 + 拖尾验证：可以同批视觉检查，但不要顺手改弹幕系统。

## 必须单独验收

1. P0-1 `playerGfx` 崩溃修复。
2. P0-2 HUD 生命周期。
3. CP 暴击爆发参数。
4. 移动端最小操作。
5. P0 美术接入可读性。

## 建议开发顺序

1. 修 `playerGfx` 崩溃。
2. 验证/补齐 HUD 生命周期。
3. 修 CP 暴击爆发参数。
4. 打通选人数据链路。
5. 让第一关 `waves` 生效。
6. 标题页推荐开演。
7. 移动端最小操作。
8. 接入舞台背景并验证五色弹幕/拖尾可读性。

## 完成后验证总清单

- `npm.cmd run build` 通过。
- 本地 Vite 服务可进入标题页。
- 标题页、成员页、关卡页无战斗 HUD。
- 战斗页显示 HUD。
- 正常 atlas 模式下受击、死亡、保卫战失败不报错。
- 死亡后点击重开能进入战斗。
- 第 1 关按 2 波运行。
- 选人数据能传到 BattleScene。
- 推荐开演能快速进入第一战。
- 触控拖动、切色按钮、形态按钮可用。
- 舞台背景不影响战斗可读性。
