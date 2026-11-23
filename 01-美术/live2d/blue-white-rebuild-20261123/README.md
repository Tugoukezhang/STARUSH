# 蓝白 Q86 分层源重建检查点

状态：**WIP，Q86 未验收，当前 90 层。** 负责人要求整张源稿完成再交付。本目录的中途备份不代表任务完成，没有接入游戏动态立绘。

- 原生源：`blue-white-layer-source.xcf`、`.psd`、`.ora`；位置与 SHA 见 `raster-layers.json`。
- 实际输出：`rendered-layers/` 下 90 张非空部件 PNG，以及 `merged.png`。64 个原图部件及有记录的连续重绘，26 个活动补绘底面，没有未归属余面层。
- 可编辑坐标：`build-source.py`、`complete-source.py`、`occlusion-patches.json`、`micro-ownership.json`、`occlusion-envelopes.json`。前后关系由 `complete-source.py` 管理。
- image_gen 原始补绘、提示与参考关系：根目录各 PNG 和 `generation.json`。整件生成稿有些仅作候选，不要用它们替换正式角色。
- `source-review.html`：先验证 SHA 的实际 PNG 检查页，支持显隐、单层、偏移、复位、原图和深浅底色对照。部件归属只是检查帮助，不是骨骼或物理。
- 最新边界：仓库 `docs/BLUE_Q86_FULL_SOURCE_PROGRESS_2026-11-23.md`；结构化记录：`verification.json`。

当前源稿已对头发、脸、眼、衣服、腿部和书本等表面做连续重绘，不再声称与原透明立绘近似逐像素相同。原参考及游戏资产未改。完整差异、生成素材来源、PNG 与原生重开结果见 `verification.json`；仍有脸侧小发束和帽花边缘待最后修顺，源准备尚未验收，不能进入 Q87。

继续编辑优先使用 **XCF 或 PSD**。GIMP 3 直接导入 ORA 会采用不同的默认叠色方式；本轮新增重叠底面后能看出差异。打包脚本已为保存的 XCF/PSD 统一为经典正常模式，并单独保留 ORA 默认导入的检查结果；ORA 的图层图片字节完整，但不能把其默认叠色当作颜色验收基准。

## 重建和检查

需要 Python 3（验证还需 Pillow、NumPy）、Inkscape、GIMP 3；浏览器复查需要 Playwright 和 Chromium。工具程序不做自动涂绘；补绘图片来自 image_gen，Python 只组织坐标、容器和校验。

在本目录运行：

```sh
python build-source.py
python export-source.py
python -m http.server 5180 --bind 127.0.0.1
```

访问 `http://127.0.0.1:5180/source-review.html`。检查页仅在本机开放，不是游戏发布。

在已有图形显示的环境中，用 GIMP 的 `python-fu-eval` 执行 `package-native.py`，设置 `STARUSH_Q86_ROOT` 为本目录绝对路径，`STARUSH_Q86_SCRATCH` 为仓库外证据目录。脚本导入 ORA、保存 XCF/PSD、逐层显隐移动复位、关闭后重新打开并输出 PNG 对照。云端本轮使用 GIMP 3.0.4 和临时 Xorg 显示，不需要用户本机操作。

```sh
gimp -n -i --batch-interpreter=python-fu-eval \
  -b 'exec(open("package-native.py").read())' --quit
node qa-source.cjs
python verify-source.py
```

旧 `qa-occlusion.cjs` 是 66 层版本的局部取样记录，不是当前整张源稿的最终验收。

浏览器脚本支持 `STARUSH_PLAYWRIGHT_MODULE`、`STARUSH_CHROMIUM`、`STARUSH_Q86_URL`；验证脚本读取同一个 `STARUSH_Q86_SCRATCH`。生成脚本会重建导出文件；如果在 XCF/PSD 手工改画，先另存为新的源版本，不能直接运行旧源脚本覆盖手工修订。

## 来源与边界

`cutout-candidate.png` 与 `../../blue-academy-chibi-20261123/portrait.png` 完全相同，后者源于负责人正式原图。分区代码来自本仓库恢复档案，原档案保持不动；原图、补绘提示、实际 PNG 和可编辑文件随本检查点保存。只参考教程方法，没有打包第三方视频或截图。没有 `.cmo3`、网格、物理或运行模型；不能将本目录的存在当作 Q86 通过。
