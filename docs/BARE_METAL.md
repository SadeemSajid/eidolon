# Generated Arm virt hello world

The desktop Software tab can generate, compile and run one bare-metal recipe. The browser editor cannot execute host tools. No external SDK or firmware source package is needed for this example.

## Prerequisites

See [dependencies and installation](DEPENDENCIES.md) for macOS/Linux setup, tool discovery and verified versions.

- Python 3.9 or newer.
- Clang with the `aarch64-none-elf` target and Cortex-A55 support.
- LLVM LLD (`ld.lld`), distributed separately from Clang on some systems.
- QEMU 11.1.2 built from the pinned submodule; see QEMU.md.
- When building Eidolon from source: Rust and the normal Tauri prerequisites.

On macOS, Clang/LLD can be installed with `brew install llvm lld`. Configure the desktop's environment before launching it:

```sh
export EIDOLON_CLANG=/opt/homebrew/opt/llvm/bin/clang
export EIDOLON_LLD=/opt/homebrew/bin/ld.lld
export EIDOLON_QEMU="$PWD/build/qemu/qemu-system-aarch64"
bun run tauri dev
```

`EIDOLON_PYTHON` can select another Python executable. Otherwise Python, Clang and LLD are resolved as `python3`, `clang` and `ld.lld` on the host PATH. QEMU defaults only to the repository's pinned build path; a packaged installation must set `EIDOLON_QEMU` explicitly. Use absolute executable paths in overrides. The QMP greeting must report exactly 11.1.2. That release check is not proof of source-commit identity for a user-supplied binary; build it from the pinned source.

Select Arm virt, open Software, and click Run platform. The footer terminal icon toggles the bottom output panel. Run opens its Build tab automatically; it shows actual generation, tool checks, compilation, linking and QEMU startup updates from Rust. Select Serial in the same panel to view guest UART output. Closing the panel does not stop the guest. This generates `startup.S`, `main.c`, `linker.ld` and `plan.json` in the app's cache, compiles `firmware.elf`, and starts QEMU. No generated code or binary is committed. The small generator and versioned behavioral recipe are authored MIT source.

The ELF starts at 0x40200000, leaving the first 2 MiB of RAM free for QEMU’s generated device tree and reserved boot area. This prevents overlap with the DTB loaded at the RAM base when using the generic loader.

Expected serial output:

```text
Hello from Eidolon!
Exception level: EL1
```

The firmware then waits for interrupts. Stop platform terminates QEMU via QMP. The app also cleans up on exit. Errors and premature exits are shown rather than represented as successful execution. A status check stops a guest that has not produced the exact expected output within ten seconds.

The active project has a cache directory, shown under Generated project, containing generated sources, the ELF, serial output, QEMU stderr, and tool diagnostics. The first Run generates a project; later Runs rebuild its saved files. Explicit regeneration creates a new directory. `plan.json` records source SHA-256 hashes and exact arguments. `run.json` records tool versions and executable paths. These directories are retained for inspection and can be removed when no platform is running.

## Inspect, edit, rebuild and clean

Open the footer terminal and select **Sources**. **Generate sources** prepares the project without needing to compile or launch it. Select a file to inspect it:

- `startup.S`, `main.c`, `linker.ld`: editable, up to 256 KiB each.
- `plan.json`: original generation plan, read only.
- `run.json`: latest build provenance with actual source hashes, read only; appears after a build.

**Save** writes changed sources. **Save & run** saves pending buffers and rebuilds them; **Rebuild & run** rebuilds the current saved project. The Software tab's Run action also saves pending source edits. No regeneration occurs during these rebuilds. Stop the guest before saving, rebuilding, regenerating or cleaning. Sources can be inspected while it runs.

**Regenerate** creates a fresh project from the recipe and asks before discarding unsaved buffers. Previous saved project directories remain on disk. Modified firmware is marked as edited; it can print a different greeting and is not judged by the generated hello-world verification/timeout. Its actual source hashes are recorded in `run.json`.

Cleanup offers these scopes and previews the exact paths before confirmation:

