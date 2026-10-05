# Tests

`npm test` runs all `*.test.mjs` suites using Node.js 22 or newer. Requests use local mock servers; no real model credentials are needed. Both Windows and Linux are included in CI.

Browser fixtures are synthetic PDFs/DOCX files. Run a specific `*-browser-server.mjs` with Node, open the localhost URL printed in the console, and inspect the displayed results. Do not run multiple generations at once: some intentionally reuse the same test ports.

The v0.9–v1.0 browser suites also exercise the public Attention example and optional Docling runtime. Before those suites, download the example with `npm run setup:demo`, configure Docling as described in the root README, and generate the fixture:

```powershell
./runtime/venv/Scripts/python.exe python/parse_pdf.py public/demo.pdf tests/sample-layout.json runtime/models
node tests/v100-browser-server.mjs
```

Run in a separate browser profile so test documents do not mix with your reading library. Generated files stay ignored. The CI workflow runs Node tests only; browser regression suites are manual.
