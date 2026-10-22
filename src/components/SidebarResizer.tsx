import { useRef } from "react";

export function SidebarResizer({
  side,
  width,
  minimum,
  controls,
  onResize,
  onResizing,
}: {
  side: "left" | "right";
  width: number;
  minimum: number;
  controls: string;
  onResize: (width: number) => void;
  onResizing: (active: boolean) => void;
}) {
  const dragging = useRef(false);
  const stop = () => {
    dragging.current = false;
    onResizing(false);
  };
  return (
    <div
      className={`sidebar-resizer resizer-${side}`}
      role="separator"
      aria-label={`Resize ${side === "left" ? "platform library" : "details"} sidebar`}
      aria-orientation="vertical"
      aria-valuemin={minimum}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      aria-controls={controls}
      tabIndex={0}
      title="Drag to resize · arrow keys to adjust · Home to reset"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        onResizing(true);
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        const bounds =
          event.currentTarget.parentElement!.getBoundingClientRect();
        onResize(
          side === "left"
            ? event.clientX - bounds.left
            : bounds.right - event.clientX,
        );
      }}
      onPointerUp={(event) => {
        stop();
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
        event.preventDefault();
        const increase =
          side === "left"
            ? event.key === "ArrowRight"
            : event.key === "ArrowLeft";
        onResize(
          event.key === "Home" ? minimum : width + (increase ? 24 : -24),
        );
      }}
    />
  );
}
