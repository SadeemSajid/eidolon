# 0002: Fixed board topology with source-derived architectural views

Status: superseded by 0003-captured-inventories.md.

Board selection loads a curated model with explicit configuration, memory ranges, and typed logical access/interrupt connections. Begin with Arm virt/A55 and MPS2 AN385/M3 core views. Label omitted hardware and show pinned source provenance. Do not present them as complete or runtime-validated inventories.

Store hardware facts separately from React Flow layout. Allow snapping movement and inspection, while preventing deletion, new connections, and rewiring of built-in components. Replacing an in-memory board resets its layout. Persisting independent per-board layouts is future work.

A visual address-space hub represents logical routing; it is not an invented AXI/AHB implementation. Number interrupts according to the controller and distinguish relative SPI indices, architectural INTIDs, external IRQ lines, and exception slots.

Custom mode remains planned. Selecting a CPU will constrain architecture, address width, interrupt-controller compatibility, and boot requirements; it does not determine a universal memory map. Suggested RAM/ROM/MMIO layouts must be explicit defaults that a configurable machine backend actually realizes. Validate address-space-aware maps, aliases, bus/IRQ compatibility, clocks/resets, CPU boot state, and firmware requirements before claiming an executable SoC. Prefer a versioned declarative platform description consumed by a deliberately implemented QEMU machine; a DTB alone cannot create QEMU hardware.
