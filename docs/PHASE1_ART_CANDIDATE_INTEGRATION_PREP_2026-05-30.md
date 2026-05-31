# STARUSH Phase 1 美术候选接入预案

日期：2026-05-30
范围：程序专项评估接入点和风险，不直接集成未经制作人接受的最终素材。
约束：不拆 `BattleScene`，不引入新框架，不做商店/抽卡/养成/队伍系统。

## 当前结论

建议走“最小替换、可回退”的接入路线：背景图先作为 BattleScene 最底层装饰层接入；五色弹幕 atlas 只替换视觉对象，不改子弹物理体、命中逻辑、波次逻辑和伤害逻辑。所有候选素材必须先由制作人接受，再进入程序分支。

## 1. 舞台背景图接入

建议素材位置：

- `03-程序/public/art/phase1/stage-combat-idol-v1.png`
- Vite public 资源会以 `/art/phase1/stage-combat-idol-v1.png` 暴露；Phaser loader 中可写相对路径 `art/phase1/stage-combat-idol-v1.png`。

建议加载点：

- 在 `03-程序/src/scenes/BattleScene.js` 的 `preload()` 中新增：
  - `this.load.image('stage-combat-idol-v1', 'art/phase1/stage-combat-idol-v1.png')`

建议显示点：

- 在 `create()` 里，`this.cameras.main.setBackgroundColor('#0a0a1a')` 之后、`_drawStageFloor()` 之前，增加一个很小的 `_createStageBackground()` helper。
- helper 内使用：
  - `this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'stage-combat-idol-v1')`
  - `.setDisplaySize(GAME_WIDTH, GAME_HEIGHT)`
  - `.setDepth(-10)`
  - `.setAlpha(0.85-1.0)`，根据候选亮度微调。

保留现有 `_drawStageFloor()`，让舞台地板线、敌人、弹幕、玩家和 HUD 继续使用当前层级。背景缺失时只保留当前深色底色，不阻断战斗。

## 2. 五色弹幕 atlas 接入

建议素材位置：

- `03-程序/public/art/phase1/bullet-color-atlas-v1.png`
- `03-程序/public/art/phase1/bullet-color-atlas-v1.json`

建议加载点：

- 在 `BattleScene.preload()` 中新增：
  - `this.load.atlas('bullet-color-atlas-v1', 'art/phase1/bullet-color-atlas-v1.png', 'art/phase1/bullet-color-atlas-v1.json')`

建议替换方式：

- 不改当前 physics 子弹：继续使用隐藏的 `__DEFAULT` physics sprite 作为碰撞体。
- 只把当前 `Graphics` 弹体换成 atlas image/sprite，并挂到 `bullet.gfx` 上，沿用现有生命周期：
  - 创建位置：`_tryShoot()`
  - 清理位置：子弹 2 秒 delayedCall、出界清理、命中清理
  - 位置同步：当前 update 中 `if (b.gfx) b.gfx.setPosition(...)`

建议最小 helper：

- `_getBulletFrame(color)`：返回 `bullet_pink_0`、`bullet_blue_0`、`bullet_yellow_0`、`bullet_purple_0`、`bullet_orange_0`。
- `_createBulletVisual(color, x, y)`：如果 atlas 和 frame 存在，创建 image/sprite；否则回退到当前 `_drawBulletShape()`。
- `_syncBulletVisual(bullet)`：解决 Graphics 需要偏移、image 需要居中的差异。

拖尾增强：

- 当前 update 中使用 `particles-trail` tint 的逻辑可以保留为 fallback。
- 如果 atlas 中存在 `trail_${color}_0`，则优先用 atlas trail，`setDepth(4)`，alpha 低于弹体，不超过约 48px 视觉长度。

暴击星粒增强：

- `_spawnCritFx()` 可在后续使用 `crit_star_0..2` 或 `crit_spark_0..2`。
- P0 接入阶段不建议一次性替换所有命中特效，避免影响可读性验收。

## 3. 最小改动代码点

建议只碰这些位置：

- `BattleScene.preload()`：加载背景与 bullet atlas。
- `BattleScene.create()`：在深色底色后创建背景层。
- `_tryShoot()`：创建子弹视觉对象时优先用 atlas，fallback 到 Graphics。
- update 中玩家子弹同步逻辑：抽成 `_syncBulletVisual(b)` 或做一处兼容判断。
- 玩家子弹清理逻辑：继续 `if (b.gfx) b.gfx.destroy()`，不用改命中/伤害。
- 拖尾生成逻辑：优先 atlas trail，fallback 到现有 `particles-trail`。
- 可选：`_spawnCritFx()` 只接暴击星粒，不碰普通命中、CP、Encore。

不建议在候选接入阶段改：

- `WaveSystem`
- `DamageCalculator`
- `AtmosphereSystem`
- `SupportSystem`
- `EncoreSystem`
- 队伍/角色/关卡数据结构
- BattleScene 大拆分

