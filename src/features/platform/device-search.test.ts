import { it } from "node:test";
import assert from "node:assert/strict";
import { loadBoard, type Block } from "./boards";
import { searchBlocks } from "./device-search";
import { createDiagram, highlightDiagram } from "./diagram";
import { boardMetadata } from "./board-metadata";

const boards = await Promise.all(boardMetadata.map(({ id }) => loadBoard(id)));

const board = boards.find((b) => b.id === "raspi4b")!;
it("returns all matching device instances and searches Unicode names, types, paths and addresses", () => {
  const i2c = searchBlocks(board.blocks, "I²C");
  assert.ok(i2c.length >= 3);
  assert.deepEqual(
    i2c.map((b) => b.id),
    searchBlocks(board.blocks, "i2c").map((b) => b.id),
  );
  const gpio = searchBlocks(board.blocks, "gpio fe200000");
  assert.equal(gpio.length, 1);
  assert.equal(gpio[0].qomPath, "/machine/soc/peripherals/gpio");
  assert.equal(searchBlocks(board.blocks, "bcm2835-i2c1").length, 1);
  assert.deepEqual(searchBlocks(board.blocks, "  "), []);
  assert.deepEqual(searchBlocks(board.blocks, "no-such-peripheral"), []);
});
it("highlights exactly the selected block and its incident connections", () => {
  const diagram = createDiagram(board);
  const id = "/machine/soc/peripherals/uart0";
  const highlighted = highlightDiagram(diagram.nodes, diagram.edges, id);
  assert.deepEqual(
    highlighted.nodes.filter((n) => n.selected).map((n) => n.id),
    [id],
  );
  for (const node of highlighted.nodes)
    assert.equal(node.className === "is-dimmed", node.id !== id);
  const active = highlighted.edges.filter((e) => e.className !== "is-dimmed");
  assert.ok(active.length > 0);
  assert.ok(active.every((e) => e.source === id || e.target === id));
  for (const edge of highlighted.edges) {
    const original = diagram.edges.find((e) => e.id === edge.id)!;
    if (edge.source === id || edge.target === id) {
      assert.deepEqual(edge.style, original.style);
      assert.deepEqual(edge.markerEnd, original.markerEnd);
    } else {
      assert.equal(edge.style?.stroke, "var(--color-edge-muted)");
      assert.equal(
        typeof edge.markerEnd === "object" ? edge.markerEnd.color : undefined,
        "var(--color-edge-muted)",
      );
    }
  }
  // Neighbors remain gray even though their direct connecting edges retain color.
  const neighbor = active.find((edge) => edge.source !== edge.target)!;
  const neighborId = neighbor.source === id ? neighbor.target : neighbor.source;
  assert.equal(
    highlighted.nodes.find((n) => n.id === neighborId)!.className,
    "is-dimmed",
  );
});
it("restores original colors when cleared without changing positions or source data", () => {
  const diagram = createDiagram(board);
  const before = structuredClone(diagram);
  highlightDiagram(
    diagram.nodes,
    diagram.edges,
    "/machine/soc/peripherals/uart0",
  );
  const cleared = highlightDiagram(diagram.nodes, diagram.edges, null);
  assert.ok(cleared.nodes.every((n) => !n.selected && n.className === ""));
  assert.ok(cleared.edges.every((e) => e.className === ""));
  assert.deepEqual(
    cleared.edges.map((e) => e.style),
    diagram.edges.map((e) => e.style),
  );
  assert.deepEqual(
    cleared.nodes.map((n) => n.position),
    diagram.nodes.map((n) => n.position),
  );
  assert.deepEqual(diagram, before);
});

it("matches capitalization, superscript and subscript digits in both queries and labels", () => {
  const fixtures: Block[] = [
    {
      id: "i2c",
      label: "I₂C controller",
      kind: "peripheral",
      status: "implemented",
      description: "Search fixture",
      regions: [],
    },
    {
      id: "i3c",
      label: "I³C controller",
      kind: "peripheral",
      status: "implemented",
      description: "Search fixture",
      regions: [],
    },
  ];
  for (const query of ["i2c", "I2C", "I²C", "i₂c", "Ｉ２Ｃ"])
    assert.deepEqual(
      searchBlocks(fixtures, query).map((b) => b.id),
      ["i2c"],
      query,
    );
  for (const query of ["i3c", "I3C", "I³C", "i₃c", "Ｉ３Ｃ"])
    assert.deepEqual(
      searchBlocks(fixtures, query).map((b) => b.id),
      ["i3c"],
      query,
    );
});
