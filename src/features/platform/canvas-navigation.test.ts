import { it } from "node:test";
import assert from "node:assert/strict";
import { edgePanVelocity } from "./canvas-navigation";

it("reveals the board toward each edge without panning in the center", () => {
  assert.deepEqual(edgePanVelocity(400, 300, 800, 600), { x: 0, y: 0 });
  assert.deepEqual(edgePanVelocity(0, 300, 800, 600), { x: 480, y: 0 });
  assert.deepEqual(edgePanVelocity(800, 300, 800, 600), { x: -480, y: 0 });
  assert.deepEqual(edgePanVelocity(400, 0, 800, 600), { x: 0, y: 480 });
  assert.deepEqual(edgePanVelocity(400, 600, 800, 600), { x: 0, y: -480 });
});

it("accelerates near an edge and caps diagonal speed", () => {
  const near = edgePanVelocity(12, 300, 800, 600);
  const far = edgePanVelocity(36, 300, 800, 600);
  assert.ok(near.x > far.x && far.x > 0);
  const corner = edgePanVelocity(800, 0, 800, 600);
  assert.ok(corner.x < 0 && corner.y > 0);
  assert.ok(Math.abs(Math.hypot(corner.x, corner.y) - 480) < 0.001);
});

it("stops outside the canvas and handles small or empty canvases", () => {
  for (const [x, y] of [
    [-1, 300],
    [801, 300],
    [400, -1],
    [400, 601],
  ])
    assert.deepEqual(edgePanVelocity(x, y, 800, 600), { x: 0, y: 0 });
  assert.deepEqual(edgePanVelocity(0, 0, 0, 0), { x: 0, y: 0 });
  assert.deepEqual(edgePanVelocity(10, 10, 20, 20), { x: 0, y: 0 });
});
