# Firmware components

These are original MIT-licensed source components, not generated firmware binaries.

- arch/aarch64/: EL1 startup/BSS/stack setup and architecture services.
- drivers/pl011.c: polling console implementation, independent of application logic.
- include/console.h: application-facing console API; include/platform.h exposes architecture services.
- apps/hello.c.in: the initial application, using services instead of MMIO addresses.
- templates/: generated configuration and linker layout templates.

The registry in scripts/generate-bare-metal.py declares component files and compile dependencies. The resolver binds components to validated backend capabilities. A component's implementation is reused byte-for-byte across configurations; platform_config.h and linker.ld carry target-specific values. Sources are emitted into a flat project directory for the current allowlisted desktop editor.

When adding a component, update the registry, native embedded assets in src-tauri/src/platform.rs, source/output allowlists where needed, and appropriate behavior tests. Do not infer a driver from an MMIO range or allow a platform description to choose arbitrary template paths or shell commands.

Optional components:

| Component  | Reusable files                  | Polling API                                                            |
| ---------- | ------------------------------- | ---------------------------------------------------------------------- |
| pl031-rtc  | drivers/pl031.c, include/rtc.h  | rtc_init, rtc_seconds, rtc_set_seconds                                 |
| pl061-gpio | drivers/pl061.c, include/gpio.h | gpio_init, gpio_set_outputs, gpio_write(mask, values), gpio_read(mask) |

Each driver binds a single instance through generated platform_config.h macros;
there are no hardcoded board addresses in the source. GPIO direction bits select
outputs (1) versus inputs (0); masked writes affect only selected output pins.
Initialization masks interrupts and clears pending status. Alarm delivery,
interrupt-driven GPIO, multiple instances and external wiring configuration are
not implemented. The independently registered peripheral-demo application uses
both APIs; hello-world can include either driver without using it.

QEMU reuses these peripheral models on boards including Versatile and RealView
(see their machine sources in the pinned submodule). Reusing the firmware source
on another board still requires a backend with correct bindings and boot support.

The UI's Components tab reads component-readiness.json. It records reviewed
model/driver/boot/custom-SoC readiness, API names, limitations, source files and
named boot evidence. Update it alongside driver changes. Python domain tests
check component/source/test references; real boot regressions remain the evidence
for functional support. This catalog is read-only and does not compose hardware.
