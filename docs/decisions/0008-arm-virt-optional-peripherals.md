# 0008: Optional Arm virt RTC and GPIO firmware components

Status: Accepted. Extends decision 0006 without changing the frozen v1 recipe.

Add optional PL031 RTC and PL061 GPIO bindings to the version-1 platform
firmware-target description. PL011 uart0 remains required. Validate each kind,
instance ID, MMIO base/size and SPI index against pinned QEMU's nonsecure Arm virt
machine. Reject duplicates, unknown fields and incompatible application bindings.
Canonical device/component ordering makes generation independent of input order.
Omitting a binding excludes its firmware driver, not QEMU's onboard hardware.

Register independently selected pl031-rtc and pl061-gpio source/header pairs.
Generate their base addresses into the existing read-only platform_config.h.
Drivers expose single-instance polling APIs without fixed board addresses in the
source. Other backends can reuse these files after validating their own bindings,
CPU/MMIO access semantics and boot contracts. This change enables only Arm virt.
No generic interrupt dispatch or GIC driver is introduced; both drivers mask
interrupts, and the recorded SPI bindings do not imply interrupt support.

Add a peripheral-demo application requiring both bindings. Test RTC counter
load/read then restore its prior value, and masked GPIO output/readback on pins
0/1 while retaining the power-button input on pin 3. This verifies functional
register behavior, not external wiring, elapsed-time accuracy or power/timing
fidelity. Failure prints a distinct marker instead of the expected PASS output.
The default hello-world target stays minimal; Software offers explicit example
loading followed by the existing generate/confirmation flow.

Embed new trusted assets in Rust and extend named source/hash/save/format/cleanup
allowlists. Build commands still come from the trusted generated in-memory plan.
Keep board inventory snapshots and upstream QEMU unchanged. Domain tests reject
invalid bindings before output; real QEMU tests cover both GIC versions, positive
and intentionally broken drivers, plus the native edit/rebuild/cleanup path.

Evidence: pinned third_party/qemu/hw/arm/virt.c (MMIO, SPI, GPIO instantiation and
power-button input), hw/rtc/pl031.c (counter/load and interrupt registers), and
hw/gpio/pl061.c (direction, masked data and interrupt registers). The same QEMU
models also appear in hw/arm/versatilepb.c and hw/arm/realview.c; that reuse is not
a claim that Eidolon boots those boards.
