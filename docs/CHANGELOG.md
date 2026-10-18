# 更新记录 / Changelog

## 1.2.0

- 新增原文与译文逐段对照的双语视图，支持单段/当前页翻译、收起、取消与已有缓存复用；译文选区不会伪装成原文引用。
- 新增完整压缩备份：原文件、文献与回收站、批注、会话、历史来源、译文和接口元数据。逐记录 SHA-256 与整体摘要校验；损坏或截断拒绝导入。
- 恢复使用单个 IndexedDB 事务，失败回滚，重复文献生成副本；默认保留已有配置，可按需合并接口列表，不导出 API 密钥。
- 安装包移除 Python、Docling 和识别权重。提供官方源一键配置、进度、取消、目录选择和已有环境接入；固定已验证的依赖版本。
- 识别组件位于程序目录之外，旧版升级会先迁移识别环境；文献数据目录、模型配置与密钥绑定保持不变。
- English and Chinese controls are included for all new flows. The source/translation language choices stay independent.

## 1.1.0

- 新增中英文界面，覆盖首次使用、阅读工具、模型与翻译设置、批注、会话、回收站以及 Windows 原生菜单。界面语言与翻译、解读输出语言独立。
- 语言切换保留阅读页、滚动位置、未发送问题和已存文档；文献与已有生成内容保持原样。
- 增加一键整段翻译，跨页段落使用完整来源；译文缓存按来源、语言、服务和模型隔离。
- 翻译服务与阅读 AI 分开配置，支持本机模型、自定义 AI 接口及用户接入的专用翻译 API；按协议检测和映射可用目标语言。
- 本机翻译模型列表支持刷新、选择和手动 ID 回退，同一服务地址可切换不同模型。
- 本地内置 Source Serif 4 与 Noto Serif SC 开源字体；简化主页、玻璃边框、精简阅读工具，移除代码文件材料导入。
- 修复“更多”菜单被工具栏遮挡、模型列表旧响应覆盖、快速重新打开设置的竞态问题。

### English

- Switch between English and Simplified Chinese, including first-use notices, reading tools, model and translation settings, notes, conversations, trash, and Windows menus.
- UI, translation target, and explanation/answer languages are independent. Switching UI language keeps your reading position, unsent question, and saved content.
- Translate complete paragraphs, including joined paragraphs across pages. Caches are separated by source, language, endpoint, and model.
- Configure translation independently from reading AI: local models, custom AI endpoints, or compatible translation APIs with supported-language detection.
- Switch installed local translation models at the same endpoint, with refresh and manual model ID entry.
- Bundled open-source serif fonts, a simpler home screen, glass borders, and fewer reading controls. Code-file attachments have been removed.
- Fix More-menu stacking and stale model-list responses.

## 1.0.2

Previous public Windows release. Versions 1.0.3–1.0.5 were development iterations consolidated into 1.1.0.
