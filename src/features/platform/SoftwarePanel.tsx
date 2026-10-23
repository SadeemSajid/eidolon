import { PlatformDescriptionEditor } from "./PlatformDescriptionEditor";
import type { PlatformRuntime } from "./usePlatformRuntime";

export function SoftwarePanel({
  boardId,
  runtime,
}: {
  boardId: string;
  runtime: PlatformRuntime;
}) {
  const supported = boardId === "arm-virt-a55";
  const { desktop, snapshot, busy, error } = runtime;
  const running = snapshot.state === "running";
  const ownsRun = snapshot.boardId === boardId;
  return (
    <>
      <p className="eyebrow">SOFTWARE</p>
      <h2>Software target</h2>
      <section
        className="software-section"
        aria-labelledby="software-environment-heading"
      >
        <div className="software-section-heading">
          <span>01</span>
          <h3 id="software-environment-heading">Environment</h3>
        </div>
        <dl className="software-environments">
          <div data-active={supported}>
            <dt>
              <span className="software-status-dot" aria-hidden="true" />
              Bare metal
            </dt>
            <dd>{supported ? "Available" : "Not integrated"}</dd>
          </div>
          <div>
            <dt>FreeRTOS</dt>
            <dd>Planned</dd>
          </div>
          <div>
            <dt>Linux</dt>
            <dd>Phase 2</dd>
          </div>
        </dl>
      </section>
      {supported && <PlatformDescriptionEditor runtime={runtime} />}
      <section
        className="software-section software-launch"
        aria-labelledby="software-launch-heading"
      >
        <div className="software-section-heading">
          <span>{supported ? "03" : "02"}</span>
          <h3 id="software-launch-heading">Execute</h3>
          <span className="software-section-meta">
            {busy === "building" ? "Building" : running ? "Running" : "Stopped"}
          </span>
        </div>
        <button
          className="software-run"
          data-running={running}
          disabled={running ? !!busy : !desktop || !supported || !!busy}
          onClick={() =>
            running ? void runtime.stop() : void runtime.run(boardId)
          }
        >
          <span aria-hidden="true">{running ? "■" : "▶"}</span>
          {busy === "building"
            ? "Building firmware…"
            : busy === "stopping"
              ? "Stopping…"
              : running
                ? "Stop platform"
                : "Build & run"}
          <span className="software-run-arrow" aria-hidden="true">
            {running ? "" : "→"}
          </span>
        </button>
        <p className="software-hint">
          {running
            ? "The guest stays active when you close this panel."
            : "Builds saved sources and opens the guest console."}
        </p>
      </section>
      {!desktop && supported && (
        <p className="muted">Run this recipe in the desktop app.</p>
      )}
      {error && (
        <p className="runtime-error" role="alert">
          {error}
        </p>
      )}
      {(ownsRun || running) &&
        snapshot.message &&
        snapshot.message !== error && (
          <p className="muted" role="status">
            {!ownsRun && `${snapshot.boardId}: `}
            {snapshot.message}
          </p>
        )}
      {ownsRun && snapshot.artifactDirectory && (
        <details className="coverage">
          <summary>Generated project</summary>
          <code className="source-reference">{snapshot.artifactDirectory}</code>
        </details>
      )}
    </>
  );
}
