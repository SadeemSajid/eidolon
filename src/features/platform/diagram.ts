import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { type Block, type Board, GRID_SIZE } from "./boards";
export type HardwareNode = Node<Block>;
export function createDiagram(board: Board): {
  nodes: HardwareNode[];
  edges: Edge[];
} {
  const order = {
    cpu: 0,
    "address-space": 1,
    memory: 2,
    controller: 3,
    peripheral: 4,
  };
  const sorted = [...board.blocks].sort(
    (a, b) => order[a.kind] - order[b.kind] || a.label.localeCompare(b.label),
  );
  const columns = Math.max(4, Math.ceil(Math.sqrt(sorted.length * 0.8)));
  return {
    nodes: sorted.map((block, index) => ({
      id: block.id,
      type: "hardware",
      position: {
        x: (index % columns) * 336,
        y: Math.floor(index / columns) * 240,
      },
      data: block,
      deletable: false,
    })),
    edges: board.connections.map((connection) => ({
      ...connection,
      sourceHandle: connection.kind === "signal" ? "irq-out" : "access-out",
      targetHandle: connection.kind === "signal" ? "irq-in" : "access-in",
      type: "smoothstep",
      deletable: false,
      style: {
        stroke:
          connection.kind === "signal"
            ? "var(--color-warning)"
            : "var(--color-accent)",
        strokeWidth: 1.2,
        strokeDasharray: connection.kind === "signal" ? "6 4" : undefined,
      },
      labelStyle: { fill: "var(--color-foreground)", fontSize: 10 },
      labelBgStyle: { fill: "var(--color-background)", fillOpacity: 0.95 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color:
          connection.kind === "signal"
            ? "var(--color-warning)"
            : "var(--color-accent)",
      },
    })),
  };
}
export const snapGrid: [number, number] = [GRID_SIZE, GRID_SIZE];

// Derive presentation from selection without mutating the hardware or positions.
export function highlightDiagram(
  nodes: HardwareNode[],
  edges: Edge[],
  selectedId: string | null,
): { nodes: HardwareNode[]; edges: Edge[] } {
  const focused =
    selectedId !== null && nodes.some((node) => node.id === selectedId);
  return {
    nodes: nodes.map((node) => ({
      ...node,
      selected: focused && node.id === selectedId,
      className: focused && node.id !== selectedId ? "is-dimmed" : "",
      zIndex: focused && node.id === selectedId ? 2 : 0,
    })),
    edges: edges.map((edge) => {
      const dimmed =
        focused && edge.source !== selectedId && edge.target !== selectedId;
      return {
        ...edge,
        selected: false,
        className: dimmed ? "is-dimmed" : "",
        zIndex: dimmed ? 0 : 1,
        ...(dimmed
          ? {
              style: {
                ...edge.style,
                stroke: "var(--color-edge-muted)",
                opacity: 0.25,
              },
              labelStyle: {
                ...edge.labelStyle,
                fill: "var(--color-edge-label-muted)",
              },
              labelBgStyle: {
                ...edge.labelBgStyle,
                fill: "var(--color-edge-background-muted)",
              },
              markerEnd:
                typeof edge.markerEnd === "object"
                  ? { ...edge.markerEnd, color: "var(--color-edge-muted)" }
                  : edge.markerEnd,
            }
          : {}),
      };
    }),
  };
}
