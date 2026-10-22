import type { Board, Block, Region } from "./boards";

export type MemorySlot = Region & {
  blockId?: string;
  kind?: Block["kind"];
  label: string;
};

// Gaps are outside the curated inventory, not necessarily free or unmapped.
export function memorySlots(board: Board): MemorySlot[] {
  const regions = board.blocks
    .flatMap((block) =>
      block.regions.map((region) => ({
        ...region,
        blockId: block.id,
        kind: block.kind,
        label: block.label,
      })),
    )
    .sort((a, b) => a.base - b.base);
  const slots: MemorySlot[] = [];
  let cursor = 0;
  for (const region of regions) {
    if (region.base > cursor) {
      slots.push({
        name: "Not shown",
        label: "Not shown in core view",
        base: cursor,
        size: region.base - cursor,
      });
    }
    slots.push(region);
    cursor = Math.max(cursor, region.base + region.size);
  }
  return slots;
}

export function memorySize(bytes: number): string {
  for (const [unit, size] of [
    ["GiB", 2 ** 30],
    ["MiB", 2 ** 20],
    ["KiB", 2 ** 10],
  ] as const) {
    if (bytes >= size && bytes % size === 0) return `${bytes / size} ${unit}`;
  }
  return `${bytes.toLocaleString()} B`;
}
