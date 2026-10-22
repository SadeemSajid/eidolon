# Roadmap

## Foundation — current

- Tauri/React/Bun shell and React Flow editor.
- Contributor and agent context; pinned QEMU source.
- A searchable library of 14 pinned-QEMU device inventories, connected QOM signals, complete exported FlatViews, and snapping layout; snapshot capture runs QEMU headless. The desktop also has one on-demand generated Arm virt/Cortex-A55 bare-metal hello-world recipe with QMP control, serial output and Stop; general runtime configuration and persistence remain unimplemented.

## Phase 1 — reproducible functional bring-up

1. Choose and document one constrained Arm virt board/version and supported CPU baseline.
2. Define a versioned project format independent of React Flow, with save/load and schema migration policy.
3. Implement a verified component catalog and semantic validation. Canvas connections must represent typed supported relationships.
4. Build or locate QEMU, verify its version/capabilities, and generate inspectable launch plans.
5. Add Rust process supervision, local QMP transport, serial console, stop/reset, and crash diagnostics.
6. Initial path implemented: generate and boot an MIT bare-metal UART hello world on Arm virt, with an explicit native smoke test. Extend this beyond the constrained recipe.
7. Add one verified FreeRTOS port and firmware build recipe; document any different board/CPU requirement.
8. Add project examples and native CI smoke coverage before claiming supported configurations.

## Phase 2 — Linux and broader platforms

- Tested Linux kernel/device-tree/root-filesystem recipes, with explicit image licensing and provenance.
- Additional board templates, CPU/device options, debugging and trace workflows.
- Custom QEMU machine support for composition beyond fixed-board configuration.

## Future exploration

Reusable subsystems, richer peripheral models, reproducible platform export, and connections to other modeling systems. No cycle-accurate or arbitrary-device-composition promise is implied.
