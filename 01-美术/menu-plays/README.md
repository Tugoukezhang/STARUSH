# 资料窗的实战小图

运行 `python 01-美术/menu-plays/export.py` 会在 `game/public/art/menu-plays/` 导出七张 WebP。脚本使用 Pillow，原始图格来自本仓库的三份 `game/public/art/performance-poses/`。每格为 256×256，四列。女武神使用第 8、9 格，风歌第 8、10 格，蔚蓝第 9、10 格，从零计数。

`captures/` 中的三张人物图从 390 CSS 像素视口的本作实战画布取样，保留当时人物脚下的涂色。女武神取 `performance-motion/sakura` 第 236 帧，风歌取 `performance-motion/kai` 第 69 帧，蔚蓝取 `performance-motion/enjo-reduced` 第 85 帧，均以采样记录中从零开始的索引计。蔚蓝使用减少动态效果设置。警示示例取 `effects-fix/danger-390/boss/1667.jpg`，原画布 375×667，压缩前原帧已随本目录保留。此帧只用于旧街章节的场地规则。各图展示本作规则，不含竞品图稿。
