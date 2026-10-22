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


if __name__ == "__main__":
    unittest.main()
