import { boardMetadata } from "./board-metadata";
import { inventories } from "./inventories";
import type { Inventory } from "./inventory";
export const QEMU_COMMIT = "4fc49f46dc95d4a27de2509e7fceb2931e91faeb";
export const GRID_SIZE = 24;
export type Region = { name: string; base: number; size: number };
export type Block = {
  id: string;
  label: string;
  kind: "cpu" | "address-space" | "memory" | "controller" | "peripheral";
  description: string;
  regions: Region[];
  deviceType?: string;
  qomPath?: string;
  status: "implemented" | "stub" | "inactive" | "unsupported" | "routing";
};
export type Connection = {
  id: string;
  source: string;
  target: string;
  kind: "access" | "signal" | "bus";
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
  inventory: Inventory;
  primarySpaceId: string;
};

function projectBoard(
  metadata: (typeof boardMetadata)[number],
  inventory: Inventory,
): Board {
  if (inventory.qemuCommit !== QEMU_COMMIT)
    throw new Error(`Unexpected QEMU revision for ${metadata.id}`);
  const primary =
    inventory.spaces.find((space) => space.names.includes("cpu-memory-0")) ??
    inventory.spaces.find((space) => space.names.includes("memory")) ??
    inventory.spaces[0];
  const blocks: Block[] = [
    {
      id: "sysmem",
      label: "CPU physical address space",
      kind: "address-space",
      status: "routing",
      regions: [],
      description: `Resolved view ${primary.id}: ${primary.names.join(", ")}. Other address spaces are available in Memory Map.`,
    },
  ];
  const byPath = new Map<string, Block>();
  for (const device of inventory.devices) {
    const regions = primary.regions.filter(
      (region) => region.owner === device.path,
    );
    const firstName = regions[0]?.name.split(" @")[0];
    const shortName = device.path.split("/").pop()!;
    const status = !device.realized
      ? "inactive"
      : device.type === "unimplemented-device"
        ? "stub"
        : "implemented";
    const block: Block = {
      id: device.path,
      qomPath: device.path,
      deviceType: device.type,
      status,
      label: firstName ?? `${shortName} · ${device.type}`,
      kind: device.cpu
        ? "cpu"
        : /gic|nvic|plic|interrupt|or-irq|split-irq/.test(device.type)
          ? "controller"
          : "peripheral",
      description: `${device.type}. ${status === "stub" ? "QEMU placeholder: register behavior is not implemented." : status === "inactive" ? "Object exists but is not realized in this configuration." : "Realized QEMU device object."} ${device.path}`,
      regions: regions
        .filter((region) => Number.isSafeInteger(Number(BigInt(region.size))))
        .map((region) => ({
          name: region.name,
          base: Number(BigInt(region.base)),
          size: Number(BigInt(region.size)),
        })),
    };
    byPath.set(device.path, block);
    blocks.push(block);
  }
  // Memory backends and routing containers are QOM objects rather than devices.
  for (const space of inventory.spaces) {
    for (const region of space.regions) {
      if (byPath.has(region.owner)) continue;
      const block: Block = {
        id: region.owner,
        qomPath: region.owner,
        label: region.name.split(" @")[0],
        kind: /ram|rom/.test(region.kind) ? "memory" : "address-space",
        status: /ram|rom/.test(region.kind) ? "implemented" : "routing",
        description: `Memory/routing object ${region.owner}. Additional aliases are visible by selecting their address-space view.`,
        regions: [],
      };
      block.regions = primary.regions
        .filter(
          (r) =>
            r.owner === region.owner &&
            Number.isSafeInteger(Number(BigInt(r.size))),
        )
        .map((r) => ({
          name: r.name,
          base: Number(BigInt(r.base)),
          size: Number(BigInt(r.size)),
        }));
      byPath.set(region.owner, block);
      blocks.push(block);
    }
  }
  const connections: Connection[] = [];
  const resolve = (path: string): string | undefined => {
    let current = path;
    while (current.includes("/")) {
      if (byPath.has(current)) return current;
      current = current.slice(0, current.lastIndexOf("/"));
    }
    return undefined;
  };
  for (const owner of new Set(primary.regions.map((r) => r.owner))) {
    connections.push({
      id: `access:${owner}`,
      source: "sysmem",
      target: owner,
      kind: "access",
      label: "Address decode",
    });
  }
  for (const device of inventory.devices) {
    if (device.cpu)
      connections.push({
        id: `cpu-access:${device.path}`,
        source: device.path,
        target: "sysmem",
        kind: "access",
        label: "CPU view",
      });
    if (device.parentBus) {
      const parent = resolve(device.parentBus);
      if (parent && parent !== device.path)
        connections.push({
          id: `bus:${device.path}`,
          source: parent,
          target: device.path,
          kind: "bus",
          label: device.parentBus.split("/").pop()!,
        });
    }
    for (const signal of device.signals) {
      const target = resolve(signal.target);
      if (!target)
        throw new Error(
          `Unresolved signal: ${device.path}/${signal.output} → ${signal.target}`,
        );
      connections.push({
        id: `signal:${device.path}:${signal.output}`,
        source: device.path,
        target,
        kind: "signal",
        label: `${signal.output} → ${signal.target.slice(target.length + 1)}`,
      });
    }
  }
  if (metadata.id === "raspi4b") {
    for (const [id, label] of [
      ["genet", "GENET Ethernet"],
      ["pcie", "PCIe root port"],
      ["pwm", "PWM"],
    ]) {
      blocks.push({
        id: `unsupported:${id}`,
        label,
        kind: "peripheral",
        status: "unsupported",
        description:
          "Present on physical Raspberry Pi 4 hardware, but not implemented by this QEMU board model. No functional connection or mapped register window is claimed.",
        regions: [],
      });
    }
  }
  return {
    ...metadata,
    inventory,
    primarySpaceId: primary.id,
    configuration: inventory.arguments.join(" "),
    coverage:
      "Captured from paused QEMU 11.1.2: all device objects, connected QOM IRQ/GPIO output links, and resolved memory regions for every exported address-space view. Stub and inactive objects are labeled. Optional hardware absent from these exact arguments is not instantiated. Guest boot and physical-hardware equivalence are not validated. Diagram addresses use the primary CPU view; Memory Map exposes every captured view. QOM signal links include generic GPIO; they are not all interrupts. Internal C-level connections without an exposed QOM output link are outside this capture.",
    blocks,
    connections,
  };
}
export const boards: Board[] = boardMetadata.map((metadata) => {
  const inventory = inventories.find((item) => item.boardId === metadata.id) as
    Inventory | undefined;
  if (!inventory) throw new Error(`Missing inventory for ${metadata.id}`);
  return projectBoard(metadata, inventory);
});
export function hex(value: number | bigint): string {
  return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
}
export function regionRange(region: Region): string {
  return `${hex(region.base)}–${hex(region.base + region.size - 1)}`;
}
export function sourceUrl(board: Board): string {
  return `https://gitlab.com/qemu-project/qemu/-/blob/${QEMU_COMMIT}/${board.source}`;
}
export function validateBoard(board: Board): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const block of board.blocks) {
    if (ids.has(block.id)) errors.push(`Duplicate block: ${block.id}`);
    ids.add(block.id);
  }
  const links = new Set<string>();
  for (const link of board.connections) {
    if (links.has(link.id)) errors.push(`Duplicate connection: ${link.id}`);
    links.add(link.id);
    if (!ids.has(link.source) || !ids.has(link.target))
      errors.push(`Unknown endpoint: ${link.id}`);
  }
  for (const space of board.inventory.spaces) {
    let end = 0n;
    for (const region of space.regions) {
      const base = BigInt(region.base);
      const size = BigInt(region.size);
      if (base < 0n || size <= 0n)
        errors.push(`Invalid region: ${space.id}/${region.name}`);
      if (base < end)
        errors.push(`Overlapping regions: ${space.id}/${region.name}`);
      end = base + size;
    }
  }
  return errors;
}
