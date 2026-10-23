import { BottomPanel } from "../../components/BottomPanel";
import { GeneratedSources } from "./GeneratedSources";
import type { PlatformRuntime } from "./usePlatformRuntime";

export function CodePanel({
  runtime,
  open,
  onClose,
}: {
  runtime: PlatformRuntime;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <BottomPanel
      id="code-panel"
      label="Code editor"
      open={open}
      initialHeight={360}
      minimum={220}
      onClose={onClose}
    >
      <div className="terminal-header code-panel-header">
        <strong>Code files</strong>
        <span className="terminal-stage">
          {runtime.dirty
            ? "Unsaved source edits"
            : runtime.project
              ? "Generated firmware project"
              : "Generate a project to edit sources"}
        </span>
        <button
          className="terminal-close"
          type="button"
          title="Close code editor"
          aria-label="Close code editor"
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
      <div className="terminal-content code-panel-content">
        <GeneratedSources runtime={runtime} />
      </div>
    </BottomPanel>
  );
}
