# Arm virt bare-metal firmware

The desktop Software tab resolves a supported platform description into reusable firmware components, configuration/linker files, and matching build/launch plans. It then builds and runs the project through Rust-owned QEMU. The browser editor cannot execute host tools. The original fixed A55 recipe remains a separate, byte-stable regression contract.

## Prerequisites

See [dependencies and installation](DEPENDENCIES.md) for host setup and tool discovery.

- Python 3.9 or newer.
- Clang with aarch64-none-elf and the selected Cortex-A53/A55/A72 CPU support.
- LLVM LLD (ld.lld), distributed separately from Clang on some systems.
- QEMU 11.1.2 from the pinned submodule; see QEMU.md.
- To build Eidolon itself: Rust and normal Tauri prerequisites.

Tools are provisioned externally; Run never downloads them. No SDK, C library or proprietary firmware is needed for the included application. EIDOLON_PYTHON, EIDOLON_CLANG, EIDOLON_LLD and EIDOLON_QEMU select executables. Python/Clang/LLD otherwise use PATH; QEMU defaults only to the repository's pinned build. Use absolute executable paths in overrides.

On macOS with Homebrew LLVM/LLD, for example:

```sh
export EIDOLON_CLANG=/opt/homebrew/opt/llvm/bin/clang
export EIDOLON_LLD=/opt/homebrew/bin/ld.lld
export EIDOLON_QEMU="$PWD/build/qemu/qemu-system-aarch64"
bun run tauri dev
```

QMP must report exactly the version selected by the validated backend (currently 11.1.2). A numeric release check does not prove source-commit identity for an externally supplied binary; build the pinned source.

## Run the default target

Select Arm virt, open Software and click Run platform. The first Run generates the default target in platforms/arm-virt-a55.json, compiles firmware.elf and launches QEMU paused before QMP negotiation/resume. Subsequent Runs rebuild the active project's saved sources without regenerating them. Build and Serial output appear in the footer Terminal panel. A separate Code icon opens the source files. Both panels resize vertically by dragging their top edge and retain independent heights; closing either does not stop the guest.

The default is one Cortex-A55, 128 MiB RAM, GICv3 and PL011 UART0 at EL1. Its ELF entry is 0x40200000, leaving the first 2 MiB of RAM for QEMU's DTB/boot allocation. Expected serial output:

```text
Hello from Eidolon!
Exception level: EL1
```

The firmware then waits for interrupts. Stop platform shuts QEMU down through QMP, with bounded wait/kill/reap fallback. The app also stops it on exit. Missing expected output from unedited generated firmware stops the run after ten seconds. Edited sources may emit different output and are not labeled as the verified generated application.

## Configure through a platform description

Open Software → Platform description, edit/paste a supported description, then choose Generate from description. Eidolon validates it, selects components and generates a fresh project. Invalid JSON or unsupported capabilities preserve the existing active project. With an existing project, review the confirmation before discarding unsaved source buffers; prior saved projects remain on disk. Run platform then builds and boots the generated target.

Supported fields and constraints are documented in [platforms/README.md](../platforms/README.md). The initial backend supports one A53/A55/A72, GICv2/v3, 16–2048 MiB contiguous RAM, an ELF entry beyond the reserved boot area, a bounded stack, and the fixed PL011 UART0 mapping/clock/IRQ. RAM base, peripheral relocation, multicore startup, other console drivers, FreeRTOS/Linux and custom QEMU machine construction are not implemented. Device entries are the firmware's required bindings, not a complete replacement inventory of onboard hardware.

The same resolved model drives compiler CPU flags, UART divisors, linker memory/entry/stack settings and QEMU CPU/RAM/GIC options. The existing captured architecture diagram and memory map remain reference inventories; they do not change with execution settings. Read platform.json and plan.json for the actual active configuration.

Hardware descriptions cannot infer arbitrary application logic. This iteration generates the hello-world application; edit main.c to implement your firmware through the console/platform APIs. Future application/component packaging remains separate work.

## Components and generated files

Authored reusable source lives under firmware/. The registry and typed resolver live in scripts/generate-bare-metal.py. The desktop embeds that generator and the component assets, so packaged generation does not need the source checkout's firmware directory.

