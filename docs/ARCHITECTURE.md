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

The first Arm virt/Cortex-A55 recipe generates freestanding startup, C and a linker script into the app cache, then uses external Clang/LLD and pinned QEMU. A separate serial file carries PL011 output while QMP uses process stdin/stdout. Rust owns generation/build processes, QMP negotiation, status, Stop and exit cleanup. The run command streams typed build-stage updates over a Tauri IPC channel while compilation is in progress. The compact top toolbar provides global Run/Stop controls. Separate footer Terminal and Code buttons open independent panels: Terminal has Build/Serial output, while Code contains the source workspace. Both panels have retained, vertically resizable heights and remain independent of the selected board/sidebar. Switching panels preserves source buffers. The active generated project can be inspected and edited through filename-allowlisted native commands; rebuild uses saved sources, while explicit regeneration creates a fresh project. Actual source hashes are recorded for edited builds, which are distinct from the verified hello-world recipe. Scoped cleanup previews exact targets and preserves external tool installations. See decisions/0005-generated-source-workspace.md. The UI exposes typed commands and actual serial output; the browser does not execute host tools. Source hashes, argument arrays and tool versions are retained with each run. See BARE_METAL.md.

Additional bare-metal and FreeRTOS recipes need verified architecture, startup code, linker script, exception level, load/entry addresses, UART mapping, and expected serial output. Prefer one reproducible minimal boot before adding more targets. Select a concrete supported FreeRTOS port separately rather than assuming every A55 configuration can boot it. Linux follows after lifecycle and console support stabilize.

## Captured board inventories

The hand-maintained core sketches have been replaced. scripts/capture-board-inventories.py initializes every preset with pinned QEMU and captures QOM devices, parent buses, connected IRQ/GPIO output links and every resolved FlatView. Facts remain independent of React Flow. The inventories include inactive objects and QEMU stubs with explicit status labels; known unsupported physical hardware is distinguished from mapped models.

The library uses lightweight board metadata. boards.ts loads and projects only the selected inventory into fixed hardware topology; each inventory is a separate dynamically imported chunk. Requested boards are cached for the session, and failed loads can be retried. Switching boards ignores stale load results. diagram.ts gives each block a unique snapping position. Memory Map renders exact hexadecimal ranges with BigInt, separately for each exported view, so aliases and security/DMA address spaces do not create false overlap errors or additional RAM. The primary CPU view supplies compact node addresses; additional views are inspected in the sidebar.

These snapshots establish initialized device/map coverage for their exact arguments, not guest boot compatibility. Only exposed QOM signal links are drawn; non-QOM internal wiring is not inferred. See BOARDS.md and decisions/0003-captured-inventories.md.

## Modular firmware targets

The desktop now resolves platforms/arm-virt-a55.json (or a user-supplied supported description) into the typed ResolvedPlatform in scripts/generate-bare-metal.py. A backend capability contract validates CPU, memory placement, device bindings and boot state. It selects reusable AArch64 startup/services, a PL011 console driver and an application from firmware/. Target configuration and linker layout are generated; compiler/linker/QEMU options derive from the same resolved model. The captured diagram remains a separate reference inventory.

The Rust host embeds the generator and trusted component assets and accepts bounded description JSON, not raw process arguments or template paths. Applying a description generates a fresh project without replacing a valid active project on failure. Source hashes include every generated compilation input; the existing editor and cleanup allowlists cover the new components. The original recipe/generator output is frozen and tested independently. See decision 0006 and platforms/README.md.

## Embedded source editing

CodeMirror 6 presents the existing generated-source drafts, with C, JSON and Arm
assembly highlighting and optional Vim bindings. The Rust `format_source`
command formats bounded allowlisted C/header buffers through external
clang-format without writing files. Optional format-on-save finishes formatting
the changed C/header set before submitting edits to the existing save command.
See [decision 0007](decisions/0007-source-editor-and-formatting.md).

## Optional polling peripherals

The Arm virt resolver can bind PL031 RTC and PL061 GPIO independently, select
only requested drivers, and emit their fixed backend addresses into generated
configuration. The peripheral-demo application requires both; hello-world stays
minimal. Software offers example descriptions without applying them until the
normal generation step. Rust's source/hash/format/cleanup paths include the new
files. Polling support does not provide interrupt handlers or custom wiring.
See [decision 0008](decisions/0008-arm-virt-optional-peripherals.md).

The library's Components tab presents reviewed readiness metadata from
firmware/component-readiness.json separately from board inventories. Available
drivers, tested backend/configurations and missing custom-SoC support remain
separate statuses. See decision 0009; this catalog does not change runtime plans.
