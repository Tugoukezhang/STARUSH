# v5.1 接入前精修报告

生成日期：2026-05-30

## 目标

根据 v5 三轮自审核继续精修，不重新调用生成模型，不改变美术方向，只做可控的接入级后期处理。

## 背景 A 接入版

文件：

- `stage-combat-idol-v5-1-a-gameplay-polish-750x1334.png`
- `stage-combat-idol-v5-1-a-gameplay-polish-375x667-preview.png`
- `stage-combat-idol-v5-original-a-750x1334-reference.png`
- `stage-combat-idol-v5-original-a-375x667-reference.png`

处理内容：

- 压低中央战斗通道亮度和冷色调，让角色与弹幕更稳。
- 压左上大星灯和左右边缘高光，降低抢焦点问题。
- 在中央通道补极低对比度星图道路和节点，让地面更像设计过的舞台跑道。
- 在底部黑区补暗部栏杆线和小灯点，避免看起来像未完成遮罩。

美术判断：

- v5.1 更适合直接接入首战。
- 画面仍保留 v5 的音乐节舞台气质，但玩法区更规整。
- 星图线条刻意保持低对比，避免抢弹幕。

## 音符弹幕 gameplay atlas

文件：

- `bullet-note-vfx-v5-1-gameplay-512x256.png`
- `bullet-note-vfx-v5-1-gameplay-512x256.json`
- `bullet-note-vfx-v5-1-gameplay-32px-preview.png`

处理内容：

- 把 v5 第 2 行拖尾弹提升到第 1 行，作为默认飞行弹。
- 原第 1 行音符图标降到第 2 行，作为蓄力、发射起点或提示素材。
- 第 3 行爆开保持为命中特效。
- 对黄/橙做轻微色相分离：黄色更偏金色，橙色更偏火焰橙红。
- 清理透明像素和纯绿 key 像素。

建议接入：

- 飞行弹使用 `bullet_note_*_0`，即 atlas 第 1 行。
- 发射起点或蓄力提示使用 `charge_note_*_0`，即 atlas 第 2 行。
- 命中特效使用 `impact_note_*_0`，即 atlas 第 3 行。

## 审图文件

- `v5-1-gameplay-polish-contact-sheet.png`

该图左侧为 v5 原 A，右侧为 v5.1 接入版，下方为 v5.1 弹幕 32px 预览。

## 结论

v5.1 是目前更适合首战接入的一版。后续如果继续打磨，建议不要再大范围重生成，而是进入“局部人工修饰/游戏内实机叠加测试”阶段。
