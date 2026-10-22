# QEMU integration

## Pinned source

- Upstream: https://gitlab.com/qemu-project/qemu.git
- Stable release: **v11.1.2** (latest listed by upstream when checked on 2026-10-22).
- Commit: `4fc49f46dc95d4a27de2509e7fceb2931e91faeb`.
- Location: `third_party/qemu` (optional Git submodule).
- Local patches: none.

Sources: [upstream releases](https://www.qemu.org/), [release tag](https://gitlab.com/qemu-project/qemu/-/tags/v11.1.2), [build documentation](https://www.qemu.org/docs/master/devel/build-system.html).

The submodule records an exact commit. Do not use `git submodule update --remote` to silently change it. The editor reads checked-in inventories and does not require or launch QEMU. The maintenance helper captures those inventories from the pinned build.

## Optional source build

Install the host build prerequisites described by upstream (including a C toolchain, Python, Ninja, GLib, and Pixman where required). Building QEMU is separate from building Eidolon. From the repository root on a Unix-like development host:

```sh
git submodule update --init --depth 1 third_party/qemu
mkdir -p build/qemu
cd build/qemu
../../third_party/qemu/configure --target-list=aarch64-softmmu,arm-softmmu,riscv64-softmmu --disable-werror
ninja
./qemu-system-aarch64 --version
./qemu-system-aarch64 -machine help
./qemu-system-aarch64 -machine virt -cpu help
./qemu-system-aarch64 -device help
```

Configure may need network access for upstream dependencies and Python tooling. A pinned 11.1.2 build of these three targets and all 14 inventory captures have been verified on the development Linux host. This does not establish support on other hosts or successful guest boot. Consult the pinned source's own instructions for platform-specific requirements. System-installed QEMU may be supported later via explicit executable discovery and capability verification; there is no executable-path configuration yet.

## Runtime design

Begin with a constrained Arm `virt` template. Cortex-A55 is supported by current upstream Arm virt documentation, but the exact selected binary and board version must be probed and smoke-tested before claiming support. Onboard PL011 and memory are board-defined; adding another UART-shaped node does not create a working device. No graph is currently compiled to a launch command.

Use a local QMP transport for control, a separate guest serial stream, and Rust-owned lifecycle management. Avoid public control sockets and shell interpolation. Capture the executable version, machine version, arguments, and boot artifacts for reproducible runs.

## Updating

Fetch an explicit upstream stable tag inside the submodule, check it out detached, and update the parent gitlink in a focused change. Update the release/commit above. Review upstream license/build changes and verify target compilation, machine/CPU/device discovery, and every supported guest boot recipe. Explain changed behavior and any patches. Latest stable is a maintenance policy, not a floating runtime dependency.

## Licensing

QEMU remains GPL v2 overall with component-specific licenses. Keep its LICENSE and COPYING files intact. A submodule does not convert it to MIT. Before bundling binaries, establish the required notices and corresponding-source distribution process. See ../THIRD_PARTY_NOTICES.md.
