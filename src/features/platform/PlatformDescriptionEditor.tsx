import { useState } from "react";
import defaultDescription from "../../../platforms/arm-virt-a55.json";
import peripheralDescription from "../../../platforms/arm-virt-peripherals.json";
import type { PlatformRuntime } from "./usePlatformRuntime";

const examples = [
  {
    id: "hello-world",
    name: "Hello world",
    description: "A minimal serial console application",
    devices: "UART",
    platform: defaultDescription,
  },
  {
    id: "peripheral-demo",
    name: "Peripheral check",
    description: "RTC load/read and masked GPIO readback",
    devices: "UART + RTC + GPIO",
    platform: peripheralDescription,
  },
];

export function PlatformDescriptionEditor({
  runtime,
}: {
  runtime: PlatformRuntime;
}) {
  const [confirm, setConfirm] = useState(false);
  const locked =
    !runtime.desktop || !!runtime.busy || runtime.snapshot.state === "running";
  let application: unknown;
  try {
    application = JSON.parse(runtime.platformDraft)?.firmware?.application;
  } catch {
    /* The JSON editor can contain an incomplete draft. */
  }
  const generate = async () => {
    if (await runtime.configurePlatform()) setConfirm(false);
  };
  return (
    <section
      className="software-section"
      aria-labelledby="firmware-example-heading"
    >
      <div className="software-section-heading">
        <span>02</span>
        <h3 id="firmware-example-heading">Firmware</h3>
        <span className="software-section-meta">EL1 / AArch64</span>
      </div>
      <fieldset className="firmware-examples" disabled={locked || confirm}>
        <legend className="sr-only">Firmware example</legend>
        {examples.map((example) => (
          <label className="firmware-example" key={example.id}>
            <input
              type="radio"
              name="firmware-example"
              checked={application === example.id}
              onChange={() =>
                runtime.setPlatformDraft(
                  JSON.stringify(example.platform, null, 2),
                )
              }
            />
            <span className="firmware-example-copy">
              <strong>{example.name}</strong>
              <span>{example.description}</span>
              <small>{example.devices}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="software-hint">
        Choose an example to replace draft settings. Generate to apply.
      </p>
      <details className="firmware-description">
        <summary>
          <span>Platform description</span>
          <span className="firmware-format">JSON</span>
        </summary>
        <p className="software-hint">
          A53 / A55 / A72 · one CPU · 16–2048 MiB RAM. Execution settings are
          separate from the board reference diagram.
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
      </details>
      {confirm ? (
        <div
          className="platform-confirmation"
          role="region"
          aria-label="Confirm platform generation"
        >
          <p>
            Generate a fresh project? Unsaved source edits will be discarded.
            Previous saved projects stay on disk.
          </p>
          <div className="firmware-generation-actions">
            <button
              className="software-inline-action"
              disabled={locked}
              onClick={() => void generate()}
            >
              Generate fresh project <span aria-hidden="true">↗</span>
            </button>
            <button
              className="software-cancel"
              disabled={!!runtime.busy}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="firmware-generation-actions">
          <span className="software-hint">
            {runtime.project
              ? "Create a fresh source workspace"
              : "Prepare sources before running"}
          </span>
          <button
            className="software-inline-action"
            disabled={locked}
            onClick={() =>
              runtime.project || runtime.dirty
                ? setConfirm(true)
                : void generate()
            }
          >
            {runtime.busy === "generating" ? "Generating…" : "Generate sources"}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}
    </section>
  );
}
