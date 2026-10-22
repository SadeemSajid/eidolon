import { additionalBoards, mpsVariants } from "./additional-boards";

// Facts transcribed from the pinned QEMU source; no upstream implementation code.
export const QEMU_COMMIT = "4fc49f46dc95d4a27de2509e7fceb2931e91faeb";
export const GRID_SIZE = 24;
export type Region = { name: string; base: number; size: number };
export type Block = {
  id: string;
  label: string;
  kind: "cpu" | "address-space" | "memory" | "controller" | "peripheral";
  description: string;
  regions: Region[];
};
export type Connection = {
  id: string;
  source: string;
  target: string;
  kind: "access" | "interrupt";
  label: string;
};
export type Board = {
  id: string;
  name: string;
  machine: string;
  cpu: string;
  configuration: string;
  source: string;
  coverage: string;
  blocks: Block[];
  connections: Connection[];
};
const region = (name: string, base: number, size: number): Region => ({
  name,
  base,
  size,
});
const block = (
  id: string,
  label: string,
  kind: Block["kind"],
  description: string,
  regions: Region[] = [],
): Block => ({ id, label, kind, description, regions });
const access = (target: string): Connection => ({
  id: `access-${target}`,
  source: "sysmem",
  target,
  kind: "access",
  label: ["ram", "flash", "ssram1", "ssram23", "bram"].includes(target)
    ? "Memory"
    : "MMIO",
});
const irq = (source: string, target: string, label: string): Connection => ({
  id: `irq-${source}`,
  source,
  target,
  kind: "interrupt",
  label,
});
const cpuAccess: Connection = {
  id: "cpu-access",
  source: "cpu",
  target: "sysmem",
  kind: "access",
  label: "Physical access",
};

export const boards: Board[] = [
  {
    id: "arm-virt-a55",
    name: "Arm virt · Cortex-A55",
    machine: "virt-11.1",
    cpu: "cortex-a55",
    configuration:
      "1 CPU · 128 MiB RAM · TCG · GICv2 · secure=off · virtualization=off · highmem=off · msi=off",
    source: "hw/arm/virt.c",
    coverage:
      "Core diagram. PCIe windows, fw_cfg, virtio transports, platform bus, ACPI devices, and internal CPU timers are omitted. Optional secure devices and additional UARTs are not enabled. This is a source-derived view, not a live runtime inventory.",
    blocks: [
      block(
        "cpu",
        "Cortex-A55",
        "cpu",
        "One AArch64 CPU; interrupt input from GICv2.",
      ),
      block(
        "sysmem",
        "Physical address space",
        "address-space",
        "Logical QEMU system-memory routing; does not imply a modeled AXI bus.",
      ),
      block(
        "ram",
        "System RAM · 128 MiB",
        "memory",
        "Preset RAM size, not the maximum supported by QEMU.",
        [region("RAM", 0x40000000, 0x08000000)],
      ),
      block(
        "flash",
        "CFI flash · 2 × 64 MiB",
        "memory",
        "Two flash banks; contents require separately supplied firmware.",
        [
          region("Flash 0", 0, 0x04000000),
          region("Flash 1", 0x04000000, 0x04000000),
        ],
      ),
      block(
        "gic",
        "GICv2",
        "controller",
        "Distributor and CPU interface. SPI indices are relative; architectural INTID = SPI + 32.",
        [
          region("Distributor", 0x08000000, 0x10000),
          region("CPU interface", 0x08010000, 0x10000),
        ],
      ),
      block(
        "uart",
        "PL011 UART0",
        "peripheral",
        "Primary nonsecure serial console. SPI 1 is architectural INTID 33.",
        [region("Registers", 0x09000000, 0x1000)],
      ),
      block(
        "rtc",
        "PL031 RTC",
        "peripheral",
        "Real-time clock. SPI 2 is architectural INTID 34.",
        [region("Registers", 0x09010000, 0x1000)],
      ),
      block(
        "gpio",
        "PL061 GPIO",
        "peripheral",
        "Nonsecure GPIO controller. SPI 7 is architectural INTID 39.",
        [region("Registers", 0x09030000, 0x1000)],
      ),
    ],
    connections: [
      cpuAccess,
      ...["ram", "flash", "gic", "uart", "rtc", "gpio"].map(access),
      irq("uart", "gic", "SPI 1 / INTID 33"),
      irq("rtc", "gic", "SPI 2 / INTID 34"),
      irq("gpio", "gic", "SPI 7 / INTID 39"),
      irq("gic", "cpu", "IRQ / FIQ"),
    ],
  },
  {
    id: "mps2-an385",
    name: "MPS2 AN385 · Cortex-M3",
    machine: "mps2-an385",
    cpu: "cortex-m3",
    configuration:
      "1 CPU · 16 MiB PSRAM + fixed SRAM · 25 MHz system clock · 32 external IRQ lines",
    source: "hw/arm/mps2.c",
    coverage:
      "Core diagram. RAM aliases, UART1–4, UART overflow OR gate, dual timer, watchdog, SPI, I²C, Ethernet, FPGA control/IO, and internal SysTick are omitted. GPIO regions are unimplemented QEMU stubs and are not presented as functional devices. This is not the complete board inventory.",
    blocks: [
      block(
        "cpu",
        "Cortex-M3",
        "cpu",
        "Fixed CPU for AN385; firmware begins at the board reset vector.",
      ),
      block(
        "sysmem",
        "Physical address space",
        "address-space",
        "Logical system-memory routing, not a cycle-accurate AHB/APB implementation.",
      ),
      block(
        "ssram1",
        "ZBT SSRAM1 · 4 MiB",
        "memory",
        "Boot/vector memory. Alias at 0x00400000 is omitted from this view.",
        [region("SSRAM1", 0, 0x400000)],
      ),
      block(
        "ssram23",
        "ZBT SSRAM2/3 · 4 MiB",
        "memory",
        "Alias at 0x20400000 is omitted from this view.",
        [region("SSRAM2/3", 0x20000000, 0x400000)],
      ),
      block(
        "ram",
        "PSRAM · 16 MiB",
        "memory",
        "QEMU requires this fixed PSRAM size for AN385.",
        [region("PSRAM", 0x21000000, 0x1000000)],
      ),
      block(
        "bram",
        "Block RAM · 16 KiB",
        "memory",
        "Three mirrored regions are omitted. Low-memory remapping is not implemented by QEMU.",
        [region("Block RAM", 0x01000000, 0x4000)],
      ),
      block(
        "nvic",
        "NVIC / system control",
        "controller",
        "Part of the Armv7-M subsystem. External IRQ numbering excludes the 16 core exception slots.",
        [region("System control space", 0xe000e000, 0x1000)],
      ),
      block(
        "uart",
        "CMSDK APB UART0",
        "peripheral",
        "RX external IRQ 0 (exception 16); TX external IRQ 1 (exception 17). Overflow routes through a shared OR gate to external IRQ 12 (omitted).",
        [region("Registers", 0x40004000, 0x1000)],
      ),
      block(
        "timer",
        "CMSDK APB timer0",
        "peripheral",
        "25 MHz peripheral clock; external IRQ 8 (exception 24).",
        [region("Registers", 0x40000000, 0x1000)],
      ),
    ],
    connections: [
      cpuAccess,
      ...["ssram1", "ssram23", "ram", "bram", "nvic", "uart", "timer"].map(
        access,
      ),
      irq("uart", "nvic", "RX IRQ 0 · TX IRQ 1"),
      irq("timer", "nvic", "External IRQ 8"),
      irq("nvic", "cpu", "Exception delivery"),
    ],
  },
];

