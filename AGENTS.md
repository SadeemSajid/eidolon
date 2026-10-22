# Working on Eidolon

Eidolon is an MIT-licensed desktop platform editor for early functional semiconductor modeling. Read README.md, docs/ARCHITECTURE.md, and docs/ROADMAP.md before substantial changes. Read docs/decisions/0001-runtime-boundary.md before runtime work.

## Current state

Tauri 2 + React + TypeScript + Bun + React Flow. The Board Library contains 14 captured QEMU 11.1.2 device inventories across Arm virt, MPS2/MPS3, AMD ZynqMP/Versal, NXP i.MX 8M, RISC-V virt/PolarFire and Pi 4. The left sidebar has Board Library and planned Custom SoC tabs. All exported FlatView ranges and connected QOM IRQ/GPIO links are captured; address spaces stay separate. Stub, inactive and unsupported devices are explicit. The app shows snapshots, not a live runtime. Board topology is fixed and layout snaps to a grid. No QEMU process, saved project format, or boot support exists yet. Read docs/BOARDS.md before changing board facts; preserve provenance and coverage limitations. Do not present mock behavior as working emulation.

## Layout

- src/: frontend; platform concepts live in src/features/platform/.
- src-tauri/: Rust desktop host; future process supervision and QMP belong here.
- third_party/qemu/: upstream Git submodule, separately GPL licensed.
- scripts/capture-board-inventories.py: reproduce inventories from the pinned build; never use an unrelated system binary.
- docs/: architecture, roadmap, decisions, and development instructions.
- examples/platforms/: future validated, redistributable example platforms.
- scripts/: repeatable development helpers.

## Commands

Use Bun, keep bun.lock committed, and avoid introducing other JS lockfiles.

- bun install --frozen-lockfile
- bun run dev (browser editor)
- bun run tauri dev (desktop; requires Rust and native dependencies)
- bun run test
- bun run check
- bun run build
- bun run format:check
- bun run format
- cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
- cargo check --manifest-path src-tauri/Cargo.toml --locked (after initial Cargo.lock generation)

## Engineering constraints

- Keep React Flow presentation separate from the future versioned hardware model. Pixel positions are not hardware topology.
- Validate CPU/board compatibility, buses, address ranges, interrupts, and boot recipes before launch. Device discovery alone does not prove composability.
- QEMU runs as a separate process owned by Rust. Use argument arrays, never shell command strings. Keep process/file access out of frontend code; expose narrow typed commands and minimal Tauri permissions.
- Use QMP for runtime control and a separate serial channel for the guest console. Handle process exit and cleanup.
- Functional modeling is the scope; do not claim cycle accuracy or timing/power fidelity.
- Keep upstream QEMU unchanged unless the task specifically needs a machine/device change. Follow its own contributor instructions if editing it. Record tag, commit, build options, and local patches on upgrades.
- Eidolon-authored files are MIT. Preserve third-party notices and licenses; never relabel QEMU as MIT. Do not commit proprietary firmware or OS images.
- Document architecture changes with a decision record. Prefer small changes with clear types and useful validation; avoid speculative abstractions.
- Run relevant checks and report exactly what passed and what could not run. Tests should cover behavior or domain constraints, not mirror implementation.
- Never commit secrets, generated binaries, dependencies, or local AI conversation history. Do not commit/push unless requested.

## Commit conventions

All new commits and PR titles must use Conventional Commits: `type(scope): description` (scope optional). Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert. Use `!` before the colon for a breaking change. Example: `fix(boards): include missing GPIO regions`. Never create unprefixed subjects. Do not rewrite already-pushed history to repair old subjects. CI checks new commits and PR titles. Contributors should run `bun run setup:hooks` once after cloning to enable the tracked commit-msg hook. Commit/push only when authorized by the user.
