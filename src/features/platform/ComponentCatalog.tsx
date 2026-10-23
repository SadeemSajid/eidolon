import { useState } from "react";
import components from "../../../firmware/component-readiness.json";
import { normalizeSearchText } from "./device-search";

const statusLabels: Record<string, string> = {
  available: "Available",
  "boot-tested": "Boot-tested · Arm virt",
  "backend-needed": "Backend needed",
  planned: "Planned",
  unverified: "Not verified",
};

export function ComponentCatalog() {
  const [query, setQuery] = useState("");
  const matches = components.filter((component) =>
    normalizeSearchText(
      `${component.name} ${component.model} ${component.description} ${component.mode} ${component.apis.join(" ")}`,
    ).includes(normalizeSearchText(query)),
  );
  return (
    <>
      <p className="eyebrow">MODULAR COMPONENTS</p>
      <h2>Component readiness</h2>
      <p className="muted">
        Reusable firmware building blocks for future platforms. Readiness below
        applies to Eidolon's integration.
      </p>
      <label className="search-label" htmlFor="component-search">
        Search components or APIs
      </label>
      <input
        id="component-search"
        className="board-search"
        type="search"
        placeholder="e.g. UART, RTC, GPIO"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p className="library-count" role="status">
        {matches.length} of {components.length} components · bare-metal drivers
        available
      </p>
      <div className="component-readiness-list">
        {matches.map((component) => (
          <article
            className="readiness-card"
            key={component.id}
            aria-label={`${component.name} ${component.model} readiness`}
          >
            <div className="readiness-card-title">
              <h3>{component.name}</h3>
              <span className="readiness-model">{component.model}</span>
            </div>
            <p>{component.description}</p>
            <dl className="readiness-statuses">
              {Object.entries({
                model: "Device model",
                bareMetal: "Bare-metal driver",
                validation: "Boot validation",
                customSoc: "Custom SoC",
              }).map(([key, label]) => {
                const status =
                  component.readiness[key as keyof typeof component.readiness];
                return (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd
                      data-ready={
                        status === "available" || status === "boot-tested"
                      }
                    >
                      {statusLabels[status]}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <details className="readiness-details">
              <summary>Capabilities & gaps</summary>
              <p className="readiness-mode">
                {component.mode} · single instance
              </p>
              <ul
                className="readiness-apis"
                aria-label={`${component.name} APIs`}
              >
                {component.apis.map((api) => (
                  <li key={api}>
                    <code>{api}</code>
                  </li>
                ))}
              </ul>
              <ul>
                {component.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
              <p>
                Validated configurations: {component.validatedOn.join(", ")}.
                Tests cover functional behavior.
              </p>
            </details>
          </article>
        ))}
      </div>
      {!matches.length && (
        <p className="muted">
          No matching components. Try a peripheral name, model or API.
        </p>
      )}
      <p className="note">
        FreeRTOS and Linux integration are not validated for these Eidolon
        components. Custom composition needs a backend that implements the
        chosen memory map and wiring. Driver availability alone does not enable
        dragging a device into a runnable SoC.
      </p>
    </>
  );
}
