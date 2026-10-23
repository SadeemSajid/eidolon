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
      <fieldset className="software-targets">
        <legend>Operating environment</legend>
        {[
          {
            id: "bare-metal",
            name: "Bare metal",
            description: supported
              ? "Generated hello world · PL011 UART"
              : "No operating system",
          },
          {
            id: "freertos",
            name: "FreeRTOS",
            description: "Real-time operating system",
          },
          {
            id: "linux",
            name: "Linux",
            description: "General-purpose operating system",
          },
        ].map((target) => {
          const available = supported && target.id === "bare-metal";
          return (
            <label
              className="software-target"
              key={target.id}
              data-disabled={!available}
            >
              <input
                type="radio"
                name="software-target"
                value={target.id}
                disabled={!available}
                checked={available}
                readOnly
              />
              <span>
                <strong>{target.name}</strong>
                <span>{target.description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {supported && (
        <>
          <p className="muted">Arm virt · modular bare-metal target · EL1</p>
          <PlatformDescriptionEditor runtime={runtime} />
        </>
      )}
      <button
        className="run-button"
        disabled={!desktop || !supported || !!busy || running}
        onClick={() => void runtime.run(boardId)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m7 4 14 8-14 8Z" />
        </svg>
        {busy === "building" ? "Generating and building…" : "Run platform"}
      </button>
      {running && (
        <button
          className="runtime-stop secondary-button"
          disabled={!!busy}
          onClick={() => void runtime.stop()}
        >
          {busy === "stopping" ? "Stopping…" : "Stop platform"}
        </button>
      )}
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
