# 蓝白 Q86 分层源重建检查点

状态：**WIP，Q86 未验收；现为 66 层。** 本目录不是找回的历史 65 层成品，而是利用已有正式立绘和恢复的分区工具重新建立的实物。没有接入游戏动态立绘。上一检查点的 61 层版本保留在 Git 提交 `cd035bafe4b23fb1af97e6c7e8deeb65991bf832`。

- `blue-white-layer-source.xcf`：GIMP 3 可编辑源工程。
- `blue-white-layer-source.psd`：分层 PSD 源稿，已用 GIMP 重新打开；未做 Photoshop/Cubism 导入验收。
- `blue-white-layer-source.ora`：OpenRaster 图层容器，内含实际 PNG。
- `blue-white-layer-source.svg`、`build-source.py`、`layers.json`：可修改的部件坐标和遮罩；原底图不涂改。
- `rendered-layers/`：66 张实际部件 PNG 及默认合成图，位置和校验值见 `raster-layers.json`。
- `hair-underpaint-candidate.png`、`book-underpaint-candidate.png`：image_gen 补绘原始输出。四个补绘层默认隐藏，不能作为已通过素材使用。
- `face-foundation-paint.png`、`sleeve-complete-paint.png`：本轮脸部和右肩底面使用的 image_gen 补绘；较早肤色稿另存 `face-foundation-draft.png`。注册、遮罩和三块发丝归属在 `occlusion-patches.json`。
- `source-review.html`：独立检查页，支持显隐、单层、移开、复位、底色和底图对照；先验证文件 SHA，再解码显示。
- `verification.json`：本轮真实文件与检查结果。最新进展见仓库 `docs/BLUE_Q86_FACE_SHOULDER_2026-11-23.md`；最初的源重建记录见 `docs/BLUE_Q86_SOURCE_REBUILD_2026-11-23.md`。

66 层包含 60 个可见分区（含一层待分配余面）、2 个启用的局部底面和 4 个隐藏候选。五官底面已补上，眼眉口隐藏检查的五个取样点不再透明；右肩已有局部衣料衔接。检查页让脸部/上衣各自带着所属底面一起检查，这不是骨骼绑定。眼睛仍未拆为睫毛/眼白/虹膜；脸部层还有残留发丝和衣领，衣袖边缘仍待精修。大幅移动仍有发根、袖口接缝和空洞，书封候选也未通过。不能直接作为 Cubism 导入成品或动态立绘使用。

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
node qa-occlusion.cjs
python verify-source.py
```

浏览器脚本支持 `STARUSH_PLAYWRIGHT_MODULE`、`STARUSH_CHROMIUM`、`STARUSH_Q86_URL`；验证脚本读取同一个 `STARUSH_Q86_SCRATCH`。生成脚本会重建导出文件；如果在 XCF/PSD 手工改画，先另存为新的源版本，不能直接运行旧源脚本覆盖手工修订。

## 来源与边界

`cutout-candidate.png` 与 `../../blue-academy-chibi-20261123/portrait.png` 完全相同，后者源于负责人正式原图。分区代码来自本仓库恢复档案，原档案保持不动；原图、补绘提示、实际 PNG 和可编辑文件随本检查点保存。只参考教程方法，没有打包第三方视频或截图。没有 `.cmo3`、网格、物理或运行模型；不能将本目录的存在当作 Q86 通过。
