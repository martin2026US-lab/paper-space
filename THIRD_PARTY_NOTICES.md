# Third-party notices

The MIT license at the repository root applies to original Paper Space code. It does not replace third-party licenses or grant rights to papers displayed by the app.

| Component | Version | License / included notice |
| --- | --- | --- |
| PDF.js | 6.3.289 | Apache-2.0; `public/vendor/pdfjs/LICENSE` |
| Mammoth | 1.13.0 | BSD-2-Clause; `public/vendor/MAMMOTH-LICENSE` |
| Marked | 18.0.14 | MIT; `public/vendor/MARKED-LICENSE` |
| Electron | 44.5.1 | MIT; installed through npm, not bundled here |
| Docling (optional) | 2.132.0 | MIT; installed separately |

PDF.js font and WASM notices are retained in `public/vendor/pdfjs/standard_fonts/` and `public/vendor/pdfjs/wasm/`. Model weights and Python dependencies have separate licenses; review their model cards and package notices before redistribution. No model weights or runtime binaries are tracked in Git. The Windows installer includes offline runtime components with package notices and model licenses; see build/model-licenses.

## Example paper and promotional media

Vaswani et al., *Attention Is All You Need* (2017), [arXiv:1706.03762](https://arxiv.org/abs/1706.03762). The example PDF is downloaded separately at the user's request. It is not relicensed under MIT. Screenshots/video demonstrate reading this publicly available paper; paper excerpts retain their original attribution and rights. Do not treat promotional media as a license to redistribute the full paper.

Test PDFs and DOCX files under `tests/` contain synthetic fixtures, not personal manuscripts.
