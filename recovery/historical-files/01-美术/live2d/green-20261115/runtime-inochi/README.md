# 绿发角色独立运行包

88 个部件、49 个原生参数的 Inochi2D 网格模型，包含头脸转向、眼口表情、躯干双臂、七路发区与五路衣物弹簧、月饰和音符叶饰。不是 Cubism/moc3，尚未完成 Q85 正式角色页面接入；全局美术和内容完成标志仍为 false。

通过 HTTP 服务打开本目录的 `index.html`。本包只读取目录内的模型、动作和运行库，不依赖外部 CDN、账户或存档。`diagnostic.html` 用于检查全部参数；该诊断页面与编辑源不应进入生产载荷。

```js
import { createGreenAvatar } from './avatar.mjs';
const avatar = await createGreenAvatar(canvas, {
  signal: controller.signal,
  onError: error => showStaticFallback(error.message),
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
});
avatar.play('chime'); // gesture / breathe / blink / smile
avatar.look(0.5, -0.2); // 每轴 [-1, 1]；正在播放动作时不打断动作
avatar.cancel(); // 220 毫秒平滑回到动作触发前姿态
avatar.pause(); // 冻结动作、弹簧和帧循环
avatar.resume();
avatar.reset();
avatar.reload(); // 重载内存中的模型，回正并清空动作和弹簧
avatar.destroy(); // 移除监听器、观察器、帧循环并释放 WASM 实例
```

动作来自 Q81–Q83 的原创有限回应，轨道保存在 `actions.json`。连续切换保留最初的基准姿态，并以 160 毫秒过渡避免突跳；动作按有效前台经过时间推进，物理按固定 120Hz、每帧最多 50 毫秒模拟推进。减少动态时回正并禁止动作、注视和拨动。切后台取消当前动作、恢复基准、清空速度；返回后不自动重播。空闲没有持续帧循环。显式 pause 保持暂停状态，play 不会隐式解除暂停。

资源加载失败会拒绝创建，可在同一 canvas 上重试；重复占用同一 canvas 会拒绝。上下文丢失会停止并报告，宿主应销毁实例并在新 canvas 或恢复后的上下文上重建。AbortSignal 可取消加载或销毁已创建实例；页面退出会自动销毁。WebGL2 必须支持 stencil，保证眼白、虹膜与眼睑遮挡正确。

`green-source.inx` 是 Q83 已验收可编辑网格源的字节副本。`green.inp` 先由 Inochi Creator 0.8.6 的 File → Export → Inochi2D Puppet 实际导出，再使用项目已有 `../../red-20261114/export-lossless-inp.py` 恢复源纹理字节、UV 和纹理索引，保留原生运行结构与参数并去除编辑器 groups；没有用改扩展名伪装导出。原生导出及最终文件证据在仓外 Q84 目录。

物理由本包 `green-spring.mjs` 驱动真实网格参数，不是 INP 内部物理节点。连续马尾按上中末段控制；月饰框架作为一个已有部件运动，未制作每个铃铛的独立物理。只支持既有验收的小幅范围；不能宣称大幅转身、低端移动硬件性能或完整三角色验收。

第三方运行库来源、许可证和通知保留于 `vendor/`；未读用禁止 AI 使用的 SDK 源目录。运行资源、源与验收范围以 `manifest.json` 的文件哈希为准。
