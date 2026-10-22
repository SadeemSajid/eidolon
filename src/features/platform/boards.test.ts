import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadBoard, QEMU_COMMIT, validateBoard } from "./boards";
import { createDiagram, snapGrid } from "./diagram";
import { boardMetadata } from "./board-metadata";

const boards = await Promise.all(boardMetadata.map(({ id }) => loadBoard(id)));

it("reuses board loads and rejects unknown presets", async () => {
  const first = loadBoard(boardMetadata[0].id);
  assert.equal(loadBoard(boardMetadata[0].id), first);
  assert.equal(await first, boards[0]);
  await assert.rejects(loadBoard("missing-board"), /Unknown board/);
});

describe("captured QEMU inventories", () => {
  it("has one exact-release capture for every preset and no missing ranges/devices", () => {
    assert.equal(boards.length, 14);
    assert.equal(new Set(boards.map((b) => b.id)).size, boards.length);
    for (const board of boards) {
      assert.equal(board.inventory.qemuCommit, QEMU_COMMIT);
      assert.deepEqual(board.inventory.version.qemu, {
        major: 11,
        minor: 1,
        micro: 2,
      });
      assert.deepEqual(validateBoard(board), [], board.id);
      for (const device of board.inventory.devices)
        assert.ok(
          board.blocks.some((b) => b.id === device.path),
          `${board.id}: ${device.path}`,
        );
      for (const space of board.inventory.spaces)
        for (const region of space.regions)
          assert.ok(
            board.blocks.some((b) => b.id === region.owner),
            `${board.id}: ${region.owner}`,
          );
    }
  });
  it("preserves every captured connected signal and detects dangling connections", () => {
    for (const board of boards) {
      assert.equal(
        board.connections.filter((c) => c.kind === "signal").length,
        board.inventory.devices.reduce((sum, d) => sum + d.signals.length, 0),
        board.id,
      );
    }
    const bad = structuredClone(boards[0]);
    bad.connections[0].target = "missing";
    assert.ok(
      validateBoard(bad).some((error) => error.startsWith("Unknown endpoint")),
    );
  });
  it("includes Pi 4 GPIO, I2C, SPI, USB, storage and DMA but labels unsupported Ethernet", () => {
    const board = boards.find((b) => b.id === "raspi4b")!;
    for (const type of [
      "bcm2838-gpio",
      "bcm2835-i2c",
      "bcm2835-spi",
      "dwc2-usb",
      "bcm2835-dma",
      "generic-sdhci",
    ]) {
      assert.ok(
        board.blocks.some(
          (b) => b.deviceType === type && b.status === "implemented",
        ),
        type,
      );
    }
    const gpio = board.blocks.find(
      (b) => b.qomPath === "/machine/soc/peripherals/gpio",
    )!;
    assert.equal(gpio.regions[0].base, 0xfe200000);
    const ethernet = board.blocks.find((b) => b.id === "unsupported:genet")!;
    assert.equal(ethernet.status, "unsupported");
    assert.deepEqual(ethernet.regions, []);
    assert.ok(
      !board.connections.some(
        (c) => c.target === ethernet.id || c.source === ethernet.id,
      ),
    );
    assert.ok(board.blocks.some((b) => b.status === "stub"));
  });
  it("includes heterogeneous CPUs, additional peripherals and memory aliases", () => {
    const versal = boards.find((b) => b.id === "amd-versal2-virt")!;
    assert.equal(
      versal.blocks.filter((b) => b.deviceType === "cortex-r52-arm-cpu").length,
      10,
    );
    assert.equal(
      versal.blocks.filter((b) => b.deviceType === "cortex-a78ae-arm-cpu")
        .length,
      8,
    );
    const mps = boards.find((b) => b.id === "mps2-an385")!;
    assert.equal(
      mps.blocks.filter((b) => b.deviceType === "cmsdk-apb-uart").length,
      5,
    );
    const ram = mps.inventory.spaces.find(
      (s) => s.id === mps.primarySpaceId,
    )!.regions;
    assert.ok(ram.some((r) => BigInt(r.base) === 0x00400000n));
  });
  it("projects every block once with unique grid positions and fixed topology", () => {
    for (const board of boards) {
      const diagram = createDiagram(board);
      assert.equal(diagram.nodes.length, board.blocks.length);
      assert.equal(diagram.edges.length, board.connections.length);
      assert.equal(
        new Set(diagram.nodes.map((n) => `${n.position.x},${n.position.y}`))
          .size,
        board.blocks.length,
      );
      for (const node of diagram.nodes) {
        assert.equal(node.position.x % snapGrid[0], 0);
        assert.equal(node.position.y % snapGrid[1], 0);
        assert.equal(node.deletable, false);
      }
    }
  });
});
