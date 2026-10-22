# 0001: Desktop editor with an external QEMU runtime

Status: accepted for the foundation scaffold.

Use Tauri 2 with React/TypeScript and Bun. Use React Flow for the interactive graph editor. It supplies selection, viewport control, dragging, and keyboard behavior without requiring a custom canvas engine.

Run QEMU as a separate process controlled by Rust, using QMP for control and a separate console stream. Do not link QEMU into the MIT desktop host. Keep QEMU's existing license and notices, and review distribution obligations before shipping a bundled binary.

Pin upstream QEMU as an optional Git submodule. Editor contributors should not need its source or a native QEMU build. Updating upstream is an explicit, reviewed change, never an implicit pull of latest master.

Start with constrained machine templates, since QEMU machine code controls device realization, memory maps, and interrupt routing. Generic graphical composition requires additional backend engineering. Keep the hardware document independent of React Flow and validate it before execution.

Consequences: frontend development is lightweight and browser-accessible; desktop builds require Rust/native prerequisites. A process boundary provides clear ownership but does not itself settle every licensing question. No runtime commands are exposed in the initial scaffold.
