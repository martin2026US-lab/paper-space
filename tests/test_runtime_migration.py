import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("migration", Path(__file__).resolve().parents[1] / "build" / "migrate-runtime.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MigrationTests(unittest.TestCase):
    def test_legacy_environment_is_preserved_and_configuration_stays_separate(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            app = root / "application"
            runtime = app / "resources" / "runtime"
            (runtime / "models").mkdir(parents=True)
            (runtime / "python").mkdir()
            (runtime / "models" / "ready.json").write_text('{"version":"old"}')
            (runtime / "python" / "python.exe").write_bytes(b"synthetic interpreter")
            (runtime / "models" / "weights.bin").write_bytes(b"unchanged weights")
            data = root / "profile"
            data.mkdir()
            (data / "credentials.enc.json").write_bytes(b"encrypted placeholder")
            module.migrate(app, data)
            saved = json.loads((data / "docling-runtime.json").read_text())
            target = Path(saved["root"])
            self.assertFalse(target.is_relative_to(app))
            self.assertEqual((target / "models" / "weights.bin").read_bytes(), b"unchanged weights")
            self.assertTrue((runtime / "python" / "python.exe").exists())
            self.assertEqual((data / "credentials.enc.json").read_bytes(), b"encrypted placeholder")
            module.migrate(app, data)  # Idempotent on subsequent updates.

    def test_existing_external_configuration_is_not_replaced(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            external = root / "custom"
            (external / "models").mkdir(parents=True)
            (external / "models" / "ready.json").write_text("{}")
            data = root / "profile"
            data.mkdir()
            content = json.dumps({"root": str(external), "installRoot": str(root)})
            (data / "docling-runtime.json").write_text(content)
            module.migrate(root / "app", data)
            self.assertEqual((data / "docling-runtime.json").read_text(), content)

    def test_incomplete_existing_destination_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            app = root / "app"
            (app / "resources/runtime/models").mkdir(parents=True)
            (app / "resources/runtime/models/ready.json").write_text("{}")
            target = root / "PaperSpace-components/docling-legacy"
            target.mkdir(parents=True)
            (target / "keep.txt").write_text("preserve me")
            with self.assertRaises(RuntimeError):
                module.migrate(app, root / "data")
            self.assertEqual((target / "keep.txt").read_text(), "preserve me")


if __name__ == "__main__":
    unittest.main()
