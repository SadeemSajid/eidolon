import { it } from "node:test";
import assert from "node:assert/strict";
import { boards } from "./boards";
import { memorySlots, memorySize } from "./memory-map";

it("accounts for every captured mapping in every separate address space", () => {
  for (const board of boards)
    for (const view of board.inventory.spaces) {
      const slots = memorySlots(board, view.id);
      const occupied = slots.filter((slot) => slot.blockId);
      assert.equal(
        occupied.length,
        view.regions.length,
        `${board.id}/${view.id}`,
      );
      for (let i = 0; i < occupied.length; i++) {
        assert.equal(occupied[i].base, BigInt(view.regions[i].base));
        assert.equal(occupied[i].size, BigInt(view.regions[i].size));
      }
      for (let i = 1; i < slots.length; i++)
        assert.equal(slots[i].base, slots[i - 1].base + slots[i - 1].size);
    }
});
it("preserves full 64-bit routing windows without JS precision loss", () => {
  const board = boards.find((b) => b.id === "mps2-an505")!;
  const view = board.inventory.spaces.find((s) =>
    s.regions.some((r) => r.size === "0x10000000000000000"),
  )!;
  const slot = memorySlots(board, view.id)[0];
  assert.equal(slot.size, 1n << 64n);
  assert.equal(slot.base + slot.size - 1n, 0xffffffffffffffffn);
  assert.equal(memorySize(slot.size), "16 EiB");
});
it("distinguishes CPU and GPU views of Pi 4 GPIO", () => {
  const board = boards.find((b) => b.id === "raspi4b")!;
  const owner = "/machine/soc/peripherals/gpio";
  assert.ok(
    memorySlots(board).some(
      (s) => s.blockId === owner && s.base === 0xfe200000n,
    ),
  );
  const gpu = board.inventory.spaces.find((s) =>
    s.names.includes("bcm2835-dma-memory"),
  )!;
  assert.ok(
    memorySlots(board, gpu.id).some(
      (s) => s.blockId === owner && s.base === 0x7e200000n,
    ),
  );
});
it("formats binary units without rounding", () => {
  assert.equal(memorySize(128 * 2 ** 20), "128 MiB");
  assert.equal(memorySize(4096), "4 KiB");
  assert.equal(memorySize(24), "24 B");
});
