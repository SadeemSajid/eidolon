import { useState } from "react";
import { boards } from "./boards";

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
  const [tab, setTab] = useState<"boards" | "custom">("boards");
  const [query, setQuery] = useState("");
  const matches = boards.filter((board) =>
    `${board.name} ${board.machine} ${board.cpu} ${family(board.machine)}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
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
          const next =
            event.key === "Home"
              ? "boards"
              : event.key === "End"
                ? "custom"
                : tab === "boards"
                  ? "custom"
                  : "boards";
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
          {matches.length} of {boards.length} boards
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
                  <span>QEMU 11.1.2 · captured inventory</span>
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
          Curated for embedded and SoC development. Each preset shows its
          captured device objects and memory views. Runtime and boot support are
          planned.
        </p>
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
      </div>
    </>
  );
}
