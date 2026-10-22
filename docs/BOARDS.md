# Integrated board diagrams

These are curated, source-derived **core views** for QEMU 11.1.2 at commit `4fc49f46dc95d4a27de2509e7fceb2931e91faeb`. Neither board has been built or boot-tested in Eidolon. No live device discovery is implemented. Selecting a board replaces the in-memory view; positions reset when switching boards. The hardware inventory and connections cannot be edited in board mode.

## Arm virt / Cortex-A55

Configuration: `virt-11.1`, TCG, one Cortex-A55, 128 MiB RAM, GICv2, secure off, virtualization off, highmem off, MSI off. These are explicit view assumptions, not QEMU's default CPU/GIC configuration. Shown: CPU, logical physical address space, RAM, both CFI flash banks, GICv2 distributor/CPU interface, UART0, PL031 RTC, PL061 GPIO.

Map and peripheral interrupt indices come from `base_memmap`, `a15irqmap`, and the corresponding creation routines in [hw/arm/virt.c](https://gitlab.com/qemu-project/qemu/-/blob/4fc49f46dc95d4a27de2509e7fceb2931e91faeb/hw/arm/virt.c). GIC SPI indices 1/2/7 correspond to architectural INTIDs 33/34/39. IRQ/FIQ delivery is summarized in one connection, not individual signal pins.

Omitted: PCIe windows, fw_cfg, virtio transports, platform bus, ACPI devices, and CPU-internal timers. Secure devices, optional second UART, and optional SMMU are outside the selected configuration. A future full inventory must resolve creation conditions and exact machine options, not just parse the memory-map constants.

## MPS2 AN385 / Cortex-M3

Fixed Cortex-M3 and 16 MiB PSRAM, plus board-defined SRAM. Shown: primary SSRAM1, SSRAM2/3, block RAM, PSRAM, NVIC/system control space, UART0, and timer0.

Memory, UART RX/TX routing, and timer routing come from [hw/arm/mps2.c](https://gitlab.com/qemu-project/qemu/-/blob/4fc49f46dc95d4a27de2509e7fceb2931e91faeb/hw/arm/mps2.c). The NVIC system-control window is mapped by [hw/arm/armv7m.c](https://gitlab.com/qemu-project/qemu/-/blob/4fc49f46dc95d4a27de2509e7fceb2931e91faeb/hw/arm/armv7m.c), with registers implemented in `hw/intc/armv7m_nvic.c`. UART MMIO size is from `hw/char/cmsdk-apb-uart.c`; timer size is from `hw/timer/cmsdk-apb-timer.c`.

UART0 RX/TX use external IRQ 0/1, equivalent to exception slots 16/17. Timer0 uses external IRQ 8, exception slot 24. External IRQ numbers and exception slots must not be conflated.

Omitted: memory aliases, UART1–4, shared UART-overflow OR gate/IRQ 12, dual timer, watchdog, SPI, I²C, Ethernet, FPGA control/IO, and internal SysTick. GPIO areas are unimplemented stubs, not working GPIO controllers. The represented system-control window contains nested internal registers; the diagram treats it as one aggregate region.

## Rendering and validation

Solid blue connections represent logical physical-address access; they do not claim AXI/AHB/APB timing or a physical bus topology. Dashed amber connections represent interrupt delivery. Labels may summarize multiple signals; inspect block details for numbering conventions and omissions.

A block lists inclusive physical ranges. The domain model stores base plus byte size, independently of canvas positions. The static validator checks safe positive ranges, overlaps in the represented flat map, duplicate identifiers, and dangling connections. It deliberately does not model aliases, overlays, or multiple address spaces yet, and must not be used as a general custom-SoC validator. Passing it does not establish that a guest boots.

Before adding another board, record exact configuration and pinned source evidence, distinguish real models from unimplemented stubs/reserved windows, list coverage gaps, and add semantic tests. Full runtime reconciliation should later compare QEMU's realized memory tree/device tree against the preset.

## Memory map panel

The Memory Map tab in the collapsible right sidebar sorts represented regions by physical address into equal-height slots, with inclusive start/end addresses and byte sizes. It inserts hatched gaps between known regions. Gaps mean unrepresented addresses, not verified free/unmapped space. The view ends at the highest represented region and is explicitly not to scale. Selecting an occupied slot switches to its block in the Inspector tab. Selecting a canvas block also opens the Inspector tab.

## Curated library

The Board Library and Custom SoC tabs are independent of the current canvas. Search matches names, machine identifiers, CPU names and category. Custom SoC is a planned workflow; selecting its tab does not start an editor or discard a board.

The library is a practical embedded/SoC selection, not a measured market-share ranking or a claim to include every platform in use. Real hardware availability and upstream emulation coverage are separate criteria. Old niche boards and legacy STM32 F1/F4 evaluation-board models are excluded from this initial expansion; it does not imply that contemporary STM32 H7/U5 silicon is emulated. SiFive Unleashed is also not included merely to increase the count. Board support here means a selectable source-derived core diagram, not a boot-tested guest.

| Preset               | QEMU machine          | Diagram scope                                                                  |
| -------------------- | --------------------- | ------------------------------------------------------------------------------ |
| Arm virt / A55       | virt-11.1             | Existing A55 core view                                                         |
| MPS2 AN385 / M3      | mps2-an385            | Existing M3 core view                                                          |
| MPS2 AN386 / M4      | mps2-an386            | Same core devices as AN385, fixed M4                                           |
| MPS2 AN500 / M7      | mps2-an500            | PSRAM moves to 0x60000000; no separate block RAM                               |
| MPS2 AN505 / M33     | mps2-an505            | Primary SSRAM, NVIC and UART0; security aliases/protection omitted             |
| MPS3 AN547 / M55     | mps3-an547            | Two primary SRAM ranges, NVIC and UART0; DDR, boot RAM and protection omitted  |
| AMD ZCU102           | xlnx-zcu102           | Four-A53 APU group, 1 GiB DDR, GIC distributor and UART0; R5F domain omitted   |
| AMD Versal           | amd-versal-virt       | Two-A72 APU group, 1 GiB DDR, GICv3 and UART0; R5F domain and ITS omitted      |
| AMD Versal Gen 2     | amd-versal2-virt      | Eight-A78AE APU group, 1 GiB DDR, GICv3 and UART0; R52 domains and ITS omitted |
| NXP i.MX 8M Plus EVK | imx8mp-evk            | Four A53s, 1 GiB DDR, 576 KiB OCRAM, GICv3 and UART2                           |
| NXP i.MX 8M Mini EVK | imx8mm-evk            | Four A53s, 1 GiB DDR, 256 KiB OCRAM, GICv3 and UART2                           |
| RISC-V virt          | virt (riscv64 target) | One hart, 128 MiB RAM, PLIC, UART0; no AIA                                     |
| PolarFire SoC Icicle | microchip-icicle-kit  | E51/U54 group, 1537 MiB split DDR, PLIC and MMUART0                            |
| Raspberry Pi 4B      | raspi4b               | Four A72s, 2 GiB RAM backing, GIC distributor and UART0                        |

All presets retain specific coverage notes in the inspector. CPU groups summarize multiple cores in one block; they are not single-core configurations. Fixed CPU counts, firmware carve-outs, security-state access and omitted interrupt domains must be respected when implementing launch recipes.

### Additional source evidence

Paths below are relative to the pinned QEMU submodule at the commit stated above. The source shown in each preset is the entry point; these supplemental files define constants, board setup and register sizes.

- MPS2 variants: `hw/arm/mps2.c` (AN386/AN500 class setup, RAM switches and common UART wiring).
- M33/M55: `hw/arm/mps2-tz.c` (`an505_raminfo`, `an547_raminfo`, PPC tables, `make_uart`, class defaults). `hw/arm/armsse.c` and `hw/arm/armv7m.c` implement the internal CPU subsystem. IRQ labels use external input numbers, not exception slots.
- ZCU102: `hw/arm/xlnx-zcu102.c`, `hw/arm/xlnx-zynqmp.c`, `include/hw/arm/xlnx-zynqmp.h`, and `hw/char/cadence_uart.c`. Only the 4 KiB distributor window is represented, not CPU-interface aliases.
- Versal generations: `hw/arm/xlnx-versal.c` version maps, cluster setup and `versal_create_uart`; `hw/arm/xlnx-versal-virt.c` board setup. GICv3 redistributor size is 128 KiB per represented APU core; peripheral SPI indices are not architectural INTIDs. QEMU does not model the PL or AI Engine.
- NXP: `hw/arm/fsl-imx8mp.c`, `hw/arm/fsl-imx8mm.c`, corresponding `include/hw/arm/fsl-imx8m*.h`, `hw/arm/imx8mp-evk.c`, `hw/arm/imx8mm-evk.c`, and `hw/char/imx_serial.c`. Reserved UART/GIC apertures can exceed implemented register windows; do not equate the two.
- RISC-V virt: `hw/riscv/virt.c`, `include/hw/riscv/virt.h` and `hw/char/serial-mm.c`. PLIC allocation uses the maximum context aperture; UART has 8 byte-spaced registers inside a larger reserved window.
- PolarFire: `hw/riscv/microchip_pfsoc.c`, `include/hw/riscv/microchip_pfsoc.h` and `hw/char/mchp_pfsoc_mmuart.c`. Low DDR is 1 GiB and high DDR is the remainder of the 1537 MiB preset; noncached aliases are deliberately omitted.
- Pi 4: `hw/arm/raspi.c`, `hw/arm/bcm2838.c`, `hw/arm/bcm2835_peripherals.c`, `include/hw/arm/bcm2838.h`, `include/hw/arm/bcm2838_peripherals.h`, and `include/hw/arm/raspi_platform.h`. UART0 has a direct GIC SPI 121 path as well as an omitted legacy path. RAM backing includes VideoCore carve-outs; it is not guest-usable RAM capacity. Pi 4 PCIe/GENET are not implemented by this QEMU model.

Upstream documentation: [Arm boards](https://www.qemu.org/docs/master/system/target-arm.html), [Versal](https://www.qemu.org/docs/master/system/arm/xlnx-versal-virt.html), [i.MX 8M](https://www.qemu.org/docs/master/system/arm/imx8m.html), [RISC-V boards](https://www.qemu.org/docs/master/system/target-riscv.html). Upstream master may describe newer capabilities; the pinned source governs these presets.
