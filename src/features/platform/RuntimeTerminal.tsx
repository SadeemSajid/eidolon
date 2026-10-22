import { useEffect, useRef } from "react";
import { GeneratedSources } from "./GeneratedSources";
import type { PlatformRuntime } from "./usePlatformRuntime";

export type TerminalTab = "build" | "serial" | "sources";
const tabs = ["build", "serial", "sources"] as const;

export function RuntimeTerminal({
  runtime,
  open,
  activeTab,
  onSelectTab,
  onClose,
}: {
  runtime: PlatformRuntime;
  open: boolean;
  activeTab: TerminalTab;
  onSelectTab: (tab: TerminalTab) => void;
  onClose: () => void;
}) {
  const { snapshot, buildProgress, error, busy } = runtime;
  const output = useRef<HTMLPreElement>(null);
  const buildLog = buildProgress
    .map((entry) => `[${entry.stage}] ${entry.message}`)
    .join("\n\n");
  const text =
    activeTab === "serial"
      ? snapshot.serial || "No serial output"
      : [buildLog, error && !buildLog.includes(error) ? error : ""]
          .filter(Boolean)
          .join("\n\n") || "No build output";
  const lastStage = buildProgress[buildProgress.length - 1];
  useEffect(() => {
    const element = output.current;
    if (open && element) element.scrollTop = element.scrollHeight;
  }, [open, activeTab, text]);
  return (
    <section
      id="runtime-terminal"
      className="runtime-terminal"
      data-tab={activeTab}
      aria-label="Platform terminal"
      hidden={!open}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="terminal-header">
        <div
          role="tablist"
          aria-label="Terminal output"
          className="terminal-tabs"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "build"
                : event.key === "End"
                  ? "sources"
                  : tabs[
                      (tabs.indexOf(activeTab) +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                        tabs.length
                    ];
            onSelectTab(next);
            event.currentTarget
              .querySelector<HTMLButtonElement>(`#terminal-${next}-tab`)
              ?.focus();
          }}
        >
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab}
              role="tab"
              id={`terminal-${tab}-tab`}
              aria-controls="terminal-output"
              aria-selected={activeTab === tab}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => onSelectTab(tab)}
            >
              {tab === "build"
                ? "Build"
                : tab === "serial"
                  ? "Serial"
                  : "Sources"}
            </button>
          ))}
        </div>
        <span className="terminal-stage" role="status">
          {busy === "building"
            ? lastStage?.message.split("\n")[0] || "Preparing build…"
            : busy === "stopping"
              ? "Stopping…"
              : busy === "generating"
                ? "Generating sources…"
                : busy === "saving"
                  ? "Saving sources…"
                  : busy === "cleaning"
                    ? "Cleaning selected outputs…"
                    : snapshot.message}
        </span>
        <button
          type="button"
          className="terminal-close"
          title="Close terminal"
          aria-label="Close terminal"
          onClick={onClose}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div
        id="terminal-output"
        role="tabpanel"
        aria-labelledby={`terminal-${activeTab}-tab`}
        className="terminal-content"
        tabIndex={0}
      >
        {activeTab === "sources" ? (
          <GeneratedSources runtime={runtime} />
        ) : (
          <pre
            ref={output}
            aria-label={
              activeTab === "serial" ? "Guest serial output" : "Build output"
            }
          >
            {text}
          </pre>
        )}
      </div>
    </section>
  );
}
