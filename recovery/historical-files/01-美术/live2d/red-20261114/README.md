# Q68 红发28层源 · 制作中，未验收

这是用户红发设计的分层制作草稿，没有网格/变形器/转向/物理绑定，不能称为完成Live2D。正式游戏立绘尚未替换。用户聊天PNG是正式设计来源；`cutout-candidate.png`是通过会话图像工具制作的透明衍生参考，不是原附件字节。无需用户提供PSD。

## 当前实物

- `layers.json`：当前28层顺序、来源纹理、变换、UV区域、扣除遮罩、部件组；不是动画参数。
- `head-regions.json`：脸/头饰/颈/臂/衣片/枪械等手动几何与遮罩的持久源。名称虽为head，也包含其他部位；注册脚本从这里重建清单。
- `red-layer-source.svg`：共享原PNG纹理、独立Inkscape图层组，未栅格化的可编辑几何源。
- `rendered-layers/*.png`：Inkscape实际导出的28个裁切透明部件；`merged.png`是原生整图导出。
- `raster-layers.json`：每层PNG位置、尺寸、SHA256和部件组。PNG当前编码3083301字节、解码RGBA估算26705696字节；不是手机实测峰值。
- `red-layer-source.ora`、`red-layer-source.xcf`：实际分层源。GIMP已实际导入ORA，核对28层顺序/尺寸/位置，保存后重开XCF，并检查原生图层偏移/显隐后恢复。不是PSD或Cubism模型。
- `review.html`：重组/单层/底色/偏移/叠图/JSON导出/部件联动。仅制作诊断，不是主页UI或转向物理。
- `provenance.json`：22张早期生成PNG及本轮原生导出的来源与哈希；失败/未选稿保留追溯，不按文件数计交付。

## 未通过的边界及下一步

脸/刘海和护目镜已优先使用衍生参考原纹理，原先脸型漂移明显降低，但仍需对照聊天正式源图确认身份。头部联动横移8px的颈侧硬接缝与小缺口尚未消除；前后衣片/腿/手臂/武器边缘仍有差异。下一步先解决参考坐标[614,916]–[645,985]缺口和头部横移后的颈侧接缝，再复查肩臂/握枪与飘带。曾收紧衣片遮罩反而增加缺失，已撤回；不要直接恢复该失败方案。

双眼眉和嘴仍是纹理片，眼睑/虹膜/细发束尚未拆到可变形结构。头部10层、抬臂2层、后衣4层联动导出与重置功能检查通过，外观验收不通过；握枪4层、前衣5层补验联动导出/重置通过，但握枪手腕三角断口与前衣贴图边界在横移后明显，外观未通过。下一轮需核查body-core等底层残留的前臂/衣片画素，明确互斥遮罩与真正的遮挡补绘。没有把平移诊断称为转向。绿蓝未制作，手机长时/GPU峰值未验证。

28层原生PNG重组与原生整图平均通道差0.126/255，未丢失高不透明像素；跨浏览器渲染差1.120，初始小于1的检查仍失败，不能忽略抗锯齿/重采样差异。GIMP原生数据检查通过，但退出与PNG插件日志有警告，不能称日志全干净。

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
