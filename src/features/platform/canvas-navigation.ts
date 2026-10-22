// Screen pixels per second. Positive values move the viewport toward the
// left/top, revealing the board in that direction.
export function edgePanVelocity(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (x < 0 || y < 0 || x > width || y > height) return { x: 0, y: 0 };
  const axis = (position: number, size: number) => {
    const margin = Math.min(48, size / 2);
    if (margin <= 0) return 0;
    if (position < margin) return 480 * (1 - position / margin);
    if (position > size - margin)
      return -480 * (1 - (size - position) / margin);
    return 0;
  };
  const dx = axis(x, width);
  const dy = axis(y, height);
  const scale = Math.max(1, Math.hypot(dx, dy) / 480);
  return { x: dx / scale, y: dy / scale };
}
