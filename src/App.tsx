import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  loadBoard,
  GRID_SIZE,
  regionRange,
  sourceUrl,
  validateBoard,
  type Board,
} from "./features/platform/boards";
import {
  createDiagram,
  highlightDiagram,
  snapGrid,
  type HardwareNode,
} from "./features/platform/diagram";
import { MemoryMap } from "./features/platform/MemoryMap";
import { PlatformLibrary } from "./features/platform/PlatformLibrary";
import { SidebarResizer } from "./components/SidebarResizer";
import { DeviceSearch } from "./features/platform/DeviceSearch";
import { boardMetadata } from "./features/platform/board-metadata";
import { useEdgePan } from "./features/platform/useEdgePan";
import {
  usePlatformRuntime,
  type PlatformRuntime,
} from "./features/platform/usePlatformRuntime";
import { SoftwarePanel } from "./features/platform/SoftwarePanel";
import {
  RuntimeTerminal,
  type TerminalTab,
} from "./features/platform/RuntimeTerminal";
import { CodePanel } from "./features/platform/CodePanel";
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
const detailTabs = [
  { id: "inspector", label: "Inspector" },
  { id: "memory", label: "Memory Map" },
  { id: "software", label: "Software" },
] as const;

function BoardCanvas({
  board,
  inspectorCollapsed,
  onToggleInspector,
  onOpenInspector,
  runtime,
}: {
  board: Board;
  runtime: PlatformRuntime;
  inspectorCollapsed: boolean;
  onToggleInspector: () => void;
  onOpenInspector: () => void;
}) {
  const { fitView } = useReactFlow();
  const diagram = useMemo(() => createDiagram(board), [board]);
  const [nodes, setNodes, onNodesChange] = useNodesState(diagram.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasMode, setCanvasMode] = useState<"pan" | "select">("pan");
  const canvasRef = useRef<HTMLElement>(null);
  const [edgePanEnabled, setEdgePanEnabled] = useState(false);
  useEdgePan(canvasRef, edgePanEnabled);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        (event.target instanceof Element &&
          event.target.closest(
            "input, textarea, select, [contenteditable], [role='textbox']",
          ))
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "v" || key === "p") {
        event.preventDefault();
        setCanvasMode(key === "v" ? "select" : "pan");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const [activePanel, setActivePanel] =
    useState<(typeof detailTabs)[number]["id"]>("inspector");
  const selected = board.blocks.find((block) => block.id === selectedId);
  const errors = useMemo(() => validateBoard(board), [board]);
  const highlighted = useMemo(
    () => highlightDiagram(nodes, diagram.edges, selectedId),
    [nodes, diagram.edges, selectedId],
  );
  return (
    <>
      <main ref={canvasRef} aria-label={`${board.name} architectural diagram`}>
        <div className="canvas-heading">
          <span className="eyebrow">{board.machine} · CAPTURED INVENTORY</span>
          <span>{nodes.length} blocks · 24px grid</span>
        </div>
        <ReactFlow
          className={`canvas-mode-${canvasMode}`}
          nodes={highlighted.nodes}
          edges={highlighted.edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => {
            if (canvasMode !== "select") return;
            setSelectedId(node.id);
            setActivePanel("inspector");
            onOpenInspector();
          }}
          onPaneClick={() => {
            if (canvasMode === "select") setSelectedId(null);
          }}
          panOnDrag={canvasMode === "pan"}
          nodesDraggable={canvasMode === "select"}
          elementsSelectable={canvasMode === "select"}
          selectionKeyCode={null}
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
              selectedId && node.id !== selectedId
                ? "#555555"
                : node.data.status === "stub" ||
                    node.data.status === "unsupported"
                  ? "#df2935"
                  : "#3772ff"
            }
          />
        </ReactFlow>
        <DeviceSearch
          blocks={board.blocks}
          selectedId={selectedId}
          onClear={() => setSelectedId(null)}
          onSelect={(block) => {
            setSelectedId(block.id);
            setActivePanel("inspector");
            onOpenInspector();
            requestAnimationFrame(() => {
              void fitView({
                nodes: [{ id: block.id }],
                duration: 250,
                maxZoom: 1,
              });
            });
          }}
        />
        <div className="canvas-tools">
          <div
            className="canvas-mode-toggle"
            role="group"
            aria-label="Canvas tools"
          >
            <button
              type="button"
              aria-pressed={canvasMode === "pan"}
              aria-label="Pan"
              aria-keyshortcuts="P"
              title="Pan (P)"
              onClick={() => setCanvasMode("pan")}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-6.5V3.5a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V13m0-4.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.8-2.4L4 14a1.5 1.5 0 0 1 2.4-1.8L8 14" />
              </svg>
            </button>
            <button
              type="button"
              aria-pressed={canvasMode === "select"}
              aria-label="Select"
              aria-keyshortcuts="V"
              title="Select (V)"
              onClick={() => setCanvasMode("select")}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="m4 3 16 9-7 2-3 7Z" />
              </svg>
            </button>
            <button
              type="button"
              aria-pressed={edgePanEnabled}
              aria-label="Edge pan"
              title="Edge pan"
              onClick={() => setEdgePanEnabled((enabled) => !enabled)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Reset layout"
              title="Reset layout"
              onClick={() => {
                setNodes(diagram.nodes);
                setSelectedId(null);
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6" />
              </svg>
            </button>
          </div>
          <details className="diagram-legend">
            <summary>Legend</summary>
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
              const index = detailTabs.findIndex(
                (tab) => tab.id === activePanel,
              );
              const nextIndex =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? detailTabs.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        detailTabs.length) %
                      detailTabs.length;
              const next = detailTabs[nextIndex].id;
              setActivePanel(next);
              event.currentTarget
                .querySelector<HTMLButtonElement>(`#${next}-tab`)
                ?.focus();
            }}
          >
            {detailTabs.map((tab) => (
              <button
                key={tab.id}
                id={`${tab.id}-tab`}
                role="tab"
                aria-selected={activePanel === tab.id}
                aria-controls={`${tab.id}-panel`}
                tabIndex={activePanel === tab.id ? 0 : -1}
                onClick={() => setActivePanel(tab.id)}
              >
                {tab.label}
              </button>
            ))}
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
            <div className="note">
              Click a block to inspect addresses and connections. Drag to
              rearrange; board hardware and wiring are fixed. Layout stays in
              memory.
            </div>
          </div>
          <div
            id="software-panel"
            role="tabpanel"
            aria-labelledby="software-tab"
            hidden={activePanel !== "software"}
            tabIndex={0}
          >
            <SoftwarePanel boardId={board.id} runtime={runtime} />
          </div>
        </div>
      </aside>
    </>
  );
}

