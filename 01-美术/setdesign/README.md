# 巡演空间、外框和文字底稿

三张 GPT 原始画稿分开保存。场景、框、游戏人物、文字均可独立替换。用 ImageMagick 从本目录运行 `bash export.sh`，会覆盖 `game/public/art/setdesign/` 中对应的十八幅 WebP。正式名称、状态、数字和正文由游戏绘制。

| 原图 | 画面位置 | 对应输出 |
| --- | --- | --- |
| venues-original.png | 从左上到右下 | 场馆入口 foyer、化妆间 wardrobe、巡演地图 route、设备仓 workbench |
| rooms-original.png | 从左上到右下 | 唱片档案室 archive、排练舞台 rehearsal、演出事务所 office、海边屋顶 observatory |
| stationery-original.png | 上排 | 象牙工作证 card、奶油便签 note |
| stationery-original.png | 中排 | 深青监听屏 monitor、暖白对话纸 dialog |
| stationery-original.png | 下排 | 深紫节目名牌 strip、荧光入场券 stub |

场景完整保留 512×768 竖构图。框沿透明边裁切，统一到 320×200。在 CSS 中从四边向内切 42 像素，让四角独立缩放、中央留给文字。紧凑操作边沿约 6–9 CSS 像素，正文约 12–16 CSS 像素。无图时用各处的实底色承接文字。

三张 180×180 人物证件照从负责人确认的三张头像缩小导出。开机出场证与 50 像素换人框共用，可从同一脚本复导。

首页标志直接从既有透明组件原稿的左上角裁出 435×151，按无损 WebP 导出。首页单独读取此格。
