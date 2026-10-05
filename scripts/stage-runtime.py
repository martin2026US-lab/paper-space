"""Stage a clean offline runtime for distribution. Never copy app data."""
import argparse
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('runtime', type=Path, help='Prepared Python/Docling/model runtime directory')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
target = root / 'build' / 'runtime'
if target.exists():
    raise SystemExit('build/runtime already exists; use a new clean staging directory.')
models = ['docling-project--CodeFormulaV2', 'docling-project--docling-layout-heron',
          'docling-project--docling-layout-heron-onnx', 'docling-project--docling-models']
required = ['python/python.exe', 'docling/Lib/site-packages/docling/__init__.py', 'models/ready.json']
for name in required:
    if not (args.runtime / name).is_file():
        raise SystemExit(f'Missing runtime component: {name}')
ignore = shutil.ignore_patterns('__pycache__', '*.pyc', '.cache', '*.log', 'direct_url.json')
shutil.copytree(args.runtime/'python', target/'python', ignore=ignore)
shutil.copytree(args.runtime/'docling/Lib/site-packages', target/'docling/Lib/site-packages', ignore=ignore)
for name in models:
    shutil.copytree(args.runtime/'models'/name, target/'models'/name, ignore=ignore)
shutil.copy2(args.runtime/'models/ready.json',target/'models/ready.json')
shutil.copytree(root/'build/model-licenses', target/'model-licenses')
files = [p for p in target.rglob('*') if p.is_file()]
print(f'Staged {len(files)} runtime files, {sum(p.stat().st_size for p in files):,} bytes.')