| Generated files        | Purpose                                                                        | Editor access |
| ---------------------- | ------------------------------------------------------------------------------ | ------------- |
| startup.S              | AArch64 EL1 stack/BSS setup and entry                                          | Editable      |
| platform.c, platform.h | Architecture services, including current exception level                       | Editable      |
| pl011.c, console.h     | Polling driver and application-facing console API                              | Editable      |
| main.c                 | Application using services, without MMIO register addresses                    | Editable      |
| linker.ld              | Generated RAM/entry/stack layout                                               | Editable      |
| platform_config.h      | UART bindings/divisors generated from the resolved description                 | Read only     |
| platform.json          | Canonical active description                                                   | Read only     |
| plan.json              | Component selection, original hashes, compiler/linker/QEMU argument arrays     | Read only     |
| run.json               | Actual source hashes, executable paths and tool versions from the latest build | Read only     |

All compilation inputs, including headers, are hashed. Source editing is filename-allowlisted and limited to 256 KiB per file. The plan kept in Rust memory owns process arguments: modifying a disk manifest cannot inject commands into a rebuild.

## Edit, rebuild, regenerate and clean

In the footer Code panel, Save writes source edits; Save & run saves pending source buffers and rebuilds; Rebuild & run uses the saved files. Software's Run also saves pending source edits. Stop the guest before editing, rebuilding, regenerating or cleaning; inspection is allowed while it runs.

Regenerate creates a fresh project from the **active validated description**, not necessarily the default A55 target. It confirms before replacing unsaved source buffers. Previous saved project directories remain until cleanup. Applying another description similarly creates a fresh project.

Cleanup previews exact paths and requires confirmation:

| Scope              | Deletes                                                                                                    | Preserves                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Build outputs      | Active project's object files, ELF, runtime manifest and logs                                              | Sources, unsaved buffers, platform/generation manifests, QEMU     |
| Generated projects | Recognized v1/v2 project directories in the app cache, including saved source edits                        | QEMU and unknown cache entries                                    |
| Full local clean   | Recognized projects plus repository-local build/qemu, only when its source marker identifies this checkout | QEMU source, JS/Rust dependencies and external tool installations |

No cleanup happens merely by selecting a scope or closing the terminal. Active project/description selection is session-scoped; files remain on disk, but reopening an older cached project after restarting the app is not implemented.

## CLI generation and preserved regression

```sh
# Modular generation from the default description.
python3 scripts/generate-bare-metal.py --output build/modular-firmware
# An explicit supported platform description.
python3 scripts/generate-bare-metal.py --platform platforms/arm-virt-a55.json --output build/configured-firmware
# Frozen v1 recipe, still producing the original bytes.
python3 scripts/generate-bare-metal.py --recipe recipes/bare-metal/arm-virt-a55.json --output build/legacy-firmware
```

Generation performs no downloads, compilation or process execution. The v1 recipe is unchanged, and scripts/legacy_bare_metal.py preserves its original generator. SHA-256 fixtures in recipes/regressions check every original output. Generated projects and ELF binaries are never committed.

## Verification

```sh
# Unit/domain tests; real tool-dependent boots are skipped by default.
python3 -m unittest discover -s scripts -p '*_test.py'
# Boot the legacy recipe, modular default and alternate description.
EIDOLON_FIRMWARE_SMOKE=1 python3 -m unittest discover -s scripts -p modular_firmware_test.py
# Exercise default and configured targets through the desktop's native runtime.
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib boots_and_stops -- --ignored --nocapture
```

The legacy recipe, modular A55 default, and alternate A53/256 MiB/GICv2/57600-baud target passed on the Linux development host with pinned QEMU 11.1.2, Clang and LLD. Both native runtime tests passed, including invalid-description rejection without replacing the active project, generation, compilation, QMP control, EL1 serial output and Stop. The default native test also checks source editing/rebuild, compiler-error recovery, cleanup and process exit. CI runs these checks after building pinned QEMU.

The original v1 path was previously verified on macOS arm64 with Apple Clang 21.0.0 and LLD 23.1.4. The modular path has not yet been boot-tested on macOS or manually exercised through the desktop GUI. These tests establish the specified functional boot paths, not general model fidelity or arbitrary custom-SoC support.

Behavioral sources: pinned QEMU hw/arm/virt.c and hw/char/pl011.c, [generic ELF loader](https://www.qemu.org/docs/master/system/generic-loader.html), and [Arm virt boot state/options](https://www.qemu.org/docs/master/system/arm/virt.html). Captured addresses alone do not specify driver behavior. The current components do not provide a filesystem, heap, guest networking/disks, interrupt handlers or serial input.
