# 别让猫进厨房 · 加密工程备份

选中本分支后，可下载 ZIP，也可以用 Git 只克隆备份分支。恢复密钥由工程持有人单独保存。备份使用 GnuPG 的 AES-256 对称加密。每份文件和每个分片都有 SHA-256 校验值。

在 macOS、Linux 或 Windows WSL 中，准备 Python 3、GnuPG 2 和 Zstandard，再运行以下命令。把引号里的密钥路径换成你保存的位置。

```sh
git clone --single-branch --depth 1 --branch backup/cat-kitchen https://github.com/Tugoukezhang/STARUSH.git cat-kitchen-backup
cd cat-kitchen-backup
python3 restore.py --key "/path/to/cat-kitchen-backup-recovery.key" --out restored
```

默认取最新版本，也可在命令末尾指定 `--version 3.2.0`。工具会检查各分片，恢复并重新验证每个 ZIP。输出包括小游戏源码、网页试玩包、美术源图包和旧版对比工具需要的资料。网页包解压后用本地 HTTP 服务打开，小游戏工程可导入微信开发者工具。美术包的 `originals/` 保存原始 PNG。

要在同原工程一致的 Linux 布局下复跑全部审查，解压源码并将顶层文件夹改名为 `/workspace/cat-kitchen/game`，将美术包的 `originals/*.png` 放入 `/workspace/generated_images`，把对比资料 ZIP 直接解压到 `/workspace/cat-kitchen`。开发工具使用 Node 24、Python 3、Chromium、FFmpeg。如需重跑画面和浏览器检查，可在游戏目录安装 `sharp@0.35.5`、`@napi-rs/canvas@0.1.100` 和 `playwright@1.62.1`。字库重建使用 FontTools 与 Noto Serif CJK SC。游戏自带所需的运行素材。
