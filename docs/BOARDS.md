# Board inventories and memory maps

The old hand-written core diagrams have been replaced by captures of **QEMU 11.1.2**, commit `4fc49f46dc95d4a27de2509e7fceb2931e91faeb`. Each of the 14 presets is initialized with its recorded arguments and CPUs paused. The app displays these checked-in captures; it does not launch a guest yet.

## What the capture includes

- Every device object under `/machine`, its concrete type, realization state and parent-bus link, including internally created and unmapped devices.
- Every connected QOM `link<irq>` output. These are IRQ **or generic GPIO** signals; pin names are preserved instead of guessing interrupt numbers. Splitters, OR gates, individual CPUs, and real-time CPU domains are included.
- Every resolved region from `info mtree -f -o`, for every exported FlatView, with its owner, priority, backing-offset label and exact base/size. CPU, secure, DMA, GPU and mailbox views stay separate. Aliases therefore do not become additional physical RAM.
- Explicit `implemented`, `stub`, `inactive`, `routing`, and known `unsupported` status labels. A device object is not automatically a functional peripheral.

“Complete” here means complete **for these exported inventories and exact launch arguments**. It does not mean every peripheral on physical silicon is modeled. Optional devices that were not instantiated, non-QOM C-level internal connections, dynamically assigned PCI BARs after firmware configuration, and post-boot map changes are not inferred. Individual register fields are not expanded into separate blocks. No guest boot, peripheral-driver behavior, or timing fidelity has been verified.

The architectural diagram shows all captured device objects and memory owners. Solid edges represent the primary CPU view's address decoding or an exposed device parent bus. Dashed edges represent actual connected QOM signal links. Device labels and inspector paths identify the underlying objects. A device finder and minimap help navigate larger systems. Nodes retain fixed hardware topology and editable snapping positions.

## Memory map

The right sidebar's Memory Map tab has an address-space selector. Each option corresponds to one QEMU FlatView (with a stable content-derived ID rather than QEMU’s process-dependent enumeration number); multiple address-space names can share that resolved view. Every resolved mapping is shown in address order, including stub windows, aliases, split regions and routing containers. Slots are not to scale. Gaps are unmapped in that captured view, rather than guessed free RAM. The view ends at the last captured mapping and does not imply anything about trailing addresses.

Addresses and sizes are stored as hexadecimal strings in the capture and converted with BigInt for rendering. This preserves full 64-bit windows, including a `2^64`-byte downstream routing container. Such a container is not claimed to be backed by 16 EiB of RAM. The inspector's compact numeric addresses show the primary CPU view's safely representable ranges; the Memory Map tab retains every exact range in every view.

Selecting a mapped slot opens its owner's Inspector tab. Unsupported hardware has no invented register window or functional connection.

## Raspberry Pi 4B

The capture includes GPIO, three I²C controllers, SPI, both serial interfaces, SDHOST/SDHCI/eMMC2, DMA, USB/DWC2, system timers, clock/power management, mailbox, OTP and the remaining device objects. CPU and GPU/DMA alias addresses are available as separate views. RAM backing includes VideoCore carve-outs; it is not the amount available to a guest OS.

QEMU's pinned Raspberry Pi documentation lists **GENET Ethernet, the PCIe root port, and PWM as missing**. These appear as unsupported hardware, with no invented MMIO implementation. QEMU's placeholder devices, such as I²S, remain visible as stubs rather than being advertised as working models. See `third_party/qemu/docs/system/arm/raspi.rst`, `hw/arm/bcm2838.c`, `hw/arm/bcm2838_peripherals.c`, and `hw/arm/bcm2835_peripherals.c`.

## Reproducing the inventories

Build the pinned submodule (see QEMU.md). The capture helper requires three targets:

```sh
mkdir -p build/qemu
cd build/qemu
../../third_party/qemu/configure --target-list=aarch64-softmmu,arm-softmmu,riscv64-softmmu --disable-docs --disable-werror
ninja qemu-system-aarch64 qemu-system-arm qemu-system-riscv64
cd ../..
python3 scripts/capture-board-inventories.py
```

The helper verifies the source commit, binary release and Meson source directory. Every capture records executable target, exact arguments, QMP version, source commit, and relevant build options. It runs headless, diskless and paused, with networking disabled. No proprietary guest image is required. PolarFire normally needs an HSS firmware image; for inventory capture the helper supplies a generated four-byte RISC-V WFI fixture as firmware and never executes it. This is not an HSS implementation or a boot test.

The generated files are in `src/features/platform/inventories/`. `board-metadata.ts` supplies names and source entry points; `boards.ts` derives diagrams from the captures. Updating inventories is an explicit maintenance step after a QEMU or preset-argument change. Re-run the semantic tests and inspect the capture diff. Source verification alone cannot prove that arbitrary stale binaries were rebuilt; build the targets before capturing.

## Preset scope

The library remains a curated embedded/SoC selection, not a market-share ranking. Existing source metadata covers Arm virt; MPS2 M3/M4/M7/M33 and MPS3 M55; AMD ZCU102 and Versal generations 1/2; NXP i.MX 8M Plus/Mini; RISC-V virt and PolarFire SoC; and Raspberry Pi 4B. ZCU102 and Versal captures now include their real-time cores and interrupt domains as actual device objects instead of omitting them from an APU-only view.

For a new preset, add its exact arguments to the capture helper, capture its devices and memory views, add display metadata, and test important mappings and unsupported-device distinctions. Do not add a CPU/RAM/UART sketch and call it a complete board integration.
