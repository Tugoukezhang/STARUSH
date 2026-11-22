# Q68 红发30层源 · 制作中，未验收

聊天三PNG为正式设计，cutout-candidate.png为生成透明衍生参考，不是原附件字节，无需PSD。正式游戏立绘未替换。本目录不是完成的Live2D模型。

- layers.json/head-regions.json：30层源纹理、UV/遮罩、手动配准和部件组；body-surface扣除其他部件区域，shoulder-underpaint固定躯干后。
- red-layer-source.svg：独立Inkscape图层组；rendered-layers为30个实际裁切PNG和merged.png。raster-layers.json保存位置、尺寸和SHA。
- red-layer-source.ora/xcf：GIMP实际导入、保存、重开并移动/显隐后恢复验证通过。PNG编码3359412字节，解码RGBA估算23886420字节，非GPU实测。
- provenance.json：26张生成源PNG含失败/未选稿，本轮新增neck-skin-underpaint（未选）、neck-warm-underpaint及shoulder-underpaint。文件数不计交付。
- review.html：单层、底色、偏移、导出和分组诊断，不是XYZ参数、网格或物理。

原位缺失诊断2325→1227，四处原缺口三处归零、右衣片169→5；手腕内部±8px无透明孔。可见胸腹腿靴纹理误差下降。原生PNG重组对原生整图差0.19498/255、无高不透明丢失；对浏览器0.90460。原生整图对浏览器1.00520，跨渲染器差异边界保留。GIMP资源/Broken pipe/退出GLib警告保留；文件与ORA内部PNG哈希核对一致。

Q68尚未通过：耳颈硬折和色阶、抬臂肩根台阶、衣片/腿外缘遮挡仍需修。先看本轮vertical-head--8、vertical-raised-arm-8、vertical-front-coat-8截图，隔离对应源层修正，不整图遮盖。真实头部网格/XYZ属于Q69、眼睑虹膜属于Q70，不将这些未来工作冒充本项已完成；也不以它们为本项唯一停机理由。绿蓝尚未拆层，artAccepted/contentComplete/isLive2DModel均false。

完整报告：../../../docs/CLOUD_RED_PORTRAIT_LAYERS_2026-11-14.md。本轮证据均在仓库外/workspace/starush-environment/q68-overlap-20261114/。

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
NODE_PATH=/opt/codex/cua_node/lib/node_modules node /workspace/starush-environment/q68-overlap-20261114/q68-layer-bounds.cjs
python 01-美术/live2d/export-layer-pngs.py 01-美术/live2d/red-20261114 /workspace/starush-environment/q68-overlap-20261114/q68-layer-bounds.json --profile /workspace/starush-environment/tools/inkscape-q68-profile
```

此步骤会更新PNG/ORA清单，但XCF须另用GIMP从新ORA导入保存并重开验证，再更新provenance原生导出哈希。没有Python栅格绘画；Python仅编排Inkscape、读取尺寸/哈希和打包ORA。不要把旧XCF与新SVG混用。

测试截图/日志全部留仓库外`/workspace/starush-environment/q68-*`。详细验收与失败见`docs/CLOUD_RED_PORTRAIT_LAYERS_2026-11-14.md`，当前仍Q68、67/150已验收、83项未完成，所有全局验收标记false。
