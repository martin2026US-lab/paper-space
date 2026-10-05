# 安装纸间（Windows）

1. 打开 [最新版本](https://github.com/martin2026US-lab/paper-space/releases/latest)。
2. 下载 `Paper-Space-1.0.2-Windows-x64-Setup.exe`，不要选 GitHub 自动生成的 Source code。
3. 双击安装，选择安装目录；安装完成后从桌面或开始菜单打开 **纸间 Paper Space**。
4. 导入 PDF、Word、TXT 或 Markdown，即可本机阅读。使用翻译、AI 解读和对话时，在左下角配置自己的模型接口。

支持 Windows 10 / 11 x64。安装包内置 Electron、Python、Docling 和识别模型，不需要 Node.js、Python 或命令行配置。安装后可离线阅读和识别；AI 功能需要你配置的模型服务。

请预留至少 6 GB 可用空间，用于安装与临时解压。复杂 PDF 的第一次识别可能需要几分钟，原文会先显示。扫描 PDF 的 OCR 尚未启用。

此版本尚未进行商业代码签名，Windows 可能显示未知发布者提示。请只使用此仓库的 Release 下载，并可使用附带的 SHA256SUMS.txt 核对文件完整性。

## 数据与升级

安装版的文献、批注、对话、加密密钥与缓存保存在 `%APPDATA%\PaperSpace`。程序安装目录与个人数据分离；升级覆盖程序文件，卸载保留个人资料。不要将此数据目录上传至 GitHub。

早期便携开发版保存在它自身的 `data/` 目录，两者不会自动合并。测试安装或切换版本不会修改旧版的文献库。旧版使用者可保留原目录并导出笔记；目前没有完整的跨版本资料迁移工具。两版默认占用相同的本机端口，请勿同时启动。

## 卸载

在 Windows 的“设置 → 应用”中卸载纸间。卸载不会清除 `%APPDATA%\PaperSpace`，重新安装后仍可读取。要清除私人资料，请先自行备份，再删除该目录。

## 给开发者：重新构建

```sh
npm ci
python scripts/stage-runtime.py /path/to/prepared/runtime
npm run dist:win
```

离线 runtime 目录应包含可搬移的 `python/`、`docling/Lib/site-packages/` 和 `models/`；参考 `scripts/stage-runtime.py` 的组件白名单。模型许可原文随安装包一起提供。构建中间产物、运行环境与个人数据不会提交进源码仓库。

安装包输出到 `dist/`。构建配置使用文件白名单，不包含个人文献、API Key、聊天记录或示例论文全文。源代码 CI 不会自动发布二进制文件；发布前应在隔离目录验证安装、解析、重启持久化及卸载。
