import { useEffect, useRef, useState, type ReactNode } from "react";
import { clampPanelHeight, panelMaximum } from "./panel-layout";

export function BottomPanel({
  id,
  label,
  open,
  initialHeight,
  minimum,
  onClose,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  initialHeight: number;
  minimum: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const [height, setHeight] = useState(initialHeight);
  const [maximum, setMaximum] = useState(600);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    const studio = panel.current?.parentElement;
    if (!studio) return;
    const measure = () => {
      const toolbar =
        studio.querySelector(".app-toolbar")?.getBoundingClientRect().height ??
        44;
      const footer =
        studio.querySelector("footer")?.getBoundingClientRect().height ?? 34;
      const max = panelMaximum(
        studio.getBoundingClientRect().height,
        toolbar + footer,
        minimum,
      );
      setMaximum(max);
      setHeight((current) => clampPanelHeight(current, minimum, max));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(studio);
    return () => observer.disconnect();
  }, [minimum]);
  const stop = () => {
    drag.current = null;
    setResizing(false);
  };
  return (
    <section
      ref={panel}
      tabIndex={-1}
      id={id}
      className="bottom-panel"
      aria-label={label}
      hidden={!open}
      style={{ height }}
      data-resizing={resizing}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div
        className="bottom-panel-resizer"
        role="separator"
        aria-label={`Resize ${label.toLowerCase()}`}
        aria-controls={id}
        aria-orientation="horizontal"
        aria-valuemin={minimum}
        aria-valuemax={maximum}
        aria-valuenow={height}
        aria-valuetext={`${Math.round(height)} pixels`}
        tabIndex={0}
        title="Drag to resize · ↑/↓ to adjust · double-click to reset"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { y: event.clientY, height };
          setResizing(true);
        }}
        onPointerMove={(event) => {
          if (drag.current)
            setHeight(
              clampPanelHeight(
                drag.current.height + drag.current.y - event.clientY,
                minimum,
                maximum,
              ),
            );
        }}
        onPointerUp={(event) => {
          stop();
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onDoubleClick={() =>
          setHeight(clampPanelHeight(initialHeight, minimum, maximum))
        }
        onKeyDown={(event) => {
          if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          setHeight((current) =>
            clampPanelHeight(
              event.key === "Home"
                ? minimum
                : event.key === "End"
                  ? maximum
                  : current + (event.key === "ArrowUp" ? 24 : -24),
              minimum,
              maximum,
            ),
          );
        }}
      />
      {children}
    </section>
  );
}
