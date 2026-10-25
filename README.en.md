<p align="center"><img src="desktop/icon.png" width="88" alt="Paper Space"></p>

# Paper Space · 纸间

English · [简体中文](README.md)

**Let questions grow from the text.**

A local-first reading workspace for papers and documents. Read PDFs in their original layout, translate sentences or entire paragraphs, add notes, and discuss selected evidence using your own model endpoint.

**[Download for Windows](https://github.com/martin2026US-lab/paper-space/releases/latest)** · [Changelog](docs/CHANGELOG.md) · [MIT license](LICENSE)

▶ **[Watch the new 60-second film](https://martin2026US-lab.github.io/paper-space/)** · [Download MP4](https://github.com/martin2026US-lab/paper-space/releases/download/v1.3.2/paper-space-v1.3.2-promo-60s-fixed.mp4)

The film uses stationary interface shots, a soft original score and illustrative demo data. AI results depend on the configured model.

## New in 1.3.5

Clicking a chapter briefly slides it to the dial pointer before opening it. Intermediate chapters are not opened. A second click retargets the slide, Escape cancels it, and reduced-motion preferences bypass the animation. Wheel/drag behavior, palettes and existing data remain intact.

## New in 1.3.4

Chapter numbers occupy a separate lane, away from ticks and the pointer. Wheel and drag input now move continuously with display frames; cached ticks, bounded visible rows and a fixed heading prevent redraw and layout churn. The dial matches the Classic warm-paper or Magazine warm-white palette, settles after input and respects reduced-motion preferences.

## New in 1.3.3

Both styles share separate Library / Contents views. Contents is now an arc-shaped chapter dial inspired by lens markings; the previous hover wheel is removed. Scroll, drag or use arrow keys to choose, then click or press Enter to read. Full titles, hierarchy, page references, search and chapter notes remain available. The sidebar choice is saved locally; navigation makes no model calls.

## New in 1.3.2

PDF reading tools share consistent buttons, including cross-page paragraphs, re-recognition and settings. Magazine interactions now use larger bundled serif typography across navigation, toolbars, the assistant and dialogs. Narrow toolbars wrap while source documents and saved settings remain intact.

## New in 1.3.1

Classic controls, chapter navigation and settings use bundled open-source serif fonts at approximately 14–16px. More menu commands share consistent borderless rows; laptop layouts wrap the toolbar and scroll the menu within the available height. Magazine styling, original PDF rendering, existing documents, notes and model settings are preserved.

## New in 1.3.0

- Local translation checks flag numbers, citations, units and glossary mismatches without a quality score.
- Optional AI review uses the reading model or an independent OpenAI/Anthropic endpoint. Proposed changes require acceptance and can be undone; original text and previous translations are preserved.
- CSV/TSV/JSON glossaries match the target language. Relevant terms guide AI translation and isolate caches; dedicated translation APIs are checked without forced text replacement.
- Background recognition adds Fast/Detailed modes, real stages and elapsed time, queue/cancel/retry controls, and a custom Docling Serve v1 connection with optional service OCR. Remote recognition always requires an explicit start.
- Backups carry glossaries, safe endpoint metadata and revision history, excluding keys and model weights.

[Quality and recognition API details](docs/QUALITY-RECOGNITION.md)

## 1.2.2 Reading size and palette fixes

Magazine mode uses warm paper, graphite text and restrained olive selection accents across PDF, Word, the assistant and settings. PDFs fit the available reading width by default, with whole-page and percentage zoom options and aligned selectable text. Stable Library / Contents buttons switch the sidebar, and PDF recognition tools sit inside a compact disclosure. Classic mode and existing documents, annotations and model settings remain available.

## Magazine reading in 1.2.1

Use the top-right **Classic / Magazine** switch. Existing installations keep Classic by default. Magazine uses bundled serif fonts, with a narrow chapter index and a single reading column. On small laptops, opening the assistant collapses the index into a utility rail; library and contents remain available on demand. Page controls and notes sit in the footer, while bilingual translation controls stay above the text.

Styles share the same documents, originals, annotations, conversations and model settings, with separate layout preferences. Switching keeps the current page, reading position and question draft and sends no content.

## New in 1.2.0

- **Bilingual reading:** originals above translations, with per-paragraph or current-page translation, collapsible results, cancellation, and shared caches. Opening the view sends no document text.
- **Full backup and restore:** export a compressed .paperbackup archive containing your library (including trash), source bytes, notes, complete conversations, citations, translations, and endpoint metadata. Verify before restoring. Duplicate documents become copies; existing data and model selections are kept. API keys and model weights are excluded.
- **Smaller installs and updates:** Python, Docling, and recognition models are optional components stored outside the app. Open **More → Document recognition** to download from official sources or configure an existing environment. Updates retain these components.

## English UI

Choose **English** on the first-use notice, or open **More → Language & translation → Interface language**. The choice is saved on this device. Switching languages keeps the current page, scroll position, and unsent question.

Interface language, translation target, and the language for explanations and answers are separate settings. Existing document text, notes, conversations, and custom names are preserved. Session-only API keys must be entered again after an interface reload; the desktop app can remember keys using Windows encryption.

## Reading and translation

- Import PDF, DOCX, TXT, or Markdown. PDF layout recognition runs locally in the background.
- Click a sentence to translate it, or use **Tr** beside a paragraph to translate the complete paragraph. Joined paragraphs across pages keep their full source.
- Use paragraph explanations, reading guides, evidence-linked chat, personal notes, chapter navigation, quick find, and focus mode.
- Review or exclude sources before sending a question. Open citations to check the original text.
- Export notes as Markdown. Documents and conversations stay on this device.

Translation can use a **local model**, the current **reading AI**, a **custom AI endpoint**, or a **custom translation API**. Local models share a service address: select an installed model from the list, or enter its ID manually, then save. Opening or refreshing this list does not generate text.

Translation API protocols include LibreTranslate, DeepL, and Translator v3 compatible formats. Supply your own endpoint and credentials; supported target languages are detected and mapped. Reading AI remains configured separately in the bottom-left model menu. No conversational model or API key is included.

## Windows installation

Download `Paper-Space-1.3.5-Windows-x64-Setup.exe` and `SHA256SUMS-1.3.5.txt` from the release. The lightweight installer includes the reader and Electron. It supports Windows 10/11 x64 and needs no system Node.js or Python. Optional Docling setup downloads an isolated Python environment, CPU dependencies, and official layout models; allow at least 6 GB of free space for that component. Choose a folder on your preferred drive. Recognition runs offline after setup. Existing bundled runtimes are preserved outside the app during upgrades.

Verify the download in PowerShell:

```powershell
Get-FileHash .\Paper-Space-1.3.5-Windows-x64-Setup.exe -Algorithm SHA256
```

Compare the result with `SHA256SUMS-1.3.5.txt`. The installer is currently unsigned. Updates and uninstalling preserve personal data in `%APPDATA%\PaperSpace`; app files and personal data are stored separately. Close the running app before upgrading.

## Run from source

Requires Node.js 22+. The browser frontend libraries are included in the repository.

```sh
git clone https://github.com/martin2026US-lab/paper-space.git
cd paper-space
npm start
```

Open `http://127.0.0.1:4317`. For the Electron desktop app, run `npm ci` and `npm run desktop`. To download the optional public sample paper, run `npm run setup:demo`. The desktop app offers one-click optional Docling setup under **More → Document recognition**. Source installations can follow the optional Python/Docling [setup guide](README.md).

```sh
npm test
# Optional real-browser internationalization checks, after npm ci:
npx electron tests/ui-language-electron.cjs
```

Tests use synthetic documents and local mock endpoints. See [tests/README.md](tests/README.md) for additional browser suites.

## Data and limitations

Importing and layout recognition run locally. Translation, explanations, guides, and chat send the relevant content to the endpoint you configure when you request them; guides use the full text. Model discovery and connection tests also contact that endpoint. Provider terms govern its handling of transmitted data. Use documents and APIs in accordance with applicable laws, permissions, and confidentiality requirements. AI output needs source verification.

DOCX uses a reading layout rather than Word's original pagination. Default local recognition does not include scanned-page OCR; an OCR-enabled recognition service can be configured separately. Cloud sync and image questions are not provided. Full backup and restore are available. Local text retrieval uses keywords. Reading fonts are included locally; PDF fonts keep their original appearance.

Original code is MIT licensed. Libraries, fonts, layout models, and example-paper excerpts retain their own licenses. See [third-party notices](THIRD_PARTY_NOTICES.md).
