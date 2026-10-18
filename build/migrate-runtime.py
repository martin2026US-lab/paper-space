"""Preserve the legacy runtime before the old installer removes application files."""
import json
import os
import shutil
import sys
import uuid
from pathlib import Path


def migrate(installation, data_directory):
    installation = Path(installation).resolve()
    source = installation / "resources" / "runtime"
    data = Path(data_directory).resolve()
    configuration = data / "docling-runtime.json"
    saved = json.loads(configuration.read_text(encoding="utf-8-sig")) if configuration.exists() else {}
    if saved.get("root"):
        previous = Path(saved["root"]).resolve()
        if not previous.is_relative_to(installation) and (previous / "models" / "ready.json").is_file():
            return
    if not (source / "models" / "ready.json").is_file():
        return
    components = installation.parent / "PaperSpace-components"
    destination = components / "docling-legacy"
    components.mkdir(parents=True, exist_ok=True)
    if not (destination / "models" / "ready.json").is_file():
        if destination.exists():
            raise RuntimeError("An incomplete component directory exists; it was preserved.")
        staging = components / ("migration-" + uuid.uuid4().hex)
        shutil.copytree(source, staging, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".cache"))
        if not (staging / "models" / "ready.json").is_file():
            raise RuntimeError("Copied recognition environment is incomplete.")
        # Both recursive move targets must stay inside the explicitly selected component directory.
        if not staging.resolve().is_relative_to(components.resolve()) or not destination.resolve().is_relative_to(components.resolve()):
            raise RuntimeError("Invalid migration target.")
        staging.rename(destination)
    data.mkdir(parents=True, exist_ok=True)
    next_settings = {"version": 1, "root": str(destination), "installRoot": str(components)}
    temporary = configuration.with_name(configuration.name + "." + uuid.uuid4().hex + ".tmp")
    temporary.write_text(json.dumps(next_settings), encoding="utf-8")
    os.replace(temporary, configuration)


if __name__ == "__main__":
    migrate(*sys.argv[1:3])
