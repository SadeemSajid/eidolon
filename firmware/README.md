# Firmware components

These are original MIT-licensed source components, not generated firmware binaries.

- arch/aarch64/: EL1 startup/BSS/stack setup and architecture services.
- drivers/pl011.c: polling console implementation, independent of application logic.
- include/console.h: application-facing console API; include/platform.h exposes architecture services.
- apps/hello.c.in: the initial application, using services instead of MMIO addresses.
- templates/: generated configuration and linker layout templates.

The registry in scripts/generate-bare-metal.py declares component files and compile dependencies. The resolver binds components to validated backend capabilities. A component's implementation is reused byte-for-byte across configurations; platform_config.h and linker.ld carry target-specific values. Sources are emitted into a flat project directory for the current allowlisted desktop editor.

When adding a component, update the registry, native embedded assets in src-tauri/src/platform.rs, source/output allowlists where needed, and appropriate behavior tests. Do not infer a driver from an MMIO range or allow a platform description to choose arbitrary template paths or shell commands.
