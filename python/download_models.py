"""Explicit one-time model download; document parsing itself stays offline."""
from pathlib import Path
from docling.utils.model_downloader import download_models
import json

models = Path(__file__).resolve().parents[1] / "runtime" / "models"
download_models(output_dir=models, with_layout=True, with_tableformer=True,
                with_code_formula=True, with_picture_classifier=False,
                with_rapidocr=False, with_easyocr=False)
(models / "ready.json").write_text(json.dumps({"docling": "2.132.0"}), encoding="utf-8")
print("Models ready:", models)
