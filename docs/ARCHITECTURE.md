# Architecture

## Intended data flow

React Flow editor → versioned platform document → semantic validation → board-specific launch plan → Rust process supervisor → QEMU.

The guest serial console and QMP control connection are separate channels. Rust publishes structured runtime events to the frontend. The versioned project document and general launch planner remain future work. One constrained Arm virt hello-world recipe now generates a project on demand and runs through the Rust host; see decisions/0004-generated-bare-metal.md.

## Boundaries

The frontend owns editing and presentation. React Flow node positions and edges must not become the hardware model. A future portable document should identify schema version, board template and backend version, CPU configuration, memory, devices, bus attachments, address maps, IRQs, software artifacts, and boot recipe. Layout metadata stays separate. File references must be portable and explicit.

A validator checks the document against a catalog verified for the selected QEMU build and machine. It rejects unsupported CPUs/devices, address overlaps, incompatible buses, invalid interrupts, and incompatible software. Errors should identify the affected canvas component.

Rust owns file access, executable selection, validation at the execution boundary, process lifecycle, QMP, serial transport, logs, and cleanup. It launches QEMU with an argument vector, never a shell. Future commands must have narrow permissions and structured request/response types. Guest images are untrusted input; avoid exposing host directories or network services by default.

QEMU remains an external executable. First support a constrained Arm virt template; its onboard components are representations of fixed board hardware, not freely rewireable devices. CPU/device help and QMP introspection can inform a catalog but cannot describe all valid hardware combinations. Truly custom boards need deliberate backend implementation.

## Software

The first Arm virt/Cortex-A55 recipe generates freestanding startup, C and a linker script into the app cache, then uses external Clang/LLD and pinned QEMU. A separate serial file carries PL011 output while QMP uses process stdin/stdout. Rust owns generation/build processes, QMP negotiation, status, Stop and exit cleanup. The run command streams typed build-stage updates over a Tauri IPC channel while compilation is in progress. A footer terminal drawer presents Build, Serial and Sources tabs, independent of the selected board or sidebar visibility. The active generated project can be inspected and edited through filename-allowlisted native commands; rebuild uses saved sources, while explicit regeneration creates a fresh project. Actual source hashes are recorded for edited builds, which are distinct from the verified hello-world recipe. Scoped cleanup previews exact targets and preserves external tool installations. See decisions/0005-generated-source-workspace.md. The UI exposes typed commands and actual serial output; the browser does not execute host tools. Source hashes, argument arrays and tool versions are retained with each run. See BARE_METAL.md.

Additional bare-metal and FreeRTOS recipes need verified architecture, startup code, linker script, exception level, load/entry addresses, UART mapping, and expected serial output. Prefer one reproducible minimal boot before adding more targets. Select a concrete supported FreeRTOS port separately rather than assuming every A55 configuration can boot it. Linux follows after lifecycle and console support stabilize.

## Captured board inventories

The hand-maintained core sketches have been replaced. scripts/capture-board-inventories.py initializes every preset with pinned QEMU and captures QOM devices, parent buses, connected IRQ/GPIO output links and every resolved FlatView. Facts remain independent of React Flow. The inventories include inactive objects and QEMU stubs with explicit status labels; known unsupported physical hardware is distinguished from mapped models.

The library uses lightweight board metadata. boards.ts loads and projects only the selected inventory into fixed hardware topology; each inventory is a separate dynamically imported chunk. Requested boards are cached for the session, and failed loads can be retried. Switching boards ignores stale load results. diagram.ts gives each block a unique snapping position. Memory Map renders exact hexadecimal ranges with BigInt, separately for each exported view, so aliases and security/DMA address spaces do not create false overlap errors or additional RAM. The primary CPU view supplies compact node addresses; additional views are inspected in the sidebar.

These snapshots establish initialized device/map coverage for their exact arguments, not guest boot compatibility. Only exposed QOM signal links are drawn; non-QOM internal wiring is not inferred. See BOARDS.md and decisions/0003-captured-inventories.md.
