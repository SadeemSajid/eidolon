import type { Board, Block, Region } from "./boards";

type CorePreset = {
  id: string;
  name: string;
  machine: string;
  cpu: string;
  configuration: string;
  source: string;
  coverage: string;
  ram: Region[];
  controller: string;
  controllerRegions: Region[];
  uart: string;
  uartBase: number;
  uartSize?: number;
  uartIrq: string;
  extra?: Block[];
};
const r = (name: string, base: number, size: number): Region => ({
  name,
  base,
  size,
});
function core(p: CorePreset): Board {
  const blocks: Block[] = [
    {
      id: "cpu",
      label: p.cpu,
      kind: "cpu",
      description: p.configuration,
      regions: [],
    },
    {
      id: "sysmem",
      label: "Physical address space",
      kind: "address-space",
      description:
        "Logical address routing; no physical bus timing is implied.",
      regions: [],
    },
    {
      id: "ram",
      label: "System RAM",
      kind: "memory",
      description:
        "Explicit preset capacity. See each range; not a maximum-capacity claim.",
      regions: p.ram,
    },
    {
      id: "intc",
      label: p.controller,
      kind: "controller",
      description:
        "Interrupt delivery is summarized for the represented CPU group. Only listed register regions are shown.",
      regions: p.controllerRegions,
    },
    {
      id: "uart",
      label: p.uart,
      kind: "peripheral",
      description: `Console register window. ${p.uartIrq}. Other serial ports are omitted.`,
      regions: [r("Registers", p.uartBase, p.uartSize ?? 0x1000)],
    },
    ...(p.extra ?? []),
  ];
  return {
    ...p,
    blocks,
    coverage: `Core view only; source-derived, not runtime-tested. ${p.coverage}`,
    connections: [
      {
        id: "cpu-access",
        source: "cpu",
        target: "sysmem",
        kind: "access",
        label: "Physical access",
      },
      ...blocks
        .filter((b) => b.id !== "cpu" && b.id !== "sysmem")
        .map((b) => ({
          id: `access-${b.id}`,
          source: "sysmem",
          target: b.id,
          kind: "access" as const,
          label: b.kind === "memory" ? "Memory" : "MMIO",
        })),
      {
        id: "irq-uart",
        source: "uart",
        target: "intc",
        kind: "interrupt",
        label: p.uartIrq,
      },
      {
        id: "irq-controller",
        source: "intc",
        target: "cpu",
        kind: "interrupt",
        label:
          p.controller === "PLIC"
            ? "External interrupts"
            : p.controller.startsWith("NVIC")
              ? "Exception delivery"
              : "IRQ / FIQ",
      },
    ],
  };
}
const omittedSoc =
  "Additional peripherals, clocks/resets, DMA, storage, networking, aliases and CPU-internal timers are omitted. Firmware and boot recipes are not integrated.";
