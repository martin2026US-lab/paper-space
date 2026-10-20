"""Local, offline PDF layout extraction. No URLs, APIs or user configuration."""
import json
import logging
import os
import sys
from pathlib import Path

logging.disable(logging.CRITICAL)

def convert(source, output, models, mode="fast"):
    def progress(stage, message):
        print(json.dumps({"type": "progress", "stage": stage, "message": message}, ensure_ascii=False), flush=True)
    progress("loading", "正在载入本机识别模型")
    import torch
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, AcceleratorOptions, AcceleratorDevice
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.vlm_engine_options import TransformersVlmEngineOptions, VlmEngineType

    options = PdfPipelineOptions(artifacts_path=Path(models))
    options.enable_remote_services = False
    options.do_ocr = False  # Native text first; do not invent OCR text for formulas.
    options.do_table_structure = True
    options.do_formula_enrichment = mode == "accurate"
    # BF16 emulation is extremely slow on CPUs without native BF16 instructions.
    options.code_formula_options.engine_options = TransformersVlmEngineOptions(device=AcceleratorDevice.CPU,torch_dtype="float32",load_in_8bit=False,compile_model=False)
    options.code_formula_options.model_spec.engine_overrides[VlmEngineType.TRANSFORMERS].extra_config["torch_dtype"] = "float32"
    options.generate_page_images = False
    options.images_scale = 1.5
    options.accelerator_options = AcceleratorOptions(num_threads=4, device=AcceleratorDevice.CPU)
    converter = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)})
    progress("converting", "正在识别段落与表格" if mode == "fast" else "正在精细识别段落、表格与公式")
    result = converter.convert(Path(source), max_num_pages=500, max_file_size=50_000_000)
    progress("exporting", "正在整理识别结果")
    doc = result.document
    blocks = []
    for item, _ in doc.iterate_items():
        label = item.label.value
        if not item.prov:
            continue
        text = getattr(item, "text", "")
        if label == "table":
            text = item.export_to_markdown(doc=doc)
        if label == "picture":
            continue
        if not text.strip():
            continue
        boxes = []
        for prov in item.prov:
            size = doc.pages[prov.page_no].size
            bbox = prov.bbox.to_top_left_origin(size.height)
            boxes.append({"page": prov.page_no, "x": bbox.l, "y": bbox.t, "right": bbox.r, "bottom": bbox.b, "pageWidth": size.width, "pageHeight": size.height})
        blocks.append({"sourceRef": item.self_ref, "kind": label, "text": text, "boxes": boxes})
    payload = {"parser": "docling", "layoutVersion": 1, "pages": len(doc.pages), "blocks": blocks}
    temporary = Path(str(output) + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    temporary.replace(output)

if __name__ == "__main__":
    # Bound resource use and prohibit remote service backends in code as well as options.
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    convert(*sys.argv[1:5])
