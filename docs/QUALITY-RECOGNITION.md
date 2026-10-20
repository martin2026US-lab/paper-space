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
