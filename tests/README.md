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

## PDF sizing and magazine palette

`npx electron tests/v122-electron.cjs` checks actual available-width PDF scaling, 96-dpi percentage zoom, selectable text/source preservation, assistant resizing, stable sidebar toggles, shared neutral surfaces, English labels, Classic isolation and laptop/mobile bounds using synthetic PDF/Word fixtures. `--baseline` optionally captures the previous local installation before upgrading.

## Translation quality and recognition

`npx electron tests/v130-electron.cjs` uses only isolated synthetic files and loopback mock endpoints to check glossary/cache binding, reviewer separation, accept/undo/cancel, manual-only remote recognition, progress/cancel/retry, byte preservation, English labels and narrow dialogs. `tests/quality-recognition.test.mjs` covers core parsing, routes, source isolation and full backup round-trips. Tests do not open a personal library or call cloud services.

## Classic typography and menu checks

`npx electron tests/classic-ui-electron.cjs` checks bundled serif fonts, enlarged Classic controls, identical More menu row styles, reachable commands at laptop/mobile heights, English labels, and Magazine isolation using an isolated synthetic profile. `--baseline` optionally captures the previous local installation. The native `tests/magazine-desktop.cjs` suite also checks Classic toolbar bounds and font sizes at laptop resolutions.

## 1.3.2 PDF controls and Magazine typography

`npx electron tests/v132-electron.cjs` verifies complete button borders/backgrounds, consistent control sizing, cross-page and recognition-settings actions, larger Magazine serif controls, responsive tools, PDF zoom/text alignment, English labels and unchanged source bytes. Synthetic files and isolated profiles are used; `--baseline` captures the installed previous version.

## Arc chapter navigation

Run npx electron tests/v133-electron.cjs to check separate sidebar views in both styles, wheel/keyboard preview and commit, real pointer dragging, nested headings and notes, persisted sidebar choice, laptop layouts, English labels and document/settings preservation with no inference calls. Historical v0.9.5–v1.0 browser fixtures include the retired chapter-wheel UI; current chapter behavior is covered here.

## Continuous dial and label separation

Run npx electron tests/v134-electron.cjs for a 32-chapter input trace, SVG tick reuse, stable heading dimensions, number/pointer collision checks at laptop sizes, matching Magazine colors and no idle drift. The optional --baseline flag loads the currently installed prior version. Frame interval measurements apply to the isolated test environment, not every device.

## Chapter click transitions

Run npx electron tests/v135-electron.cjs to verify intermediate click frames before one final chapter navigation, rapid click retargeting, Escape cancellation, stable chapter identities after reader re-renders, reduced-motion behavior and source/configuration preservation.
