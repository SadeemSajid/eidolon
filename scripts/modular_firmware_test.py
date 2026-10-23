"""Domain/component regressions; opt-in firmware smoke boots use real tools."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import queue
import subprocess
import tempfile
import threading
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("modular_generator", ROOT / "scripts/generate-bare-metal.py")
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def default_description():
    return json.loads((ROOT / "platforms/arm-virt-a55.json").read_text())


def alternate_description():
    value = default_description()
    value["id"] = "alternate-a53-target"
    value["cpu"]["model"] = "cortex-a53"
    value["backend"]["gicVersion"] = 2
    value["memory"][0]["size"] = "0x10000000"
    value["firmware"].update(entryOffset="0x00400000", stackSize="0x8000", baud=57600, message="Alternate platform from a description")
    return value


class ModularFirmwareTests(unittest.TestCase):
    def test_legacy_recipe_still_generates_the_exact_original_bytes(self):
        expected = json.loads((ROOT / "recipes/regressions/arm-virt-a55-hello-v1.sha256.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            generator.generate(json.loads(generator.RECIPE.read_text()), directory)
            actual = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in Path(directory).iterdir()}
            self.assertEqual(actual, expected)

    def test_components_stay_reusable_while_config_build_and_launch_change_together(self):
        with tempfile.TemporaryDirectory() as directory:
            first, second = Path(directory) / "first", Path(directory) / "second"
            a = generator.generate_platform(default_description(), first)
            b = generator.generate_platform(alternate_description(), second)
            for name in ["startup.S", "platform.c", "platform.h", "console.h", "pl011.c"]:
                self.assertEqual((first / name).read_bytes(), (second / name).read_bytes(), name)
            main = (first / "main.c").read_text()
            self.assertIn("console_write", main)
            self.assertNotIn("0x09000000", main)
            self.assertNotIn("volatile", main)
            self.assertIn("-mcpu=cortex-a53", b["compileCommands"][0])
            self.assertEqual(b["qemuArgs"][b["qemuArgs"].index("-cpu") + 1], "cortex-a53")
            self.assertEqual(b["qemuArgs"][b["qemuArgs"].index("-m") + 1], "256M")
            self.assertIn("gic-version=2", b["qemuArgs"][1])
            self.assertIn("ORIGIN = 0x40400000", (second / "linker.ld").read_text())
            self.assertIn("#define EIDOLON_UART_BAUD 57600", (second / "platform_config.h").read_text())
            self.assertIn("#define EIDOLON_UART_IBRD 26", (second / "platform_config.h").read_text())
            self.assertEqual(a["components"], b["components"])
            self.assertEqual(set(a["sourcesSha256"]), {"startup.S", "platform.c", "platform.h", "pl011.c", "console.h", "platform_config.h", "main.c", "linker.ld"})

    def test_rejects_incompatible_topology_bindings_and_boot_configuration_before_writing(self):
        mutations = [
            lambda d: d.update(schemaVersion=2),
            lambda d: d.update(command="sh"),
            lambda d: d["backend"].update(kind="custom-soc"),
            lambda d: d["backend"].update(qemuVersion=[11, 0, 0]),
            lambda d: d["backend"].update(gicVersion=True),
            lambda d: d["cpu"].update(model="cortex-m33"),
            lambda d: d["cpu"].update(cores=2),
            lambda d: d["memory"][0].update(base="0x0"),
            lambda d: d["memory"][0].update(size="0x100000001"),
            lambda d: d["memory"].append(copy.deepcopy(d["memory"][0])),
            lambda d: d["devices"][0].update(kind="ns16550"),
            lambda d: d["devices"][0].update(base="0x10000000"),
            lambda d: d["devices"][0].update(spi=7),
            lambda d: d["devices"][0].update(clockHz=48000000),
            lambda d: d["firmware"].update(console="missing"),
            lambda d: d["firmware"].update(bootMemory="rom"),
            lambda d: d["firmware"].update(exceptionLevel=2),
            lambda d: d["firmware"].update(entryOffset="0x1000"),
            lambda d: d["firmware"].update(entryOffset="0x8000000"),
            lambda d: d["firmware"].update(stackSize="0x10001"),
            lambda d: d["firmware"].update(baud=0),
            lambda d: d["firmware"].update(baud=999999999),
            lambda d: d["firmware"].update(message="hello\nworld"),
            lambda d: d["firmware"].update(application="../../host-script"),
        ]
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "invalid"
            for index, mutate in enumerate(mutations):
                description = default_description()
                mutate(description)
                with self.subTest(index=index), self.assertRaises(ValueError):
                    generator.generate_platform(description, output)
                self.assertFalse(output.exists())

    def test_generation_is_deterministic_and_embedded_assets_match_cli_generation(self):
        with tempfile.TemporaryDirectory() as directory:
            first, second = Path(directory) / "first", Path(directory) / "second"
            generator.generate_platform(default_description(), first)
            generator.generate_platform(default_description(), second, generator.component_assets())
            self.assertEqual(sorted(p.name for p in first.iterdir()), sorted(p.name for p in second.iterdir()))
            for file in first.iterdir():
                self.assertEqual(file.read_bytes(), (second / file.name).read_bytes())


@unittest.skipUnless(os.environ.get("EIDOLON_FIRMWARE_SMOKE") == "1", "opt in with EIDOLON_FIRMWARE_SMOKE=1; requires pinned QEMU, Clang and LLD")
class FirmwareBootRegressionTests(unittest.TestCase):
    def boot(self, legacy=False, alternate=False):
        with tempfile.TemporaryDirectory(prefix="eidolon-firmware-smoke-") as directory:
            output = Path(directory)
            if legacy:
                plan = generator.generate(json.loads(generator.RECIPE.read_text()), output)
            else:
                plan = generator.generate_platform(alternate_description() if alternate else default_description(), output)
            clang, lld = os.environ.get("EIDOLON_CLANG", "clang"), os.environ.get("EIDOLON_LLD", "ld.lld")
            for args in plan["compileCommands"]:
                subprocess.run([clang, *args], cwd=output, check=True, capture_output=True, timeout=30)
            subprocess.run([lld, *plan["linkArgs"]], cwd=output, check=True, capture_output=True, timeout=30)
            qemu = os.environ.get("EIDOLON_QEMU", str(ROOT / "build/qemu/qemu-system-aarch64"))
            process = subprocess.Popen([qemu, *plan["qemuArgs"]], cwd=output, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            messages = queue.Queue()
            def read():
                for line in process.stdout:
                    messages.put(json.loads(line))
            reader = threading.Thread(target=read, daemon=True)
            reader.start()
            try:
                greeting = messages.get(timeout=5)
                self.assertEqual(greeting["QMP"]["version"]["qemu"], {"major": 11, "minor": 1, "micro": 2})
                for command in ["qmp_capabilities", "cont"]:
                    process.stdin.write(json.dumps({"execute": command}) + "\n")
                    process.stdin.flush()
                    while True:
                        message = messages.get(timeout=5)
                        self.assertNotIn("error", message)
                        if "return" in message:
                            break
                deadline = time.monotonic() + 10
                while time.monotonic() < deadline:
                    serial = output / "serial.log"
                    if serial.exists() and plan["expectedSerial"] in serial.read_bytes().decode("utf-8"):
                        break
                    self.assertIsNone(process.poll(), "QEMU exited early")
                    time.sleep(0.02)
                else:
                    self.fail("Expected UART greeting/EL1 did not arrive")
                process.stdin.write(json.dumps({"execute": "quit"}) + "\n")
                process.stdin.flush()
                self.assertEqual(process.wait(timeout=5), 0)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
                reader.join(timeout=1)
                for stream in [process.stdin, process.stdout, process.stderr]:
                    stream.close()

    def test_original_recipe_boots(self):
        self.boot(legacy=True)

    def test_modular_default_boots(self):
        self.boot()

    def test_alternate_description_boots(self):
        self.boot(alternate=True)


if __name__ == "__main__":
    unittest.main()
