#!/usr/bin/env python3
"""Capture realized memory views, device objects and connected QOM signal links.

Launches paused, headless, diskless guests with networking disabled. Requires
binaries built from the exact pinned source commit, never a system fallback.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import signal
import subprocess

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "4fc49f46dc95d4a27de2509e7fceb2931e91faeb"
PRESETS = [
    ("arm-virt-a55", "aarch64", ["-M", "virt-11.1,gic-version=2,secure=off,virtualization=off,highmem=off,msi=off", "-cpu", "cortex-a55", "-smp", "1", "-m", "128M"]),
    *[(name, "arm", ["-M", name]) for name in ["mps2-an385", "mps2-an386", "mps2-an500", "mps2-an505", "mps3-an547"]],
    ("riscv-virt", "riscv64", ["-M", "virt,aia=none,aclint=off", "-cpu", "rv64", "-smp", "1", "-m", "128M"]),
    ("xlnx-zcu102", "aarch64", ["-M", "xlnx-zcu102,secure=off,virtualization=off", "-smp", "6", "-m", "1G"]),
    *[(name, "aarch64", ["-M", name, "-m", "1G"]) for name in ["amd-versal-virt", "amd-versal2-virt"]],
    *[(name, "aarch64", ["-M", name, "-smp", "4", "-m", "1G"]) for name in ["imx8mp-evk", "imx8mm-evk"]],
    ("microchip-icicle-kit", "riscv64", ["-M", "microchip-icicle-kit", "-smp", "5", "-m", "1537M", "-bios", "none"]),
    ("raspi4b", "aarch64", ["-M", "raspi4b"]),
]


def parse_memory(text):
    views = []
    view = None
    for line in text.splitlines():
        match = re.match(r"FlatView #(\d+)", line)
        if match:
            view = {"id": f"view-{match[1]}", "names": [], "root": "", "regions": []}
            views.append(view)
        elif view is not None:
            match = re.match(r' AS "([^"]*)", root: (.*)', line)
            if match:
                view["names"].append(match[1])
                view["root"] = match[2]
            match = re.match(r"  ([0-9a-f]+)-([0-9a-f]+) \(prio (-?\d+), ([^)]+)\): (.*?) (?:owner|parent):\{(?:dev|obj) path=(.*?)\}$", line)
            if match:
                start, end, priority, kind, name, owner = match.groups()
                view["regions"].append({"base": f"0x{int(start, 16):x}", "size": f"0x{int(end, 16) - int(start, 16) + 1:x}", "name": name, "kind": kind, "priority": int(priority), "owner": owner})
            elif re.match(r"  [0-9a-f]+-[0-9a-f]+", line):
                raise RuntimeError(f"Unparsed memory range: {line}")
    if not views:
        raise RuntimeError("No flat memory views returned")
    # QEMU enumerates FlatViews in pointer/hash order, which changes per process.
    # Stable content IDs keep regeneration diffs limited to actual map changes.
    for view in views:
        view["names"].sort()
        identity = {key: value for key, value in view.items() if key != "id"}
        view["id"] = "view-" + hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()[:12]
    return sorted(views, key=lambda view: (view["names"], view["root"], view["id"]))


class QMP:
    def __init__(self, executable, arguments):
        self.process = subprocess.Popen([str(executable), *arguments], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
        try:
            greeting = self.process.stdout.readline()
            if not greeting:
                raise RuntimeError(self.process.stderr.read())
            self.version = json.loads(greeting)["QMP"]["version"]
            self.call("qmp_capabilities")
        except BaseException:
            if self.process.poll() is None:
                self.process.kill()
            self.process.wait()
            raise

    def call(self, command, arguments=None):
        self.process.stdin.write(json.dumps({"execute": command, "arguments": arguments or {}}) + "\n")
        self.process.stdin.flush()
        while True:
            line = self.process.stdout.readline()
            if not line:
                raise RuntimeError(self.process.stderr.read())
            result = json.loads(line)
            if "return" in result:
                return result["return"]
            if "error" in result:
                raise RuntimeError(f"{command}: {result['error']}")

    def close(self):
        try:
            if self.process.poll() is None:
                self.process.stdin.write(json.dumps({"execute": "quit"}) + "\n")
                self.process.stdin.flush()
                self.process.wait(timeout=5)
        finally:
            if self.process.poll() is None:
                self.process.kill()
                self.process.wait()


def capture(executable, arguments):
    qmp = QMP(executable, arguments)
    try:
        types = {t["name"]: t.get("parent") for t in qmp.call("qom-list-types", {"abstract": True})}
        def inherits(kind, base):
            while kind:
                if kind == base:
                    return True
                kind = types.get(kind)
            return False
        devices = []
        queue = [("/machine", None)]
        while queue:
            path, kind = queue.pop()
            properties = qmp.call("qom-list", {"path": path})
            if kind and inherits(kind, "device"):
                signals = []
                for prop in properties:
                    if prop["type"] == "link<irq>":
                        target = qmp.call("qom-get", {"path": path, "property": prop["name"]})
                        if target:
                            signals.append({"output": prop["name"], "target": target})
                parent_bus = next((p for p in properties if p["name"] == "parent_bus"), None)
                bus = qmp.call("qom-get", {"path": path, "property": "parent_bus"}) if parent_bus else None
                realized = qmp.call("qom-get", {"path": path, "property": "realized"})
                devices.append({"path": path, "type": kind, "cpu": inherits(kind, "cpu"), "realized": realized, "parentBus": bus, "signals": sorted(signals, key=lambda s: s["output"])})
            for prop in sorted(properties, key=lambda p: p["name"], reverse=True):
                match = re.fullmatch(r"child<(.+)>", prop["type"])
                if match and match[1] not in ("irq", "memory-region", "memory-region-iommu", "clock"):
                    queue.append((path + "/" + prop["name"], match[1]))
        if not devices:
            raise RuntimeError("No device objects captured")
        text = qmp.call("human-monitor-command", {"command-line": "info mtree -f -o"})
        return {"version": qmp.version, "devices": sorted(devices, key=lambda d: d["path"]), "spaces": parse_memory(text)}
    finally:
        qmp.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--build-dir", type=Path, default=ROOT / "build/qemu")
    parser.add_argument("--board")
    args = parser.parse_args()
    def timeout_handler(signum, frame):
        raise TimeoutError("QEMU inventory capture timed out")
    signal.signal(signal.SIGALRM, timeout_handler)
    actual = subprocess.check_output(["git", "-C", str(ROOT / "third_party/qemu"), "rev-parse", "HEAD"], text=True).strip()
    if actual != COMMIT:
        raise SystemExit(f"Expected source {COMMIT}, got {actual}")
    # Meson records the source directory used for these binaries.
    info = json.loads((args.build_dir / "meson-info/intro-buildoptions.json").read_text())
    source_dir = json.loads((args.build_dir / "meson-info/meson-info.json").read_text())["directories"]["source"]
    if Path(source_dir).resolve() != (ROOT / "third_party/qemu").resolve():
        raise SystemExit("Build directory does not belong to the pinned source")
    fixture = args.build_dir / "inventory-stub.bin"
    fixture.write_bytes(bytes.fromhex("73005010"))  # RV WFI, never executed (-S).
    output = ROOT / "src/features/platform/inventories"
    output.mkdir(exist_ok=True)
    for board, target, options in PRESETS:
        if args.board and board != args.board:
            continue
        executable = args.build_dir / f"qemu-system-{target}"
        version = subprocess.check_output([str(executable), "--version"], text=True).splitlines()[0]
        if "11.1.2" not in version:
            raise SystemExit(f"Wrong binary version: {version}")
        if board == "microchip-icicle-kit":
            options = options[:-2] + ["-bios", str(fixture)]
        arguments = [*options, "-accel", "tcg", "-S", "-display", "none", "-serial", "null", "-monitor", "none", "-nodefaults", "-no-user-config", "-nic", "none", "-audio", "driver=none", "-qmp", "stdio"]
        signal.alarm(180)
        inventory = capture(executable, arguments)
        signal.alarm(0)
        inventory.update({"boardId": board, "qemuCommit": COMMIT, "target": target, "arguments": [value.replace(str(ROOT) + "/", "") for value in arguments], "buildOptions": {o["name"]: o["value"] for o in info if o["name"] in ["target_list", "default_devices", "rust", "slirp"]}})
        (output / f"{board}.json").write_text(json.dumps(inventory, indent=2) + "\n")
        print(f"{board}: {len(inventory['devices'])} device objects, {len(inventory['spaces'])} address-space views, {sum(len(s['regions']) for s in inventory['spaces'])} ranges", flush=True)

    names = sorted(path.stem for path in output.glob("*.json"))
    imports = "\n".join(f'import inventory{i} from "./{name}.json";' for i, name in enumerate(names))
    (output / "index.ts").write_text("// Generated by scripts/capture-board-inventories.py\n" + imports + "\nexport const inventories = [" + ", ".join(f"inventory{i}" for i in range(len(names))) + "];\n")


if __name__ == "__main__":
    main()
