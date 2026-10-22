import type { Board, Block } from "./boards";
export type MemorySlot = {
  name: string;
  base: bigint;
  size: bigint;
  label: string;
  blockId?: string;
  kind?: Block["kind"];
  status?: Block["status"];
  mappingKind?: string;
};
export function memorySlots(
  board: Board,
  spaceId = board.primarySpaceId,
): MemorySlot[] {
  const view = board.inventory.spaces.find((space) => space.id === spaceId);
  if (!view) throw new Error(`Unknown address space: ${spaceId}`);
  const slots: MemorySlot[] = [];
  let cursor = 0n;
  for (const region of view.regions) {
    const base = BigInt(region.base);
    const size = BigInt(region.size);
    if (base > cursor)
      slots.push({
        name: "Unmapped in this captured view",
        label: "Unmapped",
        base: cursor,
        size: base - cursor,
      });
    const block = board.blocks.find((block) => block.id === region.owner);
    slots.push({
      name: region.name,
      base,
      size,
      blockId: region.owner,
      label: block?.label ?? region.name,
      kind: block?.kind,
      status: block?.status,
      mappingKind: region.kind,
    });
    cursor = base + size;
  }
  return slots;
}
export function memorySize(bytes: number | bigint): string {
  const value = BigInt(bytes);
  for (const [unit, size] of [
    ["EiB", 1n << 60n],
    ["PiB", 1n << 50n],
    ["TiB", 1n << 40n],
    ["GiB", 1n << 30n],
    ["MiB", 1n << 20n],
    ["KiB", 1n << 10n],
  ] as const) {
    if (value >= size && value % size === 0n) return `${value / size} ${unit}`;
  }
  return `${value.toLocaleString()} B`;
}
