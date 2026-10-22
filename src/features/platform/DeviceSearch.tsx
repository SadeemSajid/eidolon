import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Block } from "./boards";
import { searchBlocks } from "./device-search";

export function DeviceSearch({
  blocks,
  selectedId,
  onSelect,
  onClear,
}: {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (block: Block) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const matches = useMemo(() => searchBlocks(blocks, query), [blocks, query]);
  const expanded = open && query.trim().length > 0;
  useEffect(() => {
    if (expanded && activeIndex >= 0)
      list.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, expanded]);
  const choose = (block: Block) => {
    setQuery(block.label);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(block);
  };
  return (
    <div
      className="device-finder"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="device-search-input">
        <input
          ref={input}
          role="combobox"
          aria-label="Find device"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={
            expanded && activeIndex >= 0
              ? `${listId}-${activeIndex}`
              : undefined
          }
          placeholder="Find GPIO, I²C, DMA…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              if (matches.length)
                setActiveIndex((current) =>
                  current < 0 || !expanded
                    ? event.key === "ArrowDown"
                      ? 0
                      : matches.length - 1
                    : (current +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        matches.length) %
                      matches.length,
                );
            }
            if (event.key === "Enter" && expanded && matches.length) {
              event.preventDefault();
              choose(matches[Math.max(0, activeIndex)]);
            }
          }}
        />
        {(query || selectedId) && (
          <button
            type="button"
            aria-label="Clear search and highlight"
            title="Clear search and highlight"
            onClick={() => {
              setQuery("");
              setOpen(false);
              setActiveIndex(-1);
              onClear();
              input.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>
      {expanded && (
        <div className="device-search-results">
          <p role="status">
            {matches.length
              ? `${matches.length} matching devices`
              : "No matching devices"}
          </p>
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label="Matching devices"
          >
            {matches.map((block, index) => (
              <li
                key={block.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                data-chosen={selectedId === block.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(block)}
              >
                <strong>{block.label}</strong>
                <span>
                  {block.deviceType ?? block.kind} · {block.status}
                </span>
                {block.qomPath && <code>{block.qomPath}</code>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
