import { useState } from "react";
import type { PlatformRuntime } from "./usePlatformRuntime";

export function PlatformDescriptionEditor({
  runtime,
}: {
  runtime: PlatformRuntime;
}) {
  const [confirm, setConfirm] = useState(false);
  const locked =
    !runtime.desktop || !!runtime.busy || runtime.snapshot.state === "running";
  const generate = async () => {
    if (await runtime.configurePlatform()) setConfirm(false);
  };
  return (
    <details className="coverage">
      <summary>Platform description</summary>
      <p className="muted">
        Describe an Arm virt target. Eidolon validates it, selects firmware
        components and generates the linker, build and launch settings. A53, A55
        and A72; one CPU; 16–2048 MiB RAM; PL011 UART0; EL1.
      </p>
      <p className="muted">
        This configures firmware execution. The captured architecture diagram
        remains a reference inventory and does not change with these settings.
      </p>
      <textarea
        className="platform-description-editor"
        aria-label="Arm virt platform description JSON"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={runtime.platformDraft}
        readOnly={locked || confirm}
        onChange={(event) => runtime.setPlatformDraft(event.target.value)}
      />
      {confirm ? (
        <div
          className="platform-confirmation"
          role="region"
          aria-label="Confirm platform generation"
        >
          <p className="muted">
            Generate a fresh project from this description? Unsaved source edits
            will be discarded. Previous saved projects remain on disk.
          </p>
          <button
            className="secondary-button"
            disabled={locked}
            onClick={() => void generate()}
          >
            Generate fresh project
          </button>
          <button
            className="secondary-button"
            disabled={!!runtime.busy}
            onClick={() => setConfirm(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="secondary-button"
          disabled={locked}
          onClick={() =>
            runtime.project || runtime.dirty
              ? setConfirm(true)
              : void generate()
          }
        >
          Generate from description
        </button>
      )}
      <p className="muted">
        Changes take effect only after successful generation. Inspect
        platform.json and plan.json in Sources, then Run platform to build and
        boot.
      </p>
    </details>
  );
}