export default function App() {
  const runtime = usePlatformRuntime();
  const [bottomPanel, setBottomPanel] = useState<"terminal" | "code" | null>(
    null,
  );
  const terminalOpen = bottomPanel === "terminal";
  const codeOpen = bottomPanel === "code";
  const [terminalTab, setTerminalTab] = useState<TerminalTab>("build");
  const terminalButton = useRef<HTMLButtonElement>(null);
  const codeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (runtime.busy === "building") {
      setBottomPanel("terminal");
      setTerminalTab("build");
    }
  }, [runtime.busy]);
  const closeTerminal = () => {
    setBottomPanel(null);
    terminalButton.current?.focus();
  };
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
  const [boardId, setBoardId] = useState(boardMetadata[0].id);
  const [loadedBoard, setLoadedBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const board = loadedBoard?.id === boardId ? loadedBoard : null;
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    void loadBoard(boardId).then(
      (loaded) => {
        if (!cancelled) setLoadedBoard(loaded);
      },
      () => {
        if (!cancelled) setLoadError("Could not load the board inventory.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [boardId, loadAttempt]);
  return (
    <div className="studio">
      <header className="app-toolbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            E
          </span>
          <h1>Eidolon</h1>
        </div>
        <span
          className="toolbar-platform"
          title={boardMetadata.find((entry) => entry.id === boardId)?.name}
        >
          {boardMetadata.find((entry) => entry.id === boardId)?.name}
        </span>
        <div className="toolbar-actions">
          <span
            className="toolbar-status"
            role="status"
            data-state={runtime.busy ?? runtime.snapshot.state}
          >
            {runtime.busy
              ? runtime.busy === "building"
                ? "Building…"
                : `${runtime.busy}…`
              : !runtime.desktop
                ? "Browser preview"
                : runtime.snapshot.state === "running"
                  ? `Running · ${runtime.snapshot.boardId}`
                  : runtime.snapshot.state === "failed"
                    ? "Build failed"
                    : "Stopped"}
          </span>
          <button
            className="toolbar-run"
            type="button"
            aria-label="Run platform"
            title={
              boardId === "arm-virt-a55"
                ? "Build and run the active firmware target"
                : "No firmware backend is registered for this board"
            }
            disabled={
              !runtime.desktop ||
              !board ||
              boardId !== "arm-virt-a55" ||
              !!runtime.busy ||
              runtime.snapshot.state === "running"
            }
            onClick={() => void runtime.run(boardId)}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="m7 4 14 8-14 8Z" />
            </svg>
            Run
          </button>
          <button
            className="toolbar-stop"
            type="button"
            aria-label="Stop platform"
            disabled={!!runtime.busy || runtime.snapshot.state !== "running"}
            onClick={() => void runtime.stop()}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M5 5h14v14H5z" />
            </svg>
            Stop
          </button>
        </div>
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
        {board ? (
          <ReactFlowProvider key={board.id}>
            <BoardCanvas
              board={board}
              runtime={runtime}
              inspectorCollapsed={inspectorCollapsed}
              onToggleInspector={() =>
                setInspectorCollapsed((collapsed) => !collapsed)
              }
              onOpenInspector={() => setInspectorCollapsed(false)}
            />
          </ReactFlowProvider>
        ) : (
          <>
            <main className="board-loading" aria-busy={!loadError}>
              {loadError ? (
                <div role="alert">
                  <p>{loadError}</p>
                  <button
                    className="secondary-button"
                    onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <p role="status">Loading board inventory…</p>
              )}
            </main>
            <aside
              className="inspector sidebar"
              aria-label="Platform details"
            />
          </>
        )}
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
      <RuntimeTerminal
        runtime={runtime}
        open={terminalOpen}
        activeTab={terminalTab}
        onSelectTab={setTerminalTab}
        onClose={closeTerminal}
      />
      <CodePanel
        runtime={runtime}
        open={codeOpen}
        onClose={() => {
          setBottomPanel(null);
          codeButton.current?.focus();
        }}
      />
      <footer>
        <div className="footer-runtime">
          <button
            ref={terminalButton}
            type="button"
            className="terminal-toggle"
            title="Terminal"
            aria-label="Toggle terminal"
            aria-expanded={terminalOpen}
            aria-controls="runtime-terminal"
            onClick={() => {
              setBottomPanel(terminalOpen ? null : "terminal");
              if (!terminalOpen)
                requestAnimationFrame(() =>
                  document
                    .getElementById(`terminal-${terminalTab}-tab`)
                    ?.focus(),
                );
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="m7 9 3 3-3 3m6 0h4" />
            </svg>
          </button>
          <button
            ref={codeButton}
            type="button"
            className="terminal-toggle"
            title="Code files"
            aria-label="Toggle code editor"
            aria-expanded={codeOpen}
            aria-controls="code-panel"
            onClick={() => {
              setBottomPanel(codeOpen ? null : "code");
              if (!codeOpen)
                requestAnimationFrame(() =>
                  (
                    document.querySelector<HTMLElement>(
                      "#code-panel .source-editor .cm-content",
                    ) ??
                    document.querySelector<HTMLElement>(
                      "#code-panel button:not(:disabled)",
                    ) ??
                    document.getElementById("code-panel")
                  )?.focus(),
                );
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m7 7-5 5 5 5m10-10 5 5-5 5m-3-14-4 18" />
            </svg>
          </button>
          <span>
            {runtime.busy === "building"
              ? "Building bare-metal firmware"
              : runtime.snapshot.state === "running"
                ? "QEMU running · Arm virt"
                : "QEMU stopped"}
          </span>
        </div>
        <span>Captured QEMU inventory · fixed board topology</span>
      </footer>
    </div>
  );
}
