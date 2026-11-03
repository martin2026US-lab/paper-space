# 翻译质量与文档识别 / Quality and recognition

1.3.0 的「更多 → 翻译质量与术语表」独立于翻译服务和阅读 AI。默认启用本机基础检查；AI 复核只在译文旁点击后调用，可沿用阅读 AI 或填写独立 OpenAI Chat Completions / Anthropic Messages 接口。接口地址、模型 ID 和协议可自配，密钥只在会话中保留，或通过桌面的 Windows 加密存储。更换接口或协议不会将旧密钥填入新地址。

基础检查核对数字、百分比、引用编号、单位、明显原样返回/过短内容和术语译法。它是待核对提示，不是语义正确性认证。否定、遗漏与上下文含义可交给 AI 复核，仍需对照原文。AI 建议不会自动覆盖译文；采用修订后可撤销，上限保留最近十次逐段修订。完整备份包含术语与修订历史，不包含密钥。

## 术语表

支持 UTF-8 CSV、TSV、JSON，最多 10,000 条 / 文件 1.5 MB。CSV 支持引号、逗号与换行。表头如下，`language` 是目标语言；缺省为简体中文。同语言同原词的矛盾译法会拒绝导入，原配置保持不变。

```csv
source,target,language,note
image segmentation,图像分割,zh-CN,项目用语
confidence interval,置信区间,zh-CN,
```

JSON 形式为 `{"version":1,"entries":[{"source":"lesion","target":"病灶","language":"zh-CN"}]}`。相关术语作为数据传给 AI 翻译，不修改源文件；专用翻译协议当前只核对术语，不进行直接字符串替换，也不假装已调用供应商的 glossary API。术语变更只影响命中的段落，新旧缓存分开，旧缓存继续保留。未命中的术语不会全部发送给翻译模型。

