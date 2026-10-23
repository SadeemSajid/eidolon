#!/usr/bin/env python3
"""Resolve a supported platform into firmware components and build/launch plans.

No downloads, compilation or host process execution. The v1 recipe path remains
available, unchanged, through generate()/--recipe for regression testing.
"""
import argparse
from dataclasses import dataclass
import hashlib
import importlib.util
import json
from pathlib import Path
import re
from string import Template

ROOT = Path(__file__).resolve().parent.parent if "__file__" in globals() else Path.cwd()
RECIPE = ROOT / "recipes/bare-metal/arm-virt-a55.json"
PLATFORM = ROOT / "platforms/arm-virt-a55.json"

# Explicit capabilities of this backend, not properties inferred from a CPU.
ARM_VIRT_CPUS = ("cortex-a53", "cortex-a55", "cortex-a72")
COMPONENTS = {
    "aarch64-el1": {
        "files": {"startup.S": "arch/aarch64/startup.S", "platform.c": "arch/aarch64/platform.c", "platform.h": "include/platform.h"},
        "compile": ["startup.S", "platform.c"],
    },
    "pl011-console": {
        "files": {"pl011.c": "drivers/pl011.c", "console.h": "include/console.h", "platform_config.h": "templates/platform_config.h.in"},
        "compile": ["pl011.c"],
    },
    "hello-world": {
        "files": {"main.c": "apps/hello.c.in", "linker.ld": "templates/linker.ld.in"},
        "compile": ["main.c"],
    },
}


def legacy_generator():
    spec = importlib.util.spec_from_file_location("eidolon_legacy_bare_metal", ROOT / "scripts/legacy_bare_metal.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate(recipe):
    return legacy_generator().validate(recipe)


def generate(recipe, output):
    return legacy_generator().generate(recipe, output)


def object_fields(value, fields, name):
    if not isinstance(value, dict) or set(value) != set(fields):
        raise ValueError(f"{name}: expected fields {', '.join(fields)}")
    return value


def integer(value, name):
    if type(value) is not int:
        raise ValueError(f"{name}: expected an integer")
    return value


def address(value, name):
    if isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]+", value):
        value = int(value, 16)
    value = integer(value, name)
    if not 0 <= value < 2 ** 64:
        raise ValueError(f"{name}: must fit an unsigned 64-bit address")
    return value


@dataclass(frozen=True)
class ResolvedPlatform:
    description: dict
    cpu: str
    ram_base: int
    ram_size: int
    entry: int
    stack_size: int
    uart_base: int
    clock_hz: int
    baud: int
    message: str
    components: tuple


