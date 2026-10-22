import { useEffect, type RefObject } from "react";
import { useReactFlow } from "@xyflow/react";
import { edgePanVelocity } from "./canvas-navigation";

export function useEdgePan(
  canvasRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const { getViewport, setViewport } = useReactFlow();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;
    let frame: number | null = null;
    let previousTime: number | null = null;
    let pointer: { x: number; y: number } | null = null;
    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      previousTime = null;
      pointer = null;
    };
    const tick = (time: number) => {
      if (!pointer) return;
      const bounds = canvas.getBoundingClientRect();
      const velocity = edgePanVelocity(
        pointer.x - bounds.left,
        pointer.y - bounds.top,
        bounds.width,
        bounds.height,
      );
      if (!velocity.x && !velocity.y) {
        stop();
        return;
      }
      // Cap the delta so a suspended tab cannot cause a large jump.
      const seconds =
        previousTime === null ? 0 : Math.min(time - previousTime, 32) / 1000;
      previousTime = time;
      const viewport = getViewport();
      void setViewport({
        ...viewport,
        x: viewport.x + velocity.x * seconds,
        y: viewport.y + velocity.y * seconds,
      });
      frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      // React Flow owns panning during drags, including dragged-node auto-pan.
      if (
        event.pointerType === "touch" ||
        event.buttons !== 0 ||
        !(event.target instanceof Element) ||
        event.target.closest(
          ".canvas-tools, .device-finder, .react-flow__panel, button, input, select, textarea, [contenteditable]",
        )
      ) {
        stop();
        return;
      }
      pointer = { x: event.clientX, y: event.clientY };
      if (frame === null) frame = requestAnimationFrame(tick);
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", stop);
    canvas.addEventListener("pointerdown", stop);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      stop();
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", stop);
      canvas.removeEventListener("pointerdown", stop);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [canvasRef, enabled, getViewport, setViewport]);
}
