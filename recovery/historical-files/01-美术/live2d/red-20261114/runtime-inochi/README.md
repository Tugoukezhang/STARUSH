# 红发 Inochi2D 运行包

这是 STARUSH 正式红发 PNG 衍生的真实网格运行包，65 部件、41 参数、7 发束＋3 衣物弹簧、两段小幅手臂动作。格式为 Inochi2D INP，不是 Cubism/moc3；完整角色/美术和游戏主页接入尚未验收。

在本目录启动 HTTP 服务后打开 `index.html`。`diagnostic.html` 提供完整参数检查；两者只读取本目录资源，不使用账号、云存档或外部 CDN。

`red.inp` 来自 Inochi Creator 0.8.6 的真实 Export > Inochi2D Puppet 导出。默认4096图集产生重采样差异，随后使用上一层 `export-lossless-inp.py` 保留原生运行结构/参数，恢复源纹理原字节、UV和纹理索引，得到65纹理的有效INP；没有修改图片像素或改名伪装。原生编辑器实际重开及浏览器同姿态三个测试画面与源INX逐像素相同。`red-source.inx` 是完整可编辑网格/参数/嵌入纹理源；分层绘图源仍保存在本项目红发源目录。

```js
import { createRedAvatar } from './avatar.mjs';
const avatar = await createRedAvatar(canvas, { onError: error => showError(error.message) });
avatar.play('respond'); // 或 steady
avatar.look(0.5, 0);   // [-1,1] 归一化注视
avatar.pause();
avatar.resume();
avatar.cancel();       // 平滑回到触发前姿态
avatar.reset();
avatar.destroy();      // 移除RAF、观察器、事件监听和释放运行时
```

物理由随包的120Hz固定步长浏览器弹簧模块驱动，不是INP内部物理节点。动作仍限定在已验收的小幅范围；不支持任意侧身或大幅挥手。运行需要WebGL2；上下文丢失会停止并报告，宿主应在上下文恢复后重建实例。没有宣称低端机性能、离线缓存或完整游戏实装已经验收。

第三方运行库来源与许可完整保留在 `vendor/`。`manifest.json` 记录本包文件hash、源和验收边界；截图/浏览器日志在仓外证据目录。
