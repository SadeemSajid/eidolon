import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { type Block, type Board, GRID_SIZE } from "./boards";
export type HardwareNode = Node<Block>;
export function createDiagram(board: Board): {
  nodes: HardwareNode[];
  edges: Edge[];
} {
  let memoryRow = 0;
  let peripheralRow = 0;
  return {
    nodes: board.blocks.map((block) => {
      const position =
        block.kind === "cpu"
          ? { x: 336, y: 0 }
          : block.kind === "address-space"
            ? { x: 336, y: 336 }
            : block.kind === "controller"
              ? { x: 1008, y: 336 }
              : block.kind === "memory"
                ? { x: 0, y: memoryRow++ * 168 }
                : { x: 672, y: peripheralRow++ * 192 };
      return {
        id: block.id,
        type: "hardware",
        position,
        data: block,
        deletable: false,
      };
    }),
    edges: board.connections.map((connection) => ({
      ...connection,
      sourceHandle: connection.kind === "interrupt" ? "irq-out" : "access-out",
      targetHandle: connection.kind === "interrupt" ? "irq-in" : "access-in",
      type: "smoothstep",
      deletable: false,
      style: {
        stroke: connection.kind === "interrupt" ? "#fdca40" : "#3772ff",
        strokeWidth: 1.7,
        strokeDasharray: connection.kind === "interrupt" ? "6 4" : undefined,
      },
      labelStyle: { fill: "#e6e8e6", fontSize: 11 },
      labelBgStyle: { fill: "#080708", fillOpacity: 0.95 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: connection.kind === "interrupt" ? "#fdca40" : "#3772ff",
      },
    })),
  };
}
export const snapGrid: [number, number] = [GRID_SIZE, GRID_SIZE];
