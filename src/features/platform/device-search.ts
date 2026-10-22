import type { Block } from "./boards";

// Compatibility normalization folds superscripts/subscripts (², ₂, ³, ₃)
// into ordinary digits before case-insensitive matching.
export function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").toLowerCase().trim();
}

export function searchBlocks(blocks: Block[], query: string): Block[] {
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return blocks.filter((block) => {
    const searchable = normalizeSearchText(
      `${block.label} ${block.deviceType ?? ""} ${block.qomPath ?? ""} ${block.status} ${block.regions.map((r) => r.base.toString(16)).join(" ")}`,
    );
    return words.every((word) => searchable.includes(word));
  });
}
