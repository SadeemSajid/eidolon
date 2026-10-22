import importlib.util
from pathlib import Path
import unittest


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parent / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


commits = load("commit_checker", "check-commits.py")
capture = load("capture_inventories", "capture-board-inventories.py")


class CommitConventionTests(unittest.TestCase):
    def test_valid_subjects(self):
        for subject in ["feat: expand boards", "fix(mmap): preserve aliases", "feat(api)!: change schema", "chore: update tools"]:
            commits.check(subject)

    def test_invalid_subjects(self):
        for subject in ["add boards", "feat:add boards", "feat: ", "oops: add boards", "feat: title\nsecond line"]:
            with self.subTest(subject=subject), self.assertRaises(SystemExit):
                commits.check(subject)


class MemoryCaptureTests(unittest.TestCase):
    def test_preserves_full_width_and_owners(self):
        text = '\n'.join([
            'FlatView #2',
            ' AS "dma", root: downstream',
            ' AS "secure-dma", root: downstream',
            ' Root memory region: downstream',
            '  0000000000000000-ffffffffffffffff (prio -1000, container): routing owner:{dev path=/machine/msc}',
        ])
        view = capture.parse_memory(text)[0]
        self.assertEqual(view["names"], ["dma", "secure-dma"])
        self.assertEqual(view["regions"][0]["size"], "0x10000000000000000")
        self.assertEqual(view["regions"][0]["priority"], -1000)
        self.assertEqual(view["regions"][0]["owner"], "/machine/msc")

    def test_rejects_unknown_range_format_instead_of_silently_dropping_it(self):
        with self.assertRaises(RuntimeError):
            capture.parse_memory('FlatView #0\n  00000000-00000fff unexpected format')


class BareMetalGenerationTests(unittest.TestCase):
    def setUp(self):
        import json
        self.generator = load("bare_metal_generator", "generate-bare-metal.py")
        self.recipe = json.loads(self.generator.RECIPE.read_text())

    def test_generation_is_independent_of_output_directory(self):
        import tempfile
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            self.generator.generate(self.recipe, first)
            self.generator.generate(self.recipe, second)
            files = sorted(path.name for path in Path(first).iterdir())
            self.assertEqual(files, [".gitignore", "linker.ld", "main.c", "plan.json", "startup.S"])
            for name in files:
                self.assertEqual((Path(first) / name).read_bytes(), (Path(second) / name).read_bytes())

    def test_rejects_unverified_hardware_before_creating_files(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "project"
            for field, value in [("cpu", "cortex-m3"), ("ramBase", "0x0"), ("exceptionLevel", 2), ("uart", {})]:
                with self.subTest(field=field):
                    recipe = {**self.recipe, field: value}
                    with self.assertRaises(ValueError):
                        self.generator.generate(recipe, output)
                    self.assertFalse(output.exists())

    def test_message_is_escaped_as_data_and_control_characters_are_rejected(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            recipe = {**self.recipe, "message": 'Hello "Eidolon" \\ test'}
            self.generator.generate(recipe, directory)
            source = (Path(directory) / "main.c").read_text()
            self.assertIn(r'Hello \"Eidolon\" \\ test', source)
            with self.assertRaises(ValueError):
                self.generator.generate({**recipe, "message": "hello\nworld"}, directory)


if __name__ == "__main__":
    unittest.main()