## 4. 375x667 遮挡风险

关键层级现状：

- 背景建议 depth `-10`
- `_drawStageFloor()` 当前 depth `0`
- 敌弹 depth `2`
- 敌人 depth `3`
- 拖尾/部分场景物件 depth `4`
- 我方弹幕 depth `5`
- 玩家/玩家色环 depth `9-10`
- 支援/安可/C 位大反馈 depth `50-60`
- 移动端按钮 depth `130-131`
- 首玩提示 depth `140`
- DOM HUD 在页面上层，`hud` 顶部，`form-display` 底部。

风险区域：

- 顶部 `0-64px`：HUD、分数、`WAVE`、HP、应援点。背景顶灯不能过亮或高频。
- 顶部 `0-120px`：敌人出生区。不要放复杂灯架、强线条、亮色 logo 感形状。
- 中央纵向约 `x=97-277`：主战斗通道。背景必须低细节、低对比。
- 底部 `y=507-667`：玩家活动区。玩家初始约 `(187, 587)`，不应有亮边、灯海密点或舞台设备强轮廓。
- 右下 `x≈327, y≈543/599`：触控 `色/形` 按钮。背景和特效不能抢按钮轮廓。
- `y≈501`：首玩提示位置。背景此处应保持干净，避免白字提示看不清。

敌弹风险：

- 敌弹以红/粉/暗红图形为主，背景和命中特效不要大量使用同样大小、同样运动方向的红橙小亮点。
- 橙色我方弹、橙色命中特效和敌弹要靠轮廓区分，不能只靠色相。

## 5. 素材过大时的压缩或降级

背景图：

- 优先 `750x1334` 2x PNG；如果超过约 `1.0-1.5MB`，先压缩 PNG，再考虑降到 `375x667`。
- 可用 `pngquant` / `oxipng` / 设计工具导出压缩 PNG。
- 如果移动端首包压力明显，可追加 WebP 候选，但保留 PNG fallback。
- 背景不得靠极细纹理表达细节；压缩后如果纹理糊成噪声，应回到低细节设计。

弹幕 atlas：

- 保持 `512x256` 左右；透明边裁切，单帧保留 4px 安全透明边。
- atlas JSON 必须是 Phaser 可读格式。
- 如果 atlas 过大，先减少拖尾帧和 spark 帧，不减少五色主体弹体。
- 如果性能或可读性不稳，P0 可以只启用 `bullet_*_0`，拖尾和暴击继续用现有 placeholder。

运行时降级：

- 背景缺失或加载失败：保留 `#0a0a1a` 深色背景和 `_drawStageFloor()`。
- bullet atlas 缺失或 frame 缺失：回退当前 Graphics 形状。
- trail frame 缺失：回退现有 `particles-trail` tint。

## 6. 构建后不能提交的文件

构建或复测后不要提交：

- `03-程序/dist/`
- `03-程序/node_modules/`
- `03-程序/package-lock.json`，除非团队明确决定开始锁包
- 截图文件
- 浏览器/Playwright/CDP 日志
- Vite dev server 日志
- 临时压缩产物、候选中间文件、未接受素材

正式素材进入程序仓库前，应先有制作人接受记录，并明确文件名、用途、来源、压缩版本。

## 7. 最小验证步骤

接入候选素材后，按以下顺序验证：

1. 静态检查：
   - 确认素材只放入 `03-程序/public/art/phase1/`。
   - 确认未误改 `WaveSystem`、伤害、队伍、商店、抽卡、养成相关代码。
   - 确认 atlas frame 名和代码映射一致。

2. 语法检查：
   - `node --check src/scenes/BattleScene.js`

3. 构建：
   - `npm.cmd run build`
   - 允许 Vite CJS API 和 Phaser chunk 体积警告；不允许 import/atlas/json 解析错误。

4. 375x667 浏览器复测：
   - 标题页进入 Battle。
   - HUD 首次可见时仍为 `WAVE 1/2`。
   - 背景可见但不抢玩家、敌人、敌弹。
   - 拖动移动、自动射击、点 `色`、点 `形` 均可用。
   - 五色弹体在 32x32 等效尺寸下可区分。
   - 敌弹危险识别优先于背景、拖尾和命中特效。
   - 控制台无 error。

5. 压力截图：
   - 375x667 正常截图。
   - 50% 缩放截图。
   - 高弹幕密度截图。
   - 检查中央通道、底部玩家区、右下按钮、顶部 HUD。

6. 提交面检查：
   - `git status --short`
   - 确认不包含 `dist`、`node_modules`、`package-lock`、截图、日志。

## 建议下一步

等制作人确认美术候选后，程序只开一个小分支做 P0 接入：

1. 只接背景图和五色弹体主体。
2. 保留所有 fallback。
3. 通过 375x667 可读性验收后，再决定是否接拖尾、命中、C 位/Encore atlas。
