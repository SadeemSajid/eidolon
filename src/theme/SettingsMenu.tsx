import { useEffect, useRef, useState } from "react";
import { ThemePicker } from "./ThemePicker";

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    container.current?.querySelector("select")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return (
    <div
      className="footer-settings"
      ref={container}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="terminal-toggle"
        aria-label="Settings"
        title="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? "app-settings" : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9 3-.6 2.4-2.1 1.2L4 6l-2 3.5 1.7 1.8v2.4L2 15.5 4 19l2.3-.6 2.1 1.2L9 22h4l.6-2.4 2.1-1.2 2.3.6 2-3.5-1.7-1.8v-2.4L20 9.5 18 6l-2.3.6-2.1-1.2L13 3Z" />
          <circle cx="11" cy="12.5" r="3" />
        </svg>
      </button>
      {open && (
        <section
          id="app-settings"
          className="settings-popover"
          role="dialog"
          aria-label="Settings"
        >
          <h2>Settings</h2>
          <div className="settings-row">
            <div>
              <h3>Appearance</h3>
              <p>Choose a theme or follow your system.</p>
            </div>
            <ThemePicker />
          </div>
        </section>
      )}
    </div>
  );
}
