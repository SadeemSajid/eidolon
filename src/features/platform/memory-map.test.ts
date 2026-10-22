import { it } from "node:test";
import assert from "node:assert/strict";
import { boards } from "./boards";
import { memorySlots, memorySize } from "./memory-map";

it("orders slots and accounts for every byte up to the highest represented address", () => {
  for (const board of boards) {
    const slots = memorySlots(board);
    assert.equal(slots[0].base, 0);
    for (let i = 1; i < slots.length; i++) {
      assert.equal(slots[i].base, slots[i - 1].base + slots[i - 1].size);
    }
    assert.equal(
      slots.filter((slot) => slot.blockId).length,
      board.blocks.flatMap((block) => block.regions).length,
    );
    assert.ok(slots.every((slot) => slot.size > 0));
  }
});
it("keeps adjacent flash banks separate and treats missing ranges as unknown", () => {
  const slots = memorySlots(boards[0]);
  assert.deepEqual(
    slots.slice(0, 2).map((slot) => slot.name),
    ["Flash 0", "Flash 1"],
  );
  const gap = slots.find((slot) => !slot.blockId)!;
  assert.equal(gap.base, 0x08020000);
  assert.equal(gap.base + gap.size, 0x09000000);
  assert.equal(gap.label, "Not shown in core view");
  assert.equal(
    slots[slots.length - 1].base + slots[slots.length - 1].size,
    0x48000000,
  );
});
it("formats binary units without rounding away bytes", () => {
  assert.equal(memorySize(128 * 2 ** 20), "128 MiB");
  assert.equal(memorySize(4096), "4 KiB");
  assert.equal(memorySize(24), "24 B");
});
