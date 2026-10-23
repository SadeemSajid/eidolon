// Leave room for the canvas even when the drawer is expanded.
export function panelMaximum(
  studioHeight: number,
  chromeHeight: number,
  minimum: number,
): number {
  return Math.max(minimum, studioHeight - chromeHeight - 180);
}
export function clampPanelHeight(
  height: number,
  minimum: number,
  maximum: number,
): number {
  return Math.max(minimum, Math.min(maximum, height));
}