boards.push(...mpsVariants(boards[1]), ...additionalBoards);

export function hex(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
}
export function regionRange(region: Region): string {
  return `${hex(region.base)}–${hex(region.base + region.size - 1)}`;
}
export function sourceUrl(board: Board): string {
  return `https://gitlab.com/qemu-project/qemu/-/blob/${QEMU_COMMIT}/${board.source}`;
}
// Validate the represented flat map, not the full board or an executable design.
export function validateBoard(board: Board): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of board.blocks) {
    if (ids.has(item.id)) errors.push(`Duplicate block: ${item.id}`);
    ids.add(item.id);
  }
  const connectionIds = new Set<string>();
  for (const connection of board.connections) {
    if (connectionIds.has(connection.id))
      errors.push(`Duplicate connection: ${connection.id}`);
    connectionIds.add(connection.id);
    if (!ids.has(connection.source) || !ids.has(connection.target))
      errors.push(`Unknown endpoint: ${connection.id}`);
  }
  const regions = board.blocks.flatMap((item) =>
    item.regions.map((r) => ({ ...r, block: item.id })),
  );
  for (const r of regions) {
    if (
      !Number.isSafeInteger(r.base) ||
      !Number.isSafeInteger(r.size) ||
      r.base < 0 ||
      r.size <= 0 ||
      !Number.isSafeInteger(r.base + r.size)
    )
      errors.push(`Invalid region: ${r.block}/${r.name}`);
  }
  const sorted = [...regions].sort((a, b) => a.base - b.base);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].base < sorted[i].base + sorted[i].size)
        errors.push(
          `Overlapping regions: ${sorted[i].block}/${sorted[i].name} and ${sorted[j].block}/${sorted[j].name}`,
        );
    }
  }
  return errors;
}