export const additionalBoards: Board[] = [
  ...([false, true] as const).map((m55) =>
    core({
      id: m55 ? "mps3-an547" : "mps2-an505",
      name: m55 ? "MPS3 AN547 · Cortex-M55" : "MPS2 AN505 · Cortex-M33",
      machine: m55 ? "mps3-an547" : "mps2-an505",
      cpu: m55 ? "Cortex-M55" : "Cortex-M33",
      configuration: m55
        ? "1 M55 · SSE-300 · 32 MHz CPU / 25 MHz APB · partial nonsecure map"
        : "1 M33 · IoT Kit · 20 MHz · partial nonsecure map",
      source: "hw/arm/mps2-tz.c",
      coverage:
        "TrustZone aliases, protection controllers, other SRAM/DDR, ROM/boot regions, internal SysTick, UART overflow OR gate and other peripherals are omitted. Listed UART accesses are subject to security/protection configuration; the map does not imply access from every security state. NVIC window aggregates system-control registers.",
      ram: m55
        ? [
            r("SRAM", 0x01000000, 2 * 1024 * 1024),
            r("SRAM 2", 0x21000000, 4 * 1024 * 1024),
          ]
        : [
            r("SSRAM0", 0, 4 * 1024 * 1024),
            r("SSRAM1", 0x28000000, 2 * 1024 * 1024),
            r("SSRAM2", 0x28200000, 2 * 1024 * 1024),
          ],
      controller: "NVIC / system control",
      controllerRegions: [r("System control space", 0xe000e000, 0x1000)],
      uart: "CMSDK APB UART0",
      uartBase: m55 ? 0x49303000 : 0x40200000,
      uartIrq: m55
        ? "RX IRQ 33 · TX IRQ 34 · combined IRQ 43"
        : "RX IRQ 32 · TX IRQ 33 · combined IRQ 42",
    }),
  ),

  core({
    id: "riscv-virt",
    name: "RISC-V virt · RV64",
    machine: "virt",
    cpu: "RV64",
    configuration:
      "1 RV64 hart · 128 MiB RAM · TCG · aia=none · aclint=off · one socket",
    source: "hw/riscv/virt.c",
    coverage:
      "PLIC aperture size is 0x600000 from VIRT_PLIC_SIZE(512 × 2). UART shows its 8 implemented byte registers, not the 0x100 reserved aperture. CLINT, boot ROM, test device, RTC, flash, PCIe, fw_cfg and virtio transports are omitted.",
    ram: [r("RAM", 0x80000000, 0x08000000)],
    controller: "PLIC",
    controllerRegions: [r("PLIC", 0x0c000000, 0x600000)],
    uart: "NS16550 UART0",
    uartBase: 0x10000000,
    uartSize: 8,
    uartIrq: "PLIC source 10",
  }),
  core({
    id: "xlnx-zcu102",
    name: "AMD ZCU102 · ZynqMP",
    machine: "xlnx-zcu102",
    cpu: "4 × Cortex-A53 · APU",
    configuration:
      "APU core view · 4 A53 cores · 1 GiB DDR · secure=off · virtualization=off",
    source: "hw/arm/xlnx-zynqmp.c",
    coverage: `Two Cortex-R5F cores and their separate interrupt domain are omitted; this is the APU view. GIC CPU interfaces/aliases omitted. ${omittedSoc}`,
    ram: [r("DDR low", 0, 0x40000000)],
    controller: "GICv2 · APU",
    controllerRegions: [r("Distributor", 0xf9010000, 0x1000)],
    uart: "Cadence UART0",
    uartBase: 0xff000000,
    uartIrq: "SPI 21 / INTID 53",
  }),
  ...([false, true] as const).map((gen2) =>
    core({
      id: gen2 ? "amd-versal2-virt" : "amd-versal-virt",
      name: gen2 ? "AMD Versal Gen 2" : "AMD Versal",
      machine: gen2 ? "amd-versal2-virt" : "amd-versal-virt",
      cpu: gen2 ? "8 × Cortex-A78AE · APU" : "2 × Cortex-A72 · APU",
      configuration: `${gen2 ? "8 A78AE" : "2 A72"} APU cores · 1 GiB DDR · TCG · APU core view`,
      source: "hw/arm/xlnx-versal.c",
      coverage: `${gen2 ? "Ten Cortex-R52 cores" : "Two Cortex-R5F cores"}, their interrupt domains and APU ITS are omitted. QEMU does not model programmable logic or the AI Engine. ${omittedSoc}`,
      ram: [r("DDR channel 0", 0, 0x40000000)],
      controller: "GICv3 · APU",
      controllerRegions: [
        r("Distributor", gen2 ? 0xe2000000 : 0xf9000000, 0x10000),
        r(
          "Redistributors",
          gen2 ? 0xe2060000 : 0xf9080000,
          (gen2 ? 8 : 2) * 0x20000,
        ),
      ],
      uart: "PL011 UART0",
      uartBase: gen2 ? 0xf1920000 : 0xff000000,
      uartIrq: gen2 ? "SPI 25 / INTID 57" : "SPI 18 / INTID 50",
    }),
  ),
  ...([false, true] as const).map((mini) =>
    core({
      id: mini ? "imx8mm-evk" : "imx8mp-evk",
      name: mini ? "NXP i.MX 8M Mini EVK" : "NXP i.MX 8M Plus EVK",
      machine: mini ? "imx8mm-evk" : "imx8mp-evk",
      cpu: "4 × Cortex-A53",
      configuration: "4 Cortex-A53 cores · 1 GiB RAM · TCG · UART2 console",
      source: mini ? "hw/arm/fsl-imx8mm.c" : "hw/arm/fsl-imx8mp.c",
      coverage: `Only the application CPUs are modeled here; do not infer support for the companion MCU. The GIC distributor shows its implemented 64 KiB window; UART2 shows its implemented 4 KiB registers rather than the reserved 64 KiB aperture. ${omittedSoc}`,
      ram: [r("DDR", 0x40000000, 0x40000000)],
      controller: "GICv3",
      controllerRegions: [
        r("Distributor", 0x38800000, 0x10000),
        r("Redistributors", 0x38880000, 0x80000),
      ],
      uart: "i.MX UART2",
      uartBase: 0x30890000,
      uartIrq: "SPI 27 / INTID 59",
      extra: [
        {
          id: "ocram",
          label: "On-chip RAM",
          kind: "memory",
          description: "Primary OCRAM; secure OCRAM is omitted.",
          regions: [r("OCRAM", 0x00900000, (mini ? 256 : 576) * 1024)],
        },
      ],
    }),
  ),
  core({
    id: "microchip-icicle-kit",
    name: "Microchip PolarFire SoC Icicle",
    machine: "microchip-icicle-kit",
    cpu: "E51 + 4 × U54",
    configuration:
      "5 harts · 1537 MiB RAM split into 1 GiB low + 513 MiB high · TCG",
    source: "hw/riscv/microchip_pfsoc.c",
    coverage: `CLINT, L2 LIM, ROM, eNVM, DDR aliases and fabric windows are omitted. Low/high ranges are distinct backing slices; aliases are not additional RAM. ${omittedSoc}`,
    ram: [
      r("DDR low", 0x80000000, 0x40000000),
      r("DDR high", 0x1000000000, 513 * 1024 * 1024),
    ],
    controller: "PLIC",
    controllerRegions: [r("PLIC", 0x0c000000, 0x4000000)],
    uart: "MMUART0",
    uartBase: 0x20000000,
    uartIrq: "PLIC source 90",
  }),
  core({
    id: "raspi4b",
    name: "Raspberry Pi 4 Model B",
    machine: "raspi4b",
    cpu: "4 × Cortex-A72",
    configuration:
      "4 Cortex-A72 cores · fixed 2 GiB RAM backing · firmware reserves VideoCore memory",
    source: "hw/arm/bcm2838.c",
    coverage:
      "RAM shows QEMU's full 2 GiB backing mapping, including firmware carve-outs; it is not all available to a guest OS. GIC CPU interfaces, legacy interrupt path, VideoCore aliases, mailbox, SD, USB and other peripherals are omitted. QEMU does not implement Pi 4 PCIe root port or GENET Ethernet. Not a Raspberry Pi 5 model.",
    ram: [r("RAM backing", 0, 0x80000000)],
    controller: "GICv2",
    controllerRegions: [r("Distributor", 0xff841000, 0x1000)],
    uart: "PL011 UART0",
    uartBase: 0xfe201000,
    uartIrq: "SPI 121 / INTID 153",
  }),
];

export function mpsVariants(base: Board): Board[] {
  return [
    { machine: "mps2-an386", cpu: "Cortex-M4", m7: false },
    { machine: "mps2-an500", cpu: "Cortex-M7", m7: true },
  ].map(({ machine, cpu, m7 }) => {
    const board = structuredClone(base);
    board.id = machine;
    board.machine = machine;
    board.cpu = cpu.toLowerCase();
    board.name = `MPS2 ${m7 ? "AN500" : "AN386"} · ${cpu}`;
    const processor = board.blocks.find((b) => b.id === "cpu")!;
    processor.label = cpu;
    processor.description = `Fixed ${cpu} for ${machine}.`;
    if (m7) {
      board.blocks = board.blocks.filter((b) => b.id !== "bram");
      board.connections = board.connections.filter(
        (c) => c.source !== "bram" && c.target !== "bram",
      );
      board.blocks.find((b) => b.id === "ram")!.regions[0].base = 0x60000000;
      board.coverage = board.coverage.replace(
        "RAM aliases",
        "RAM aliases (AN500 has no separate block RAM)",
      );
    }
    return board;
  });
}