优先从[术语在线](https://www.termonline.cn/about)核对中文规范译名；生物医学概念可参照 [NLM MeSH](https://www.nlm.nih.gov/databases/download/mesh.html)，影像概念可参照 [RSNA RadLex](https://www.rsna.org/practice-tools/data-tools-and-standards/radlex-radiology-lexicon)。MeSH/RadLex 原始下载并不是现成的英汉翻译表，需要选择相关概念并确认中文译法，再转换为上述格式。原站许可/获取条件适用于其数据。`docs/glossary-starter.csv` 是独立的项目示例，非官方术语库；不会自动导入或覆盖个人选择。

## 文档识别

「更多 → 文档识别」可设置：

- **本机 Docling**：默认快速模式，识别段落、表格，跳过慢速公式补强和不必要的页面图像生成。精细模式增加公式识别。当前独立本机组件以原生文字为主，扫描 OCR 通过自配服务接入；现有模型目录不搬移，不自动额外下载。
- **自定义 Docling 服务**：填写服务根地址，兼容 Docling Serve v1。测试连接仅查询 `/v1/capabilities`，不发送 PDF；点击开始识别才上传当前完整文件。支持服务端 OCR，可使用本机服务或 HTTPS 远程服务。保存连接、打开文献、重启均不会自动上传到远程服务。
- **阶段、取消和重试**：显示模型载入、识别、结果整理、按页映射等真实阶段与耗时；不伪造百分比。取消中的任务先结束子进程再释放执行位；排队任务保存当时配置，不能在等待期间被悄悄改为远程上传。失败或取消保留现有结构，成功后沿用原有手动校正协调与批注归档机制。

服务使用官方 `POST /v1/convert/file` multipart 参数（`files`, `to_formats=json`, `do_ocr`, `do_formula_enrichment`），可选 `X-Api-Key`。它须返回带页号、坐标和段落的 Docling JSON，不接受仅 Markdown 的结果冒充可定位原文。失败、无段落、页数不符或无效坐标不会覆盖现有文献。已校验本机缓存按识别模式隔离；重新识别会跳过缓存。

参见 [Docling Serve 官方协议](https://github.com/docling-project/docling-serve/blob/main/docs/usage.md)。应用不会为用户部署或选择一个远程文献处理服务。

## 应用接口

以下接口仅在本机服务上使用，POST 需同源 `Origin`。不支持从任意网页跨域调用。

| 接口 | 输入 / 行为 |
|---|---|
| `POST /api/translation/check` | JSON `{text, translation, targetLanguage, glossary}`；只做本机规则检查，返回 `issues`, `terms`，无评分。 |
| `POST /api/translation/review` | 上述字段加 `config:{baseUrl,format,model,apiKey}`、`uiLanguage`；调用所配复核模型，返回待确认 `revisedText` 和 `issues`，不写入文献。 |
| `POST /api/recognition/test` | JSON `{baseUrl,apiKey}`；查询 Docling v1 能力，不发送文献。 |
| `GET /api/pdf/status` | 本机识别环境的 `available`, `busy`。 |
| `POST /api/pdf/parse` | `application/pdf` 文件。可选 URI 编码 JSON 请求头 `X-Paper-Recognition:{provider,baseUrl,mode,ocr,force}`，密钥通过独立 `X-Api-Key` 传入。 |

识别默认仍返回旧版兼容 JSON。请求 `Accept: application/x-ndjson` 时，逐行返回 `{type:"progress",stage,message}`、最终 `{type:"result",result}` 或 `{type:"error",message}`。断开请求会取消对应处理。原文、译文及凭据不写入进度日志。

复核模型输出要求：

```json
{"issues":[{"category":"numbers","detail":"42 被改成 41"}],"revisedText":"完整建议译文"}
```

无效 JSON 或结构会显示错误并保留当前译文。任意兼容接口的结构化输出遵循程度需通过实际模型确认；切换服务不会改变现有阅读/翻译接口。

## 1.3.6 单栏阅读与原图

本机识别结果增加 `normalizedBlocks` 与 `quality.version=reading-quality-v2`，保留原始 `blocks` 和 PDF 字节。派生版本使用独立缓存键，不覆盖旧缓存。字体恢复按嵌入字体 SHA-256、字体名和字符编码匹配，重音和上下标还需通过几何对齐；未知或对齐不确定的单元保持原图。当前字形注册表覆盖已验证的样本，不保证任意出版社或扫描 PDF 的转写准确率。

已打开自动本机识别的旧 Docling 文献，在下次打开时仅添加派生单栏数据；未开启自动识别时可点击阅读辅助中的“生成单栏阅读”。已有手动结构操作、冲突或有效跨页手动连接的文献继续用旧阅读视图。原有批注锚点、会话、译文和模型设置不因派生转换重写；不确定的旧锚点回到保存时的原文。

“解答原图”只在用户点击后发送当前单元的裁图（包括跨页的多个来源区域），不发送整篇 PDF，不自动触发。支持 OpenAI Chat Completions 与 Anthropic Messages 的图片消息格式；实际模型是否支持视觉由用户接入的模型决定。无法辨认的字符仍须核对原文，视觉模型回答不作为自动校正结果。文本翻译接口继续只接收可靠文字；无法转写的候选文字不进入阅读助手材料。

字体沿用内置 Source Serif 4 / Noto Serif SC（CSS `Paper Serif` / `Paper Han Serif`）。经典正文按既有断点为 16–18px，杂志正文为 18px（小屏 17px）；双语原文及译文沿用原有标准。原图中的字号和字体来自 PDF，本身不做重排。

## 1.3.7 识别进度与字符原图

当前派生版本为 `reading-quality-v3`，缓存前缀为 `docling-layout-glyphs-v2:`。已有 v2 在自动本机识别开启时升级派生层，不改写原文、批注和会话。

Python 的进度 JSON 使用 ASCII 转义，子进程显式采用 UTF-8；Node 用 StringDecoder 拼接多字节序列，避免 Windows 默认编码及分块截断造成乱码。

一段只有 1–3 个未知字形、文本与字形位置匹配率至少 98%、未知字符均可对齐且没有其他结构疑点时，`textRuns[].imageBox` 保存该字形的来源区域。正文使用原图字符内嵌，模型材料使用 `[原图符号]` 占位，不发送未经确认的候选转写。其余疑点仍保留整段原图。原图段落按来源字号缩放；`quality.uncertain` 同时记录字符原图和整段原图。

单栏就地解答使用已有安全 Markdown 渲染器；加粗分隔符内空格仅在解答显示时规整，代码不改写，HTML 不执行，图片不自动远程加载。历史译文与已保存回答不被重写。

## 1.3.8 文字原图提取

`readingTranscriptions[unit.id]` 保存用户采用的阅读文字：`version`, `fingerprint`, `sourceKey`, `text`, `updatedAt`。`sourceKey` 包含原来源引用、几何区域与转换前文字，版本不匹配的内容不应用。原始 `blocks`、`readingLayout` 和 PDF 字节不修改；撤销只删除当前单元的转写记录。字段随本机文献及整库备份持久化，不属于外部会话目录。

提取沿用 `/api/chat` 的图片消息与当前阅读模型，最多 8 个来源裁图；只在用户点击“提取文字”或“重新提取”后发送。提示要求原文语言、不解释、不补全、保留上下标和段落，无法辨认处使用 □。提取过程绕过统一回答语言注入，不改变翻译、解答及其他调用的语言规则。结果先显示为可编辑纯文本，用户采用后才进入阅读材料；不执行任何模型返回 HTML。实际提取准确性取决于用户接入的视觉模型，本次仅用 mock 验证流程。

提取仅覆盖文字类原图单元，不用于自动替换插图、表格或公式。保存失败恢复原记录，关闭窗口取消请求，切换文献会丢弃未采用结果。

## 1.4.0 阅读入口

“全文阅读”统一原文和按需段落译文，“全文导读”保持独立。旧备份及界面语言恢复记录中的 `bilingual` 视图会回到全文阅读，原译文缓存不迁移、不清空。重复点击当前阅读标签不重绘，保留阅读位置。
