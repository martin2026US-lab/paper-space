<p align="center"><img src="desktop/icon.png" width="88" alt="Paper Space"></p>

# Paper Space · 纸间

English · [简体中文](README.md)

**Let questions grow from the text.**

A local-first reading workspace for papers and documents. Read PDFs in their original layout, translate sentences or entire paragraphs, add notes, and discuss selected evidence using your own model endpoint.

**[Download for Windows](https://github.com/martin2026US-lab/paper-space/releases/latest)** · [Changelog](docs/CHANGELOG.md) · [MIT license](LICENSE)

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

Download `Paper-Space-1.2.0-Windows-x64-Setup.exe` and `SHA256SUMS.txt` from the release. The lightweight installer includes the reader and Electron. It supports Windows 10/11 x64 and needs no system Node.js or Python. Optional Docling setup downloads an isolated Python environment, CPU dependencies, and official layout models; allow at least 6 GB of free space for that component. Choose a folder on your preferred drive. Recognition runs offline after setup. Existing bundled runtimes are preserved outside the app during upgrades.

Verify the download in PowerShell:

```powershell
Get-FileHash .\Paper-Space-1.1.0-Windows-x64-Setup.exe -Algorithm SHA256
```

Compare the result with `SHA256SUMS.txt`. The installer is currently unsigned. Updates and uninstalling preserve personal data in `%APPDATA%\PaperSpace`; app files and personal data are stored separately. Close the running app before upgrading.

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

DOCX uses a reading layout rather than Word's original pagination. Scanned-page OCR, cloud sync, and a complete restorable backup are not provided. Local text retrieval uses keywords. Reading fonts are included locally; PDF fonts keep their original appearance.

Original code is MIT licensed. Libraries, fonts, layout models, and example-paper excerpts retain their own licenses. See [third-party notices](THIRD_PARTY_NOTICES.md).
