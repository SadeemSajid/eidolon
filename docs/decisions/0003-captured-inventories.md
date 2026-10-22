# 0003: Generate board inventories from initialized QEMU machines

Status: accepted. Supersedes the core-only coverage approach in decision 0002.

Hand-written CPU/RAM/UART sketches left most board devices and address maps absent. Replace them with reproducible captures from the pinned release for every preset, rather than expanding an unreliable collection of guessed constants.

Capture all QOM device objects, realization state, parent-bus links and connected link<irq> outputs. Capture all resolved memory FlatViews with ownership and exact hexadecimal bounds. Keep address spaces separate and use BigInt at the rendering boundary. Do not conflate generic GPIO links with interrupts or routing containers with physical RAM.

Expose model status and unsupported hardware. The Pi 4's absent GENET model must never be rendered as a functional Ethernet controller. Capture tools run diskless/headless/paused without network backends; they are maintenance tooling, not the app's runtime supervisor.

This verifies map/device initialization. It does not validate guest boots, optional uninstantiated hardware, post-boot reconfiguration, model fidelity, or internal connections not exposed as QOM output links. Record those boundaries explicitly.
