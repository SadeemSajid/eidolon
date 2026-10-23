import { it } from "node:test";
import assert from "node:assert/strict";
import { clampPanelHeight, panelMaximum } from "../../components/panel-layout";

it("keeps 180px of canvas below the compact toolbar when expanding a drawer", () => {
  const maximum = panelMaximum(800, 44 + 34, 220);
  assert.equal(maximum, 542);
  assert.equal(clampPanelHeight(1000, 220, maximum), 542);
  assert.equal(800 - 44 - 34 - maximum, 180);
});
it("clamps a retained drawer height after reducing the window size", () => {
  assert.equal(clampPanelHeight(500, 220, panelMaximum(600, 78, 220)), 342);
  assert.equal(clampPanelHeight(100, 220, panelMaximum(600, 78, 220)), 220);
  assert.equal(clampPanelHeight(300, 220, panelMaximum(800, 78, 220)), 300);
});
it("keeps the panel minimum valid even when the available viewport is too small", () => {
  assert.equal(panelMaximum(200, 78, 220), 220);
  assert.equal(clampPanelHeight(-100, 140, 400), 140);
});
