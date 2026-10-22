import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { boards, regionRange, validateBoard, type Board } from "./boards";
import { createDiagram, snapGrid } from "./diagram";

const copy = (): Board => structuredClone(boards[0]);
describe("source-derived board models", () => {
  it("has valid nonoverlapping maps and connected represented blocks", () => {
    for (const board of boards) {
      assert.deepEqual(validateBoard(board), []);
      const reachable = new Set(["cpu"]);
      for (let pass = 0; pass < board.blocks.length; pass++) {
        for (const c of board.connections) {
          if (reachable.has(c.source)) reachable.add(c.target);
        }
      }
      assert.equal(reachable.size, board.blocks.length);
    }
  });
  it("rejects nested overlaps, invalid sizes, missing endpoints, and duplicate IDs", () => {
    const board = copy();
    board.blocks[0].regions.push({ name: "bad", base: 0x40000010, size: 16 });
    board.blocks[1].regions.push({ name: "invalid", base: -1, size: 0 });
    board.connections[0].target = "missing";
    board.blocks.push(structuredClone(board.blocks[0]));
    const errors = validateBoard(board);
    for (const prefix of [
      "Overlapping regions",
      "Invalid region",
      "Unknown endpoint",
      "Duplicate block",
    ]) {
      assert.ok(
        errors.some((error) => error.startsWith(prefix)),
        prefix,
      );
    }
  });
  it("preserves board-specific UART maps and interrupt numbering", () => {
    const arm = boards[0];
    const mps = boards[1];
    assert.equal(
      arm.blocks.find((b) => b.id === "uart")!.regions[0].base,
      0x09000000,
    );
    assert.equal(
      arm.connections.find((c) => c.id === "irq-uart")!.label,
      "SPI 1 / INTID 33",
    );
    assert.equal(
      mps.blocks.find((b) => b.id === "uart")!.regions[0].base,
      0x40004000,
    );
    assert.equal(
      mps.connections.find((c) => c.id === "irq-uart")!.label,
      "RX IRQ 0 · TX IRQ 1",
    );
    assert.equal(
      regionRange(arm.blocks.find((b) => b.id === "ram")!.regions[0]),
      "0x40000000–0x47FFFFFF",
    );
  });
  it("projects fixed topology onto a snapping layout without sharing mutable positions", () => {
    for (const board of boards) {
      const first = createDiagram(board);
      const second = createDiagram(board);
      assert.equal(first.edges.length, board.connections.length);
      assert.equal(first.nodes.length, board.blocks.length);
      for (const node of first.nodes) {
        assert.equal(node.position.x % snapGrid[0], 0);
        assert.equal(node.position.y % snapGrid[1], 0);
        assert.equal(node.deletable, false);
      }
      first.nodes[0].position.x = 999;
      assert.notEqual(second.nodes[0].position.x, 999);
      for (const edge of first.edges) {
        assert.equal(edge.deletable, false);
        assert.equal(
          edge.sourceHandle,
          board.connections.find((connection) => connection.id === edge.id)!
            .kind === "interrupt"
            ? "irq-out"
            : "access-out",
        );
      }
    }
  });
});

it("keeps library identities unique and preserves board-specific console routing", () => {
  assert.equal(new Set(boards.map((b) => b.id)).size, boards.length);
  assert.equal(new Set(boards.map((b) => b.machine)).size, boards.length);
  const consoles = [
    ["mps2-an505", 0x40200000, "RX IRQ 32 · TX IRQ 33 · combined IRQ 42"],
    ["mps3-an547", 0x49303000, "RX IRQ 33 · TX IRQ 34 · combined IRQ 43"],
    ["riscv-virt", 0x10000000, "PLIC source 10"],
    ["xlnx-zcu102", 0xff000000, "SPI 21 / INTID 53"],
    ["amd-versal-virt", 0xff000000, "SPI 18 / INTID 50"],
    ["amd-versal2-virt", 0xf1920000, "SPI 25 / INTID 57"],
    ["imx8mp-evk", 0x30890000, "SPI 27 / INTID 59"],
    ["imx8mm-evk", 0x30890000, "SPI 27 / INTID 59"],
    ["microchip-icicle-kit", 0x20000000, "PLIC source 90"],
    ["raspi4b", 0xfe201000, "SPI 121 / INTID 153"],
  ] as const;
  for (const [id, base, irq] of consoles) {
    const board = boards.find((b) => b.id === id)!;
    assert.ok(board, id);
    assert.equal(
      board.blocks.find((b) => b.id === "uart")!.regions[0].base,
      base,
      id,
    );
    assert.equal(
      board.connections.find((c) => c.id === "irq-uart")!.label,
      irq,
      id,
    );
  }
});
it("distinguishes MPS2 variants and split PolarFire DDR without alias double-counting", () => {
  const m4 = boards.find((b) => b.id === "mps2-an386")!;
  const m7 = boards.find((b) => b.id === "mps2-an500")!;
  assert.equal(
    m4.blocks.find((b) => b.id === "ram")!.regions[0].base,
    0x21000000,
  );
  assert.equal(
    m7.blocks.find((b) => b.id === "ram")!.regions[0].base,
    0x60000000,
  );
  assert.ok(!m7.blocks.some((b) => b.id === "bram"));
  const ddr = boards
    .find((b) => b.id === "microchip-icicle-kit")!
    .blocks.find((b) => b.id === "ram")!.regions;
  assert.equal(
    ddr.reduce((sum, region) => sum + region.size, 0),
    1537 * 1024 * 1024,
  );
  assert.equal(ddr[1].base, 0x1000000000);
});
