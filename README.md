# Eidolon

A visual virtual prototyping platform for early functional modeling by semiconductor teams.

The aim: compose a supported virtual platform on a canvas, configure its software, and run it using QEMU. The stack is **Tauri 2, React, TypeScript, Bun, and React Flow**, with a Rust host supervising QEMU as a separate process.

**Status: captured board inventory explorer.** Search 14 curated board presets to inspect device objects, parent-bus relationships, connected QOM IRQ/GPIO signals and complete resolved memory maps captured from pinned QEMU 11.1.2. Select CPU, secure or DMA/GPU address-space views in Memory Map. Stub, inactive and known unsupported hardware are labeled. Both sidebars collapse and resize; the canvas snaps to a grid. The desktop app does not yet launch guests, save projects or implement custom composition. Captures verify initialization, not guest booting. See [board coverage and reproduction](docs/BOARDS.md).

## Quick start

Install [Bun](https://bun.sh/docs/installation) (the pinned version is in package.json). Browser development does not require Rust or QEMU:

```sh
git clone https://github.com/SadeemSajid/eidolon.git
cd eidolon
bun install --frozen-lockfile
bun run dev
```

If you already cloned this repository, start with `bun install --frozen-lockfile`. The frontend uses http://localhost:1420.

For the desktop app, first install stable Rust and the [Tauri prerequisites for your OS](https://v2.tauri.app/start/prerequisites/), then:

```sh
bun run tauri dev
```

Rust dependencies resolve on the first desktop build. Commit the generated src-tauri/Cargo.lock when the first native build is verified; it is intentionally not ignored. See [development setup](docs/DEVELOPMENT.md) for platform requirements and checks.

## QEMU source (optional for editor work)

QEMU is pinned as a submodule rather than automatically following upstream HEAD. Initialize it only when working on the runtime:

```sh
git submodule update --init --depth 1 third_party/qemu
```

See [QEMU integration](docs/QEMU.md) for the selected version, source build instructions, and update policy. No QEMU binary is bundled or invoked by the app. The maintenance helper initializes a separately built pinned QEMU to generate the checked-in inventories.

## What is feasible?

QEMU is suitable for early software bring-up and functional exploration. Its Arm `virt` board supports Cortex-A55, memory, and a PL011 UART, making it a useful starting point. However, the board controls its memory map and device wiring: arbitrary canvas graphs cannot be translated into `-device` arguments. Start with constrained board templates; custom SoC composition will need custom QEMU machine models or another explicit configuration mechanism.

Bare-metal and FreeRTOS support each need tested board-specific startup code, drivers, memory layout, and boot recipes. An OS name alone is insufficient. Linux is planned for phase 2. This project does not target cycle-accurate performance, power, or RTL simulation.

## Contributor context

- [AGENTS.md](AGENTS.md): instructions for AI coding agents and humans.
- [Architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), and [decisions](docs/decisions/0001-runtime-boundary.md).
- [Contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md).

## License

Eidolon-authored code is [MIT](LICENSE). QEMU is separately licensed under GPL v2 with component-specific licenses. Its license is not changed by inclusion as a submodule. See [third-party notices](THIRD_PARTY_NOTICES.md); distributing QEMU binaries requires meeting its applicable license obligations.

References: [QEMU Arm virt](https://www.qemu.org/docs/master/system/arm/virt.html), [QEMU device model](https://www.qemu.org/docs/master/devel/qdev-api.html), [QEMU licensing](https://www.qemu.org/docs/master/about/license.html), [Tauri](https://v2.tauri.app/), [React Flow](https://reactflow.dev/learn).
