import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  useReactFlow,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  boards,
  GRID_SIZE,
  regionRange,
  sourceUrl,
  validateBoard,
  type Board,
} from "./features/platform/boards";
import {
  createDiagram,
  snapGrid,
  type HardwareNode,
} from "./features/platform/diagram";
import type { BootTarget } from "./features/platform/catalog";
import { MemoryMap } from "./features/platform/MemoryMap";
import { PlatformLibrary } from "./features/platform/PlatformLibrary";
import { SidebarResizer } from "./components/SidebarResizer";
import "./App.css";

function HardwareBlock({ data }: NodeProps<HardwareNode>) {
  return (
    <div className={`hardware-block kind-${data.kind} status-${data.status}`}>
      <Handle
        type="target"
        position={Position.Left}
        id="access-in"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="access-out"
        isConnectable={false}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="irq-in"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="irq-out"
        isConnectable={false}
      />
      <span className="block-kind">{data.kind.replace(/-/g, " ")}</span>
      <strong>{data.label}</strong>
      <span className={`device-status status-${data.status}`}>
        {data.status}
      </span>
      {data.regions.slice(0, 2).map((region) => (
        <code key={region.name}>{regionRange(region)}</code>
      ))}
      {data.regions.length > 2 && (
        <span className="block-hint">
          +{data.regions.length - 2} mappings · inspect for details
        </span>
      )}
      {!data.regions.length && (
        <span className="block-hint">
          {data.kind === "cpu"
            ? "Instruction execution"
            : data.status === "unsupported"
              ? "Not implemented in QEMU"
              : "No mapping in primary view"}
        </span>
      )}
    </div>
  );
}
const nodeTypes = { hardware: HardwareBlock };

