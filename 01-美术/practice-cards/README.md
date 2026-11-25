# 练习广场双卡原画

`clapper-and-target.png` 是本轮用 GPT 图像生成的一次性无字双联原稿，1774×887。左边的场记板夹着两张彩色排演提示，台灯和幕布在后景。右边画架上的实物靶有颜料命中痕迹，靶台前有颜料杯。两幅画都没嵌进标题、按钮和游戏角色。

在仓库根目录运行 `python 01-美术/practice-cards/export.py`，脚本用 Pillow 沿正中分开两幅画，各裁掉上方 25 像素和下方 26 像素，并导出为 640×604 的 WebP。运行时沿用 `owner-program-studio` 清单内的 `art/program-studio-20261101/practice-score.webp` 和 `practice-target.webp`。窄屏卡片再按实际框宽等比裁切，标题及点击范围由游戏绘制。
