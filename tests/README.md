# Tests

`npm test` runs all `*.test.mjs` suites using Node.js 22 or newer. Requests use local mock servers; no real model credentials are needed. Both Windows and Linux are included in CI.

Browser fixtures are synthetic PDFs/DOCX files. Run a specific `*-browser-server.mjs` with Node, open the localhost URL printed in the console, and inspect the displayed results. Do not run multiple generations at once: some intentionally reuse the same test ports.

The v0.9–v1.0 browser suites also exercise the public Attention example and optional Docling runtime. Before those suites, download the example with `npm run setup:demo`, configure Docling as described in the root README, and generate the fixture:

```powershell
./runtime/venv/Scripts/python.exe python/parse_pdf.py public/demo.pdf tests/sample-layout.json runtime/models
node tests/v100-browser-server.mjs
```

Run in a separate browser profile so test documents do not mix with your reading library. Generated files stay ignored. The CI workflow runs Node tests only; browser regression suites are manual.

## English UI checks

After `npm ci`, run `npx electron tests/ui-language-electron.cjs` for the real-browser language suite. It starts its own loopback-only mock model service and checks consent, language persistence, source preservation, translation targets, model selection, reading position, drafts, and narrow layouts.

On Windows, `npx electron tests/ui-language-desktop.cjs` also checks native Electron menus, language IPC, and localized key errors. Prepare the optional offline runtime first. Both suites use isolated profiles under `.test-data/`; neither opens the normal reading library.

## 1.2 regression checks

`npx electron tests/v120-electron.cjs` exercises bilingual requests, cancellation, cache sharing, backup downloads, conflict copies, corruption rejection, and atomic restore failures using synthetic data. `python tests/test_runtime_migration.py` checks migration without touching a real profile.

On Windows, `npx electron tests/v120-desktop.cjs` checks native backup files and component management. Set `PAPER_SPACE_COMPONENT_TEST_ROOT` to a prepared, external Docling environment to also exercise activation. Node unit tests require no runtime or external downloads.

## Magazine reading checks

`npx electron tests/magazine-electron.cjs` uses a fresh isolated profile and synthetic documents to verify both styles, independent layout preferences, bundled fonts, paragraph explanations, translation cancellation, library/notes access, preserved source data and drafts, English controls, narrow layouts, and original PDF rendering. Screenshots and results stay under `.test-data/`; no personal reading library is opened.