| Scope                                  | Deletes                                                                                 | Preserves                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Build outputs only                     | Active project's objects, ELF, runtime manifest and logs                                | Source files, unsaved buffers, generation plan, QEMU                                |
| Generated projects · keep QEMU         | Recognized generated project directories in the app cache, including saved source edits | QEMU and unrelated cache entries                                                    |
| Full local clean · includes QEMU build | Generated projects and the recognized repository-local `build/qemu` directory           | QEMU source, Rust/JS dependencies, externally installed QEMU, Python, Clang and LLD |

Full local clean only removes a QEMU build whose configuration identifies this checkout's QEMU source; an external `EIDOLON_QEMU` installation is never deleted. After removing the local QEMU build, rebuild/provision it before running firmware again. No cleanup occurs merely by selecting a scope or closing the terminal.

Saved files remain on disk after the app exits. The active project selection is currently session-scoped; the editor does not yet reopen older project directories after restarting the desktop app. Use the displayed project path to retain files you want to keep before choosing project cleanup.

## Generate without launching

```sh
python3 scripts/generate-bare-metal.py --output build/hello-world
```

The generator itself performs no downloads, compilation or process execution. The recipe is `recipes/bare-metal/arm-virt-a55.json`; unsupported hardware changes are rejected, rather than treated as a working custom SoC. The greeting can be changed to another short printable ASCII message. Keep behavior changes versioned and covered by boot tests.

## Native smoke test

This exercises the same Rust generator/compiler/QMP/serial path used by the desktop, without opening a window. It checks the greeting, EL1, rejection of a second simultaneous run, clean Stop, and unexpected process-exit detection:

```sh
EIDOLON_CLANG=/opt/homebrew/opt/llvm/bin/clang EIDOLON_LLD=/opt/homebrew/bin/ld.lld \
  cargo test --manifest-path src-tauri/Cargo.toml --locked --lib generated_hello_world_boots_and_stops -- --ignored --nocapture
```

Artifacts go under ignored `build/runtime-smoke/`. Default unit tests do not require QEMU. The smoke test must be run explicitly on a host with the pinned build before claiming a new recipe works. It also edits the greeting, recompiles without regeneration, checks custom serial output, preserves sources through output cleanup, regenerates clean sources, and checks compiler-error recovery.

## Behavioral sources

The fixed addresses and UART clock come from the pinned QEMU `hw/arm/virt.c`; UART register behavior is implemented in `hw/char/pl011.c`. ELF loading and PC initialization follow QEMU's [generic loader](https://www.qemu.org/docs/master/system/generic-loader.html), with boot state selected through the [Arm virt](https://www.qemu.org/docs/master/system/arm/virt.html) machine options. Register programming follows the Arm PL011 UART register interface. Captured memory ranges alone do not supply that behavior.

This first recipe has no filesystem, heap, guest network, disk, OS, interrupt handlers, or guest console input. Its 128 MiB/one-CPU execution configuration is explicit and is not a claim to boot the full configuration represented by every inventory node. It validates a functional UART path, not physical timing or the complete board.

## Local verification

The native smoke test passed on macOS arm64 with Apple Clang 21.0.0 and LLD 23.1.4, using QEMU 11.1.2 built from commit `4fc49f46dc95d4a27de2509e7fceb2931e91faeb`. The QEMU build used:

```sh
../../third_party/qemu/configure --python=/opt/homebrew/bin/python3.14 \
  --target-list=aarch64-softmmu --disable-docs --disable-werror \
  --disable-tools --disable-guest-agent --disable-pvg
ninja qemu-system-aarch64
```

`--disable-pvg` avoids the unused Apple paravirtualized graphics backend, whose APIs are unavailable in the macOS 27 SDK. Upstream QEMU source was unchanged. The test verified the exact greeting/EL1 output, QMP shutdown, duplicate-run rejection, and unexpected-exit handling through the Rust runtime. GUI interaction and other host platforms have not been manually verified; CI includes the Linux boot smoke test.
