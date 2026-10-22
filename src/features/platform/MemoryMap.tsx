import { useState } from "react";
import type { Board } from "./boards";
import { hex } from "./boards";
import { memorySize, memorySlots } from "./memory-map";

export function MemoryMap({
  board,
  selectedId,
  onSelect,
}: {
  board: Board;
  selectedId: string | null;
  onSelect: (blockId: string) => void;
}) {
  const [spaceId, setSpaceId] = useState(board.primarySpaceId);
  const view = board.inventory.spaces.find((space) => space.id === spaceId)!;
  const slots = memorySlots(board, spaceId);
  return (
    <section className="memory-map-panel" aria-label="System memory map">
      <h2>System memory map</h2>
      <label htmlFor="address-space">Address-space view</label>
      <select
        id="address-space"
        value={spaceId}
        onChange={(event) => setSpaceId(event.target.value)}
      >
        {board.inventory.spaces.map((space) => (
          <option key={space.id} value={space.id}>
            {space.id}:{" "}
            {Array.from(new Set(space.names)).slice(0, 3).join(", ")}
            {new Set(space.names).size > 3 ? " …" : ""}
          </option>
        ))}
      </select>
      <p className="memory-map-caption">
        Root: {view.root} · {view.regions.length} resolved mappings
      </p>
      <p className="memory-map-caption">
        Low → high addresses · slots not to scale
      </p>
      <div
        className="memory-slots"
        aria-label={`${board.name} memory address slots`}
      >
        {slots.map((slot) => {
          const content = (
            <>
              <span className="slot-addresses">
                <code>{hex(slot.base)}</code>
                <code>{hex(slot.base + slot.size - 1n)}</code>
              </span>
              <span className="slot-description">
                <strong>{slot.label}</strong>
                {slot.blockId && <span>{slot.name}</span>}
                <span>{memorySize(slot.size)}</span>
                {slot.mappingKind && (
                  <span>
                    {slot.mappingKind === "container"
                      ? "Routing container (not RAM)"
                      : slot.mappingKind}
                  </span>
                )}
                {slot.status && (
                  <span className={`device-status status-${slot.status}`}>
                    {slot.status}
                  </span>
                )}
              </span>
            </>
          );
          return slot.blockId ? (
            <button
              key={`${slot.blockId}-${slot.base}`}
              className={`memory-slot slot-${slot.kind}`}
              aria-pressed={selectedId === slot.blockId}
              title={`${slot.label}: ${slot.size.toLocaleString()} bytes`}
              onClick={() => onSelect(slot.blockId!)}
            >
              {content}
            </button>
          ) : (
            <div key={`gap-${slot.base}`} className="memory-slot slot-gap">
              {content}
            </div>
          );
        })}
      </div>
      <p className="memory-map-caption">
        Complete resolved ranges for this paused configuration. Gaps are
        unmapped in this view; reserved apertures and internal registers are not
        inferred. Aliases retain their backing offsets in the region name. No
        trailing address range is implied.
      </p>
    </section>
  );
}
