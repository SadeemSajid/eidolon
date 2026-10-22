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
  const slots = memorySlots(board);
  return (
    <section className="memory-map-panel" aria-label="System memory map">
      <h2>System memory map</h2>
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
                <code>{hex(slot.base + slot.size - 1)}</code>
              </span>
              <span className="slot-description">
                <strong>{slot.label}</strong>
                {slot.blockId && <span>{slot.name}</span>}
                <span>{memorySize(slot.size)}</span>
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
        Gaps may contain omitted devices, aliases, or reserved space. Addresses
        beyond the last slot are not shown.
      </p>
    </section>
  );
}
