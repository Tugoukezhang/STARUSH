# Q68 红发28层源 · 制作中，未验收

这是用户红发设计的分层制作草稿，没有网格/变形器/转向/物理绑定，不能称为完成Live2D。正式游戏立绘尚未替换。用户聊天PNG是正式设计来源；`cutout-candidate.png`是通过会话图像工具制作的透明衍生参考，不是原附件字节。无需用户提供PSD。

## 当前实物

- `layers.json`：当前28层顺序、来源纹理、变换、UV区域、扣除遮罩、部件组；不是动画参数。
- `head-regions.json`：脸/头饰/颈/臂/衣片/枪械等手动几何与遮罩的持久源。名称虽为head，也包含其他部位；注册脚本从这里重建清单。
- `red-layer-source.svg`：共享原PNG纹理、独立Inkscape图层组，未栅格化的可编辑几何源。
- `rendered-layers/*.png`：Inkscape实际导出的28个裁切透明部件；`merged.png`是原生整图导出。
- `raster-layers.json`：每层PNG位置、尺寸、SHA256和部件组。PNG当前编码2994910字节、解码RGBA估算22507680字节；不是手机实测峰值。
- `red-layer-source.ora`、`red-layer-source.xcf`：实际分层源。GIMP已实际导入ORA，核对28层顺序/尺寸/位置，保存后重开XCF，并检查原生图层偏移/显隐后恢复。不是PSD或Cubism模型。
- `review.html`：重组/单层/底色/偏移/叠图/JSON导出/部件联动。仅制作诊断，不是主页UI或转向物理。
- `provenance.json`：23张生成PNG（本轮新增neck-underpaint.png）及原生导出的来源与哈希；失败/未选稿保留追溯，不按文件数计交付。

## 未通过的边界及下一步

本轮把持枪左臂从肩袖到握枪手改成连续的衍生参考源纹理，肩部隐藏补绘保留，手腕0/±8px内部1845像素均无透明穿孔。修复袖口、护目镜、衣片、肩后发尾与飘带边缘，剔除后衣补绘中重复的橙色飘带；夹克垂带与领口同归静止躯干层。新增neck-underpaint.png是真实图像工具补绘，仅使用其颈部皮肤区域，遮挡上方保留可见参考表面。手动仿射扩展是制作对位，不是运行时变形器。

原位参考不透明而重组透明的诊断像素5294→2325；这不是完整美术验收。颈部横移后仍有耳下/发际硬接缝与色阶，前后衣片和腿部位移遮挡仍未过。下一步逐层核对左衣片[422,792]–[437,827]、右飘带[743,676]–[777,729]、头饰[626,88]–[647,112]、袖/夹克交界[480,475]–[499,484]，再修颈部接缝。不得用整图遮盖错误。脸/刘海和护目镜采用透明衍生参考纹理，仍需对照聊天正式源图确认身份，不能声称原附件逐像素复原。

双眼眉和嘴仍是纹理片，眼睑/虹膜/细发束尚未拆到可变形结构。头部10层、抬臂2层、握枪4层、前衣5层、后衣4层联动导出与重置功能检查通过，外观未全部通过；没有真实网格/变形器/转向/表情/发衣物理模型，绿蓝未制作，手机长时/GPU峰值未验证。

28层原生PNG重组与原生整图平均通道差0.1262/255，高不透明像素丢失0；跨Chromium差1.0182，旧小于1的门槛仍未过，记录抗锯齿/重采样边界。GIMP原生导入/保存/重开及修改恢复检查通过，但资源/PNG插件Broken pipe/退出GLib日志警告保留，不能称日志全干净。全部PNG、ORA内部图层字节、SVG哈希与当前清单核对一致，XCF由当前ORA实际生成并重开。

本轮证据在仓库外 `/workspace/starush-environment/q68-seams-20261114/`。这是同一Q68中的实物修复，不增加已验收项。

## 继续操作

任何写入先按工程约定获取原制作锁。保留所有已有未提交改动，不触碰其他会话Blender配置。

从项目根运行：

```sh
/workspace/starush-environment/tools/video-review-venv/bin/python 01-美术/live2d/register-layers.py 01-美术/live2d/red-20261114
node 01-美术/live2d/export-layer-source.mjs 01-美术/live2d/red-20261114
python -m http.server 6190 --bind 127.0.0.1 --directory 01-美术/live2d
```

打开`/red-20261114/review.html`。先修持久几何源，不要只改会被重建覆盖的layers.json。每次几何变化后，必须重新用仓库外`q68-layer-bounds.cjs`测各层可见范围，再导出；旧范围SHA不匹配会拒绝导出。

```sh
node /workspace/starush-environment/q68-layer-bounds.cjs
python 01-美术/live2d/export-layer-pngs.py 01-美术/live2d/red-20261114 /workspace/starush-environment/q68-layer-bounds.json --profile /workspace/starush-environment/tools/inkscape-q68-profile
```

此步骤会更新PNG/ORA清单，但XCF须另用GIMP从新ORA导入保存并重开验证，再更新provenance原生导出哈希。没有Python栅格绘画；Python仅编排Inkscape、读取尺寸/哈希和打包ORA。不要把旧XCF与新SVG混用。

测试截图/日志全部留仓库外`/workspace/starush-environment/q68-*`。详细验收与失败见`docs/CLOUD_RED_PORTRAIT_LAYERS_2026-11-14.md`，当前仍Q68、67/150已验收、83项未完成，所有全局验收标记false。
