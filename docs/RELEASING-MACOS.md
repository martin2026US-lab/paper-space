# macOS release

Use an Apple Silicon Mac with Node.js 24 LTS. The app version stays aligned with the Windows release; the first Mac release is 1.4.0. A separate tag such as `v1.4.0-macos.1` can identify the additional platform release without changing the existing Windows tag.

```sh
npm ci
npm test
python3 -m pip install --only-binary=:all: -r tests/requirements.txt
python3 -m unittest discover -s tests -p 'test_*.py'
npx electron tests/macos-desktop.cjs
npx electron tests/v135-electron.cjs
npm run dist:mac
hdiutil verify dist/Paper-Space-1.4.0-macOS-arm64.dmg
codesign --verify --deep --strict dist/mac-arm64/纸间.app
```

`npm ci` is only needed for a fresh checkout or changed dependencies. Python tests need the small PDFium dependency in `tests/requirements.txt`; an existing Docling environment already includes it. Real PDF conversion additionally needs the separately installed Docling runtime. The app does not bundle Python, model weights, personal documents or credentials.

Before publishing, open the app copied from the final DMG with an isolated `PAPER_SPACE_TEST_DATA` directory and a separate `PAPER_SPACE_TEST_PORT`. Verify fresh startup, existing-profile preservation, native menus, full-text/source comparison, opt-in text extraction against a local mock, real offline Docling and native backup saving. Keep test profiles outside the production data directory and do not include them in release archives. Confirm the packaged `python/normalize_layout.py`, `glyph_restore.py` and `glyph_profiles.json` are present.

Publish the DMG, a corresponding source archive and SHA-256 checksums from the same tested commit. The existing `win` and `nsis` build configuration remains available for Windows builds; validate Windows on a Windows runner or machine.

The current Mac build uses ad-hoc signing with no Developer ID certificate or Apple notarization. Explain the first-launch approval in the release notes and link to [installation instructions](INSTALL.md). Do not upload certificates, credentials, `data`, `.test-data`, `node_modules`, local runtimes or models.
