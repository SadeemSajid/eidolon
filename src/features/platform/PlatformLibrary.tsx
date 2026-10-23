import { useState } from "react";
import { ComponentCatalog } from "./ComponentCatalog";
import { boardMetadata } from "./board-metadata";
import { normalizeSearchText } from "./device-search";

const tabs = ["boards", "components", "custom"] as const;
const families = [
  "Application processors",
  "Microcontrollers",
  "RISC-V",
] as const;
function family(machine: string): (typeof families)[number] {
  if (machine.startsWith("mps")) return "Microcontrollers";
  if (machine === "virt" || machine === "microchip-icicle-kit") return "RISC-V";
  return "Application processors";
}

export function PlatformLibrary({
  boardId,
  onSelect,
}: {
  boardId: string;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("boards");
  const [query, setQuery] = useState("");
  const matches = boardMetadata.filter((board) =>
    normalizeSearchText(
      `${board.name} ${board.machine} ${board.cpu} ${family(board.machine)}`,
    ).includes(normalizeSearchText(query)),
  );
  return (
    <>
      <div
        className="sidebar-tabs"
        role="tablist"
        aria-label="Platform mode"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const index = tabs.indexOf(tab);
          const next =
            event.key === "Home"
              ? tabs[0]
              : event.key === "End"
                ? tabs[tabs.length - 1]
                : tabs[
                    (index +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      tabs.length) %
                      tabs.length
                  ];
          setTab(next);
          event.currentTarget
            .querySelector<HTMLButtonElement>(`#${next}-library-tab`)
            ?.focus();
        }}
      >
        <button
          id="boards-library-tab"
          role="tab"
          aria-selected={tab === "boards"}
          aria-controls="boards-library-panel"
          tabIndex={tab === "boards" ? 0 : -1}
          onClick={() => setTab("boards")}
        >
          Board Library
        </button>
        <button
          id="components-library-tab"
          role="tab"
          aria-selected={tab === "components"}
          aria-controls="components-library-panel"
          tabIndex={tab === "components" ? 0 : -1}
          onClick={() => setTab("components")}
        >
          Components
        </button>
        <button
          id="custom-library-tab"
          role="tab"
          aria-selected={tab === "custom"}
          aria-controls="custom-library-panel"
          tabIndex={tab === "custom" ? 0 : -1}
          onClick={() => setTab("custom")}
        >
          Custom SoC
        </button>
      </div>
      <div
        id="boards-library-panel"
        role="tabpanel"
        aria-labelledby="boards-library-tab"
        hidden={tab !== "boards"}
      >
        <p className="eyebrow">QEMU BOARD LIBRARY</p>
        <h2>Explore a platform</h2>
        <p className="muted">
          Select a board to load its device inventory and memory maps.
        </p>
        <label className="search-label" htmlFor="board-search">
          Search boards or CPUs
        </label>
        <input
          id="board-search"
          className="board-search"
          type="search"
          placeholder="e.g. Versal, M33, RISC-V"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="library-count" role="status">
          {matches.length} of {boardMetadata.length} boards
        </p>
        {families.map((group) => {
          const entries = matches.filter(
            (board) => family(board.machine) === group,
          );
          return entries.length ? (
            <section key={group} aria-label={group}>
              <h3 className="library-group">{group}</h3>
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  className="component board-card"
                  aria-pressed={entry.id === boardId}
                  onClick={() => onSelect(entry.id)}
                >
                  <strong>{entry.name}</strong>
                  <span>{entry.machine}</span>
                </button>
              ))}
            </section>
          ) : null;
        })}
        {!matches.length && (
          <p className="muted">
            No matching boards. Try a CPU family or vendor name.
          </p>
        )}
        <p className="note">
          Curated for embedded and SoC development. Each preset shows its device
          objects and memory views. Arm virt supports validated bare-metal
          targets; other board runtimes are planned.
        </p>
      </div>
      <div
        id="components-library-panel"
        role="tabpanel"
        aria-labelledby="components-library-tab"
        hidden={tab !== "components"}
      >
        <ComponentCatalog />
      </div>
      <div
        id="custom-library-panel"
        role="tabpanel"
        aria-labelledby="custom-library-tab"
        hidden={tab !== "custom"}
        tabIndex={0}
      >
        <p className="eyebrow">CUSTOM SOC</p>
        <h2>Compose your own SoC</h2>
        <span className="badge">Planned</span>
        <p className="muted">
          Define a processor, memory regions, peripherals, and interrupt routing
          for your own platform.
        </p>
        <ol className="custom-steps">
          <li>Select a processor and compatible interrupt controller.</li>
          <li>Configure RAM, ROM, and the address map.</li>
          <li>Add peripherals and connect buses and interrupts.</li>
          <li>Validate and run with a configurable QEMU machine backend.</li>
        </ol>
        <p className="note">
          Custom composition is not implemented yet. The current board remains
          on the canvas while you browse this tab.
        </p>
        <button
          className="secondary-button"
          onClick={() => {
            setTab("components");
            requestAnimationFrame(() =>
              document.getElementById("components-library-tab")?.focus(),
            );
          }}
        >
          Browse component readiness
        </button>
      </div>
    </>
  );
}