def resolve_platform(description):
    object_fields(description, ["schemaVersion", "id", "backend", "cpu", "memory", "devices", "firmware"], "platform")
    if integer(description["schemaVersion"], "schemaVersion") != 1:
        raise ValueError("Unsupported platform schemaVersion")
    if not isinstance(description["id"], str) or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}", description["id"]):
        raise ValueError("id: use a short alphanumeric identifier")
    backend = object_fields(description["backend"], ["kind", "machine", "qemuVersion", "gicVersion"], "backend")
    if backend["kind"] != "qemu-arm-virt" or backend["machine"] != "virt-11.1":
        raise ValueError("Only the qemu-arm-virt / virt-11.1 backend is supported")
    if backend["qemuVersion"] != [11, 1, 2] or any(type(v) is not int for v in backend["qemuVersion"]):
        raise ValueError("This backend requires QEMU 11.1.2")
    if integer(backend["gicVersion"], "gicVersion") not in (2, 3):
        raise ValueError("gicVersion must be 2 or 3")
    cpu = object_fields(description["cpu"], ["architecture", "model", "cores"], "cpu")
    if cpu["architecture"] != "aarch64" or cpu["model"] not in ARM_VIRT_CPUS:
        raise ValueError("Supported AArch64 CPUs: " + ", ".join(ARM_VIRT_CPUS))
    if integer(cpu["cores"], "cores") != 1:
        raise ValueError("The EL1 startup component currently supports exactly one CPU")
    if not isinstance(description["memory"], list) or len(description["memory"]) != 1:
        raise ValueError("Arm virt currently requires one contiguous RAM region")
    ram = object_fields(description["memory"][0], ["id", "kind", "base", "size"], "memory[0]")
    if ram["kind"] != "ram" or ram["id"] != "ram":
        raise ValueError("memory[0] must be the 'ram' RAM region")
    ram_base, ram_size = address(ram["base"], "RAM base"), address(ram["size"], "RAM size")
    if ram_base != 0x40000000:
        raise ValueError("Arm virt fixes RAM at 0x40000000; relocation needs another backend")
    if ram_size % (1024 * 1024) or not 16 * 1024 * 1024 <= ram_size <= 2 * 1024 ** 3:
        raise ValueError("RAM size must be 16–2048 MiB in whole MiB units")
    if not isinstance(description["devices"], list) or len(description["devices"]) != 1:
        raise ValueError("The current firmware target supports one PL011 console device")
    uart = object_fields(description["devices"][0], ["id", "kind", "base", "size", "clockHz", "spi"], "devices[0]")
    if uart["id"] != "uart0" or uart["kind"] != "pl011":
        raise ValueError("The available console component requires PL011 uart0")
    uart_base, uart_size = address(uart["base"], "UART base"), address(uart["size"], "UART size")
    if uart_base != 0x09000000 or uart_size != 0x1000:
        raise ValueError("Arm virt UART0 has fixed MMIO at 0x09000000, size 0x1000")
    if integer(uart["clockHz"], "UART clock") != 24000000 or integer(uart["spi"], "UART SPI") != 1:
        raise ValueError("Arm virt UART0 requires a 24 MHz clock and SPI 1")
    fw = object_fields(description["firmware"], ["runtime", "application", "bootMemory", "entryOffset", "stackSize", "exceptionLevel", "console", "baud", "message"], "firmware")
    if fw["runtime"] != "bare-metal" or fw["application"] != "hello-world":
        raise ValueError("Only the bare-metal hello-world application is registered; generated main.c can be edited")
    if fw["bootMemory"] != ram["id"] or fw["console"] != uart["id"]:
        raise ValueError("Firmware memory/console bindings must reference existing components")
    if integer(fw["exceptionLevel"], "exceptionLevel") != 1:
        raise ValueError("Only the AArch64 EL1 startup contract is implemented")
    offset, stack = address(fw["entryOffset"], "entryOffset"), address(fw["stackSize"], "stackSize")
    if offset < 0x200000 or offset % 4096:
        raise ValueError("entryOffset must be 4 KiB aligned and leave 2 MiB for QEMU's DTB/boot area")
    if not 4096 <= stack <= 1024 * 1024 or stack % 16 or offset + stack >= ram_size:
        raise ValueError("Stack must be 4 KiB–1 MiB, 16-byte aligned, and fit above the entry inside RAM")
    baud = integer(fw["baud"], "baud")
    if baud <= 0:
        raise ValueError("baud must be positive")
    divisor = (uart["clockHz"] * 4 + baud // 2) // baud
    if not 64 <= divisor <= 65535 * 64 + 63:
        raise ValueError("baud is outside the supported PL011 divisor range")
    message = fw["message"]
    if not isinstance(message, str) or not 1 <= len(message) <= 120 or any(not 32 <= ord(c) <= 126 for c in message):
        raise ValueError("message must contain 1–120 printable ASCII characters")
    canonical = json.loads(json.dumps(description))
    canonical["memory"][0].update(base=hex(ram_base), size=hex(ram_size))
    canonical["devices"][0].update(base=hex(uart_base), size=hex(uart_size))
    canonical["firmware"].update(entryOffset=hex(offset), stackSize=hex(stack))
    return ResolvedPlatform(canonical, cpu["model"], ram_base, ram_size, ram_base + offset, stack, uart_base, uart["clockHz"], baud, message, ("aarch64-el1", "pl011-console", fw["application"]))


def component_assets():
    paths = {path for component in COMPONENTS.values() for path in component["files"].values()}
    return {path: (ROOT / "firmware" / path).read_text() for path in sorted(paths)}


def generate_platform(description, output, assets=None):
    resolved = resolve_platform(description)
    assets = component_assets() if assets is None else assets
    required = {path for component in COMPONENTS.values() for path in component["files"].values()}
    if not isinstance(assets, dict) or set(assets) != required or any(not isinstance(v, str) for v in assets.values()):
        raise ValueError("Invalid trusted firmware component bundle")
    divisor = (resolved.clock_hz * 4 + resolved.baud // 2) // resolved.baud
    substitutions = {"greeting": json.dumps(resolved.message + "\r\n"), "uart_base": hex(resolved.uart_base) + "UL", "uart_clock": str(resolved.clock_hz), "baud": str(resolved.baud), "ibrd": str(divisor // 64), "fbrd": str(divisor % 64), "entry": hex(resolved.entry), "length": hex(resolved.ram_base + resolved.ram_size - resolved.entry), "stack": hex(resolved.stack_size)}
    sources, compile_sources = {}, []
    for identifier in resolved.components:
        component = COMPONENTS[identifier]
        for filename, path in component["files"].items():
            sources[filename] = Template(assets[path]).substitute(substitutions) if path.endswith(".in") else assets[path]
        compile_sources.extend(component["compile"])
    flags = ["--target=aarch64-none-elf", "-mcpu=" + resolved.cpu, "-mgeneral-regs-only", "-ffreestanding", "-fno-builtin", "-fno-stack-protector", "-fno-pic", "-fno-pie", "-fno-unwind-tables", "-fno-asynchronous-unwind-tables", "-O2", "-Wall", "-Wextra", "-Werror"]
    backend = resolved.description["backend"]
    plan = {
        "schemaVersion": 2, "projectKind": "eidolon-bare-metal-v2",
        "platform": resolved.description,
        "resolvedPlatform": {"entry": hex(resolved.entry), "ramEnd": hex(resolved.ram_base + resolved.ram_size), "reservedBootRegion": {"base": hex(resolved.ram_base), "size": "0x200000"}, "exceptionLevel": 1},
        "components": list(resolved.components),
        "qemuVersion": backend["qemuVersion"],
        "sourcesSha256": {name: hashlib.sha256(contents.encode()).hexdigest() for name, contents in sources.items()},
        "compileCommands": [flags + ["-c", name, "-o", name + ".o"] for name in compile_sources],
        "linkArgs": ["-T", "linker.ld", "--build-id=none", *[name + ".o" for name in compile_sources], "-o", "firmware.elf"],
        "qemuArgs": ["-machine", backend["machine"] + f",secure=off,virtualization=off,gic-version={backend['gicVersion']}", "-cpu", resolved.cpu, "-accel", "tcg", "-smp", str(resolved.description["cpu"]["cores"]), "-m", str(resolved.ram_size // (1024 * 1024)) + "M", "-display", "none", "-monitor", "none", "-nodefaults", "-no-user-config", "-nic", "none", "-serial", "file:serial.log", "-qmp", "stdio", "-S", "-device", "loader,file=firmware.elf,cpu-num=0"],
        "expectedSerial": resolved.message + "\r\nException level: EL1\r\n",
    }
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    (output / ".gitignore").write_bytes(b"*\n")
    for name, contents in sources.items():
        (output / name).write_bytes(contents.encode())
    (output / "platform.json").write_bytes((json.dumps(resolved.description, indent=2, sort_keys=True) + "\n").encode())
    (output / "plan.json").write_bytes((json.dumps(plan, indent=2, sort_keys=True) + "\n").encode())
    return plan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--recipe", type=Path)
    mode.add_argument("--recipe-json")
    mode.add_argument("--platform", type=Path)
    mode.add_argument("--platform-json")
    parser.add_argument("--components-json", help="Trusted embedded component assets supplied by the desktop host")
    args = parser.parse_args()
    if args.recipe or args.recipe_json is not None:
        recipe = json.loads(args.recipe_json) if args.recipe_json is not None else json.loads(args.recipe.read_text())
        generate(recipe, args.output)
    else:
        description = json.loads(args.platform_json) if args.platform_json is not None else json.loads((args.platform or PLATFORM).read_text())
        assets = json.loads(args.components_json) if args.components_json is not None else None
        generate_platform(description, args.output, assets)


if __name__ == "__main__":
    main()