function BoardCanvas({
  board,
  inspectorCollapsed,
  onToggleInspector,
  onOpenInspector,
}: {
  board: Board;
  inspectorCollapsed: boolean;
  onToggleInspector: () => void;
  onOpenInspector: () => void;
}) {
  const { fitView } = useReactFlow();
  const [deviceQuery, setDeviceQuery] = useState("");
  const diagram = useMemo(() => createDiagram(board), [board]);
  const [nodes, setNodes, onNodesChange] = useNodesState(diagram.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"inspector" | "memory">(
    "inspector",
  );
  const [bootTarget, setBootTarget] = useState<BootTarget>("bare-metal");
  const selected = board.blocks.find((block) => block.id === selectedId);
  const errors = validateBoard(board);
  return (
    <>
      <main aria-label={`${board.name} architectural diagram`}>
        <div className="canvas-heading">
          <span className="eyebrow">{board.machine} · CAPTURED INVENTORY</span>
          <span>{nodes.length} blocks · 24px grid</span>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={diagram.edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => {
            setSelectedId(node.id);
            setActivePanel("inspector");
            onOpenInspector();
          }}
          onPaneClick={() => setSelectedId(null)}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          snapToGrid
          snapGrid={snapGrid}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          colorMode="dark"
          minZoom={0.02}
          maxZoom={2}
        >
          <Background gap={GRID_SIZE} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) =>
              node.data.status === "stub" || node.data.status === "unsupported"
                ? "#df2935"
                : "#3772ff"
            }
          />
        </ReactFlow>
        <form
          className="device-finder"
          onSubmit={(event) => {
            event.preventDefault();
            const match = board.blocks.find((block) =>
              `${block.label} ${block.deviceType ?? ""} ${block.qomPath ?? ""}`
                .toLowerCase()
                .includes(deviceQuery.trim().toLowerCase()),
            );
            if (match && deviceQuery.trim()) {
              setSelectedId(match.id);
              setActivePanel("inspector");
              onOpenInspector();
              void fitView({
                nodes: [{ id: match.id }],
                duration: 250,
                maxZoom: 1,
              });
            }
          }}
        >
          <input
            aria-label="Find device"
            placeholder="Find GPIO, I²C, DMA…"
            value={deviceQuery}
            onChange={(event) => setDeviceQuery(event.target.value)}
          />
          <button type="submit">Find</button>
        </form>
        <div className="canvas-tools">
          <details className="diagram-legend">
            <summary>Diagram legend</summary>
            <div className="legend-content">
              <div>
                <span className="legend-line" aria-hidden="true" />
                <span>Address decode / device bus</span>
              </div>
              <div>
                <span className="legend-line interrupt" aria-hidden="true" />
                <span>IRQ / GPIO signal links</span>
              </div>
              <p>
                Solid lines show resolved address decoding or parent buses.
                Dashed lines show connected QOM IRQ/GPIO outputs. Red/dashed
                blocks are unsupported, inactive or stub devices. This is not a
                timing model.
              </p>
            </div>
          </details>
          <button
            onClick={() => {
              setNodes(diagram.nodes);
              setSelectedId(null);
            }}
          >
            Reset layout
          </button>
        </div>
      </main>
      <aside className="inspector sidebar" aria-label="Platform details">
        <button
          className="sidebar-toggle"
          aria-expanded={!inspectorCollapsed}
          aria-controls="inspector-content"
          aria-label={
            inspectorCollapsed
              ? "Expand details sidebar"
              : "Collapse details sidebar"
          }
          title={
            inspectorCollapsed
              ? "Expand details sidebar"
              : "Collapse details sidebar"
          }
          onClick={onToggleInspector}
        >
          <span aria-hidden="true">{inspectorCollapsed ? "‹" : "›"}</span>
          {!inspectorCollapsed && <span>Platform details</span>}
        </button>
        {inspectorCollapsed && (
          <span className="sidebar-rail-label" aria-hidden="true">
            Inspector
          </span>
        )}
        <div
          id="inspector-content"
          className="sidebar-content"
          hidden={inspectorCollapsed}
        >
          <div
            className="sidebar-tabs"
            role="tablist"
            aria-label="Details view"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "inspector"
                  : event.key === "End"
                    ? "memory"
                    : activePanel === "inspector"
                      ? "memory"
                      : "inspector";
              setActivePanel(next);
              event.currentTarget
                .querySelector<HTMLButtonElement>(`#${next}-tab`)
                ?.focus();
            }}
          >
            <button
              id="inspector-tab"
              role="tab"
              aria-selected={activePanel === "inspector"}
              aria-controls="inspector-panel"
              tabIndex={activePanel === "inspector" ? 0 : -1}
              onClick={() => setActivePanel("inspector")}
            >
              Inspector
            </button>
            <button
              id="memory-tab"
              role="tab"
              aria-selected={activePanel === "memory"}
              aria-controls="memory-panel"
              tabIndex={activePanel === "memory" ? 0 : -1}
              onClick={() => setActivePanel("memory")}
            >
              Memory Map
            </button>
          </div>
          <div
            id="memory-panel"
            role="tabpanel"
            aria-labelledby="memory-tab"
            hidden={activePanel !== "memory"}
            tabIndex={0}
          >
            <MemoryMap
              board={board}
              selectedId={selectedId}
              onSelect={(blockId) => {
                setSelectedId(blockId);
                setActivePanel("inspector");
              }}
            />
          </div>
          <div
            id="inspector-panel"
            role="tabpanel"
            aria-labelledby="inspector-tab"
            hidden={activePanel !== "inspector"}
            tabIndex={0}
          >
            <p className="eyebrow">
              {selected ? "BLOCK DETAILS" : "BOARD DETAILS"}
            </p>
            <h2>{selected?.label ?? board.name}</h2>
            <p className="muted">
              {selected?.description ??
                `QEMU 11.1.2 · ${board.inventory.devices.length} device objects · ${board.inventory.spaces.length} address-space views`}
            </p>
            {selected ? (
              <>
                {selected.regions.map((region) => (
                  <div className="region-detail" key={region.name}>
                    <strong>{region.name}</strong>
                    <code>{regionRange(region)}</code>
                    <span>{region.size.toLocaleString()} bytes</span>
                  </div>
                ))}
                <h3>Connections</h3>
                <ul className="connection-list">
                  {board.connections
                    .filter(
                      (c) =>
                        c.source === selected.id || c.target === selected.id,
                    )
                    .map((c) => (
                      <li key={c.id}>
                        {board.blocks.find((b) => b.id === c.source)?.label} →{" "}
                        {board.blocks.find((b) => b.id === c.target)?.label}
                        <span>{c.label}</span>
                      </li>
                    ))}
                </ul>
                <button
                  className="secondary-button"
                  onClick={() => setSelectedId(null)}
                >
                  Back to board
                </button>
              </>
            ) : (
              <>
                <p className="validation-status" role="status">
                  {errors.length
                    ? `${errors.length} map issues`
                    : "Represented address ranges do not overlap"}
                </p>
                {errors.map((error) => (
                  <p key={error} className="muted">
                    {error}
                  </p>
                ))}
                <p className="muted">
                  Captured after device initialization with CPUs paused.
                  Exported memory views and connected QOM signals are included;
                  guest boot has not been verified.
                </p>
              </>
            )}
            <details className="coverage">
              <summary>Diagram coverage and provenance</summary>
              <p className="muted">{board.coverage}</p>
              <p className="muted">QEMU 11.1.2 · {board.source}</p>
              <details>
                <summary>Exact capture arguments</summary>
                <code className="source-reference">{board.configuration}</code>
              </details>
              <code className="source-reference">{sourceUrl(board)}</code>
            </details>
            <label htmlFor="boot-target">Software target</label>
            <select
              id="boot-target"
              value={bootTarget}
              onChange={(event) =>
                setBootTarget(event.target.value as BootTarget)
              }
            >
              <option value="bare-metal">Bare metal · planned</option>
              <option value="freertos">FreeRTOS · planned</option>
              <option value="linux" disabled>
                Linux · phase 2
              </option>
            </select>
            <button className="run-button" disabled>
              Run platform · coming soon
            </button>
            <div className="note">
              Click a block to inspect addresses and connections. Drag to
              rearrange; board hardware and wiring are fixed. Layout stays in
              memory.
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function App() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [libraryWidth, setLibraryWidth] = useState(245);
  const [inspectorWidth, setInspectorWidth] = useState(265);
  const [isResizing, setIsResizing] = useState(false);
  const resizeInspector = (width: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const libraryWidth = workspace
      .querySelector(".catalog")!
      .getBoundingClientRect().width;
    const maximum = Math.max(
      265,
      workspace.getBoundingClientRect().width - libraryWidth - 300,
    );
    setInspectorWidth(Math.min(maximum, Math.max(265, width)));
  };
  const resizeLibrary = (width: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const rightWidth = workspace
      .querySelector(".inspector")!
      .getBoundingClientRect().width;
    const maximum = Math.max(
      245,
      workspace.getBoundingClientRect().width - rightWidth - 300,
    );
    setLibraryWidth(Math.min(maximum, Math.max(245, width)));
  };
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [boardId, setBoardId] = useState(boards[0].id);
  const board = boards.find((entry) => entry.id === boardId)!;
  return (
    <div className="studio">
      <header>
        <div className="brand">
          <span className="brand-mark">E</span>
          <div>
            <h1>Eidolon</h1>
            <p>Virtual platform studio</p>
          </div>
        </div>
        <span className="badge">Board diagrams · developer preview</span>
      </header>
      <div
        ref={workspaceRef}
        className="workspace"
        data-resizing={isResizing}
        style={
          {
            "--inspector-expanded-width": `${inspectorWidth}px`,
            "--library-expanded-width": `${libraryWidth}px`,
          } as CSSProperties
        }
        data-library-collapsed={libraryCollapsed}
        data-inspector-collapsed={inspectorCollapsed}
      >
        <aside className="catalog sidebar" aria-label="Platform library">
          <button
            className="sidebar-toggle"
            aria-expanded={!libraryCollapsed}
            aria-controls="library-content"
            aria-label={
              libraryCollapsed
                ? "Expand platform library"
                : "Collapse platform library"
            }
            title={
              libraryCollapsed
                ? "Expand platform library"
                : "Collapse platform library"
            }
            onClick={() => setLibraryCollapsed((collapsed) => !collapsed)}
          >
            <span aria-hidden="true">{libraryCollapsed ? "›" : "‹"}</span>
            {!libraryCollapsed && <span>Platforms</span>}
          </button>
          {libraryCollapsed && (
            <span className="sidebar-rail-label" aria-hidden="true">
              Board library
            </span>
          )}
          <div
            id="library-content"
            className="sidebar-content"
            hidden={libraryCollapsed}
          >
            <PlatformLibrary boardId={boardId} onSelect={setBoardId} />
          </div>
        </aside>
        <ReactFlowProvider key={board.id}>
          <BoardCanvas
            board={board}
            inspectorCollapsed={inspectorCollapsed}
            onToggleInspector={() =>
              setInspectorCollapsed((collapsed) => !collapsed)
            }
            onOpenInspector={() => setInspectorCollapsed(false)}
          />
        </ReactFlowProvider>
        {!libraryCollapsed && (
          <SidebarResizer
            side="left"
            width={libraryWidth}
            minimum={245}
            controls="library-content"
            onResize={resizeLibrary}
            onResizing={setIsResizing}
          />
        )}
        {!inspectorCollapsed && (
          <SidebarResizer
            side="right"
            width={inspectorWidth}
            minimum={265}
            controls="inspector-content"
            onResize={resizeInspector}
            onResizing={setIsResizing}
          />
        )}
      </div>
      <footer>
        <span>QEMU runtime not connected</span>
        <span>Captured QEMU inventory · fixed board topology</span>
      </footer>
    </div>
  );
}
