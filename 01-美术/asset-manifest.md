# STARUSH Art Asset Manifest

## 2026-05-30 - Phase 1 P0 v5.1 Gameplay Polish Candidates

Status: accepted as current first-battle integration candidates, pending in-game QA.

Source directory:

```text
01-美术/phase1-p0-candidates-v5-1-gameplay-polish-2026-05-30
```

### `stage-combat-idol-v5-1-a-gameplay-polish-750x1334.png`

- Type: first-battle background candidate.
- Date: 2026-05-30.
- Tool/process: local postprocess from v5 candidate, no broad regeneration in this pass.
- Intended use: BattleScene first-stage background candidate, displayed below players, enemies, bullets, and UI.
- Manual changes: reduced center-lane brightness, reduced competing highlights, added low-contrast star-map lane detail, added restrained lower rail and small lights.
- Copyright/originality note: original STARUSH candidate direction; do not use commercial game names, logos, text, recognizable characters, or copied stage layouts as anchors.
- Current gate: approved for program integration testing, not final shipped asset until QA passes in-game readability.

### `bullet-note-vfx-v5-1-gameplay-512x256.png`

- Type: player bullet / charge / impact atlas candidate.
- Date: 2026-05-30.
- Tool/process: local postprocess from v5 note-bullet candidate, no broad regeneration in this pass.
- Intended use: player bullet visuals and hit feedback in BattleScene.
- Atlas JSON: `bullet-note-vfx-v5-1-gameplay-512x256.json`.
- Runtime mapping:
  - `bullet_note_*_0`: gameplay flying projectile.
  - `charge_note_*_0`: charge or launch cue.
  - `impact_note_*_0`: hit / impact flash.
- Manual changes: promoted trail-like projectile row to gameplay row, demoted larger note icon row to charge/cue row, preserved impact row, separated yellow and orange hue.
- Validation note: report states `frames=15`, `atlas_cells=15/15`, `transparent_nonblack=0`, `pure_green_key=0`.
- Copyright/originality note: original STARUSH note-bullet candidate; shape language is music/idol-themed and must remain distinct from existing commercial game asset sets.
- Current gate: approved for program integration testing, not final shipped asset until QA passes in-game readability.


### 红发女武神 Q 版与身份统一 · 2026-11-23

- 来源：负责人正式原图 `owner-originals/橙白黑赛博战术女武神.png`，原始字节保留。
- 工具：image_gen，生成 Q 版图集，并生成透明立绘衍生、头像与战术武器图标。没有复制教程中的人物或贴图。
- 可编辑实物：`red-valkyrie-chibi-20261123/` 的四张 RGBA PNG；`generation.json` 保存完整提示和生成编号，`manifest.json` 保存源/运行文件哈希、尺寸与帧规格。逐帧素材可再编辑；不冒称已恢复原生分层模型或 Spine 骨骼工程。
- 运行入口：`game/public/art/red-valkyrie-20261123/`；`redValkyrieArt.mjs` 注册 6×4 图集、脚底基准、可见轮廓与枪口标记。图集像素未用脚本重绘或调色，程序只按格读取。
- 用途：红发成员的立绘、头像、武器图标及待机/移动/射击/技能/受击/倒地帧；动作时钟与真实位移来自原有战斗系统。
- 边界：AI 衍生保留原图身份特征，不是逐像素原图复制或完整多向骨骼模型。绿发与蓝白角色仍待制作对应 Q 版。
- 实际验收与限制：见 `docs/RED_CHIBI_ALIGNMENT_2026-11-23.md`。


## 2026-11-23：翡翠风歌 Q 版与配套资源

- 工具：image_gen，以负责人确认的 `owner-originals/翡翠风歌的浮空旋律.png` 为设计来源，未使用教程人物或第三方贴图。
- 源实物：`green-windsong-chibi-20261123/` 的 motion/portrait/avatar/weapon/wind 五张 RGBA PNG。完整提示和修订说明见 `generation.json`，尺寸/字节/SHA-256/帧边界见 `manifest.json`。
- Q 版 1536×1024、6×4、每帧 256px；风刃图集 1536×1024、3×2、每帧 512px。头像和月牙风铃图标 1254px 方图，透明静态立绘 1086×1448。
- 图集修订：通过 image_gen 收紧人物发丝/飘带的格内边缘；首版横条特效重排为六个独立方格。脚本只复制文件、读取 alpha/尺寸和注册帧，没有重绘像素。
- 运行：`game/public/art/green-windsong-20261123/` 与源 PNG 完全一致。`greenWindsongArt.mjs` 统一注册；普通攻击、突进、受击、倒地和回响改用同设计图集/风刃，保留原有伤害和存档 ID。
- 当前交付为可继续修改的栅格源图与逐帧动画；不是找回了历史原生分层模型或实时骨骼项目。历史绿色 Q78–85 不重计，Q86 状态不变。


## 2026-11-23：蔚蓝魔法师 Q 版与配套资源

- 来源：负责人原图 `owner-originals/蔚蓝魔法学园少女.png`，保持粉发双辫、蓝白花帽、书本和小鸟身份。使用 image_gen 生成/编辑，未使用教程角色或第三方贴图。
- 源实物：`blue-academy-chibi-20261123/` 的 motion/portrait/avatar/weapon/spell 五张 RGBA PNG；`generation.json` 保存完整提示/生成编号，`manifest.json` 保存尺寸/字节/SHA-256/帧边界与 alpha 范围。
- 人物 6×4 格、每帧256px，魔法 3×2 格、每帧512px；透明立绘1085×1450，头像和书本图标1254px方图。程序只复制并读取元数据，未裁切/调色/重绘像素。
- 运行：`game/public/art/blue-academy-20261123/` 与源 PNG 逐字节一致；`blueAcademyArt.mjs` 注册。用于普通施法、瞬发技能、命中/回响、待机/步行/受伤/倒地和各 UI 入口。
- 交付为可继续修改的栅格源与逐帧动画，不是历史分层或骨骼模型恢复。Q86、85/150 历史计数不变；验收与下一断点见 `docs/BLUE_CHIBI_ALIGNMENT_2026-11-23.md`。
