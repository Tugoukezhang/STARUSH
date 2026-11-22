# Q70 红发眼部网格、眨眼与视线

## 玩家验收条件与范围

沿用 CLOUD_Q70_EYE_SOURCE_2026-11-14.md 开工条件：眼型/近远比例与用户身份保留；每眼上睑、下睑、眼白、虹膜瞳孔、高光分离；左右独立开合、双眼连续眨眼、九向视线；与 Q69 的 yaw ±20 / pitch ±12 / roll ±5 组合无穿插、漏眼白、翻折；复位/重开/触屏/旧存档通过。这里是实际 Inochi2D 原生参数与浏览器工作台接入，不是 Cubism、整张图摆动或游戏主页最终接入。完整角色物理、其他表情和主页接入仍属后续项。

## 制作与来源

沿用本项20:02已完整复核的210849全时段2fps、0–17秒35帧及17.5秒尾帧，完整转录JSON segments=[]核对；音轨存在，不推定静音、不声称原速观看。其余已取得五视频记录及缺第六边界见参考登记。本轮没有新增“看完整片”的虚假声明。

两次实际 image_gen 补绘：eye-white-underpaint.png 保留眼角与睫毛、补完整眼白；iris-complete-candidate.png 补完整虹膜。可见虹膜用既有脸部原纹理覆盖，新增补绘主要用于隐藏区，高光从原纹理单独取出。来源、hash及未全局验收标志已登记 provenance.json。

build-eye-source.py 使用 SVG 选区和 Inkscape 导出10个眼部RGBA纹理，替换候选中的2个旧整眼层，共60层。独立 eye-rig-source.svg / eye-rig-raster.json / red-eye-source.ora/.xcf/.psd；Q68已验收52层源和Q69模型保持字节不变。GIMP 3.0.4真实导入/保存/重开，60层RGBA、名称、偏移、尺寸、透明度与可见性一致；独立移动/隐藏后复位一致。GIMP退出日志有既有GLib/Broken pipe警告，进程退出0，验证断言通过。

Inochi Creator 0.8.6真实导入此PSD并另存 red-eye-import.inx，build-eye-rig.py保留该原生纹理尾段，生成 red-eye-rig.inx：60部件、6497顶点、11262三角。11参数包括原Head二维与Roll、左右Blink、二维Gaze，以及每眼Blink与Yaw/Pitch/Roll的6个二维修正。修正参数在浏览器控制器中跟随主控联动；原生编辑器中是独立可编辑参数，单独手动调Blink/Head不会自动带动修正，需要同时设值。没有伪造moc3。

## 修复与验证

初版非零默认开合在浏览器零输入时回到默认，改用默认0的Blink（0张眼/1闭眼）。直接叠加头部与眨眼造成左上睑极值翻折，厚度保持试案最小面积比-0.178679；加入6个真实修正参数后6750个部件/姿态组合全部正向，最小0.209581。失败geometry-band20-failed.json保留。

首轮视觉看似闭眼，逐像素检测发现闭眼视线变化仍影响111像素、最大通道差31。当前WASM运行库对原生opacity曲线的结果未达到闭合要求；控制器通过公开set_part_opacity_by_name同步相同曲线（opening小于0.25渐隐眼白/虹膜/高光，0完全隐藏）。眼睑始终实际网格运动，不靠透明度替代眨眼。修正后闭眼不同视线像素完全一致；复位与模型重载的原生尺寸PNG hash完全相同。

原生另存/重开eye-roundtrip.inx：60部件、11参数、所有绑定数量一致；顶点/三角索引与纹理尾段完全相同；UV最大浮点差5.56e-8，绑定最大差1e-6。已在重开工程操作双眼闭合，并进入eye-left-upper网格编辑模式检查，取消退出未修改源。

中立新旧模型比较只改变眼部包围范围内1900像素（x547–638/y188–245），眼部外0像素变化。浏览器工作台1280×950及393×852触屏的7主控、连续0.4秒眨眼演示、复位/重载、下载、闲置不重绘、localStorage保持检查通过。连续演示仍须随最终透明度修正重测；最终结果以证据JSON为准。

生产构建B401 rc-19136d1a8ecc成功，既有大chunk警告保留；cloudQueueState与b68PublicBattleCheckpointStorage两项测试通过。真实Chromium自然点击巡演→守谱司钟→开始→移动→暂停→返回→重载，旧v19测试存档与profile不变，无控制台错误；没有注入生命或胜利、没有声称自然通关。

## 证据与下一步

所有截图、日志、原生比对副本及测试脚本在仓库外 /workspace/starush-environment/q70-eye-rig-20261114。geometry.json、native-roundtrip-check.json、gimp-psd-check.json、pixel-validation.json、source-boundary-check.json、interactions.json、game-browser.json、production-build.log、regression-tests.log。

177姿态画面覆盖75头部关键组合的全闭/半闭，以及9向视线×3开合；透明度修正后正在重做最终画面核对。仅在最后核对成立后写入眼部限定验收文件并推进Q71。全局 artAccepted/contentComplete/isLive2DModel 继续false，不推送、不部署。
