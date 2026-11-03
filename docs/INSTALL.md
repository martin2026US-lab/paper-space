# 安装纸间

## Windows

1. 打开 [最新版本](https://github.com/martin2026US-lab/paper-space/releases/latest)。
2. 在最新版本的 Assets 列表中，下载名称符合 `Paper-Space-<版本号>-Windows-x64-Setup.exe` 格式的安装程序（`<版本号>` 为占位符，请以实际文件名为准）。不要选择 GitHub 自动生成的 Source code 压缩包。
3. 双击安装，选择安装目录；安装完成后从桌面或开始菜单打开 **纸间 Paper Space**。
4. 首次打开时可选择中文或 English，然后阅读并主动勾选确认使用声明；未同意前工作台保持关闭。
5. 导入 PDF、Word、TXT 或 Markdown，即可本机阅读。使用翻译、AI 解读和对话时，在左下角配置自己的模型接口。

支持 Windows 10 / 11 x64。安装包仅携带阅读器与 Electron。原文阅读无需 Python；结构识别组件可在「更多 → 文档识别组件」中选择目录并一键下载，或选择已有环境。首次下载完成后可离线识别；不内置对话大模型、不预置 API Key。AI 功能需要你配置的模型服务，主动使用时相关材料会发送至该服务。

阅读器安装建议预留 500 MB 空间；可选识别组件建议另预留至少 6 GB。复杂 PDF 的第一次识别可能需要几分钟，原文会先显示。扫描 PDF 的 OCR 尚未启用。

安装目录限 80 个字符。识别组件保存在程序目录之外，可自行选择 D 盘等位置。首次从旧版升级时会复制已有识别环境以保留离线能力，迁移可能需要几分钟；后续更新仅替换阅读器。组件不会随应用卸载自动删除。

此版本尚未进行商业代码签名，Windows 可能显示未知发布者提示。请只使用此仓库的 Release 下载，并可使用附带的 SHA256 校验文件 核对文件完整性。

## macOS（Apple Silicon）

支持 macOS 14 或更新版本及 Apple Silicon（M 系列芯片）；本次不提供 Intel Mac 安装包。打开 `Paper-Space-<版本号>-macOS-arm64.dmg`，将「纸间」拖到 Applications，然后从 Applications 启动。阅读器不携带 Python 或识别模型；基础 PDF、Word 和文本阅读可直接使用。

此构建使用临时签名（ad-hoc），无需 Apple 开发者证书，未提交 Apple 公证。如果系统阻止打开，请核对文件来源和 SHA256 校验值，再通过「系统设置 → 隐私与安全」中的允许打开选项操作；不需要关闭系统的安全机制。下载者无需开发者账号。后续可配置 Developer ID 签名与公证以改善首次安装体验。

升级前通过「更多 → 备份与恢复」保存完整备份，并按 Command+Q 退出纸间。将新版拖入 Applications、替换旧应用，再从 Applications 启动；用户资料和已下载的 Docling 组件位于应用包外，会继续保留。

在「更多 → 文档识别组件」中可一键配置原生 arm64 的 Python 3.12、Docling 和模型，也可选择包含 `venv/bin/python` 与 `models/ready.json` 的已有环境。默认组件位于 `~/Library/Application Support/PaperSpace/components`，更新或移动 .app 不会删除模型。首次配置需联网；安装失败或取消时保留已有可用环境，之后解析离线进行。解析保持 CPU 模式，与 Windows 行为一致。

Mac 使用系统钥匙串保护保存的 API 密钥。关闭窗口后应用保留在 Dock，点击 Dock 图标重新打开；使用 Command+Q 完全退出。搜索使用 Command+K，专注阅读使用 Command+Shift+F，刷新使用 Command+R。

## 数据与升级

安装版的文献、批注、对话、加密密钥与缓存在 Windows 保存在 `%APPDATA%\PaperSpace`，在 macOS 保存在 `~/Library/Application Support/PaperSpace`。程序安装目录与个人数据分离；升级覆盖程序文件，卸载保留个人资料。不要将此数据目录上传至 GitHub。

早期便携开发版保存在它自身的 `data/` 目录，两者不会自动合并。测试安装或切换版本不会修改旧版的文献库。旧版使用者可保留原目录并导出笔记；目前没有完整的跨版本资料迁移工具。两版默认占用相同的本机端口，请勿同时启动。

## 完整备份与恢复

在「更多 → 备份与恢复」创建 .paperbackup 文件。恢复会先校验完整性，再显示数量供确认；同 ID 的文献创建副本，不覆盖当前文献。接口配置需主动勾选导入，现有选择与密钥保持不变；跨设备需重新输入密钥。旧版 TXT/Markdown 未保存原始字节的记录会保留已有完整阅读文本，新导入的文本文件也保存原始字节。模型权重与 API 密钥不进入可携带备份。

## 阅读风格

安装后可通过右上角「经典 / 杂志」选择界面；现有安装保留经典默认值。风格切换不会迁移或重建文献库。两种风格各自保存布局，使用同一套原文件、批注、模型接口与密钥。

## 卸载

Mac 可将 Applications 中的纸间移到废纸篓；用户资料与识别组件保留。需要完全移除时，先备份资料，再自行删除 `~/Library/Application Support/PaperSpace`。

在 Windows 的“设置 → 应用”中卸载纸间。卸载不会清除 `%APPDATA%\PaperSpace`，重新安装后仍可读取。要清除私人资料，请先自行备份，再删除该目录。

## 给开发者：重新构建

```sh
npm ci
npm run dist:win
# 在 Apple Silicon Mac 上构建 DMG
npm run dist:mac
```

Docling 为独立的可选组件，不需要准备 runtime 即可构建轻量阅读器。组件可由应用从官方源一键配置，也可接入已有完整环境；模型及依赖许可保留在各自安装目录。构建中间产物、运行环境与个人数据不会提交进源码仓库。

安装包输出到 `dist/`。构建配置使用文件白名单，不包含个人文献、API Key、聊天记录或示例论文全文。源代码 CI 不会自动发布二进制文件；发布前应在隔离目录验证安装、解析、重启持久化及卸载。

Windows 安装保留官方 Electron 可执行文件原样，避免改写资源导致新的运行文件被应用程序控制拦截。文件属性可能显示 Electron 运行时版本；纸间版本以应用内显示、安装记录及 /api/health 为准。应用窗口仍使用纸间图标。

桌面和开始菜单快捷方式直接引用安装目录内 `resources/app/desktop/icon.ico`；安装及升级自动修正图标，并保留快捷方式的应用标识。安装器与卸载器也显式使用纸间图标。
