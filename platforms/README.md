# Platform descriptions

arm-virt-a55.json is the default version-1 Arm virt firmware-target description. Supply a description through Software → Platform description in the desktop, or:

```sh
python3 scripts/generate-bare-metal.py --platform platforms/arm-virt-a55.json --output build/arm-virt-firmware
```

The generator resolves and validates the description, selects trusted components, and writes sources, platform.json and plan.json. Generation performs no downloads, compilation or process execution. The desktop separately invokes provisioned tools and owns QEMU through Rust. To write different application logic, edit the generated main.c using the console/platform APIs; an arbitrary application cannot be inferred from hardware alone.

## Version 1 fields

Unknown fields are rejected. All fields shown in the example are required. Addresses and sizes accept nonnegative integers or 0x-prefixed hexadecimal strings; the canonical output uses hexadecimal strings. This is a firmware-target configuration for a fixed board backend, not an arbitrary hardware topology.

| Field                        | Supported contract                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| schemaVersion, id            | Version 1 and a short alphanumeric identifier (hyphens/underscores allowed)                            |
| backend                      | kind=qemu-arm-virt, machine=virt-11.1, qemuVersion=[11,1,2], gicVersion=2 or 3                         |
| cpu                          | architecture=aarch64, model=cortex-a53/cortex-a55/cortex-a72, cores=1                                  |
| memory                       | One ram region named ram at 0x40000000; size 16–2048 MiB, in whole MiB units                           |
| devices                      | One firmware console binding: uart0, kind=pl011, base=0x09000000, size=0x1000, clockHz=24000000, spi=1 |
| firmware.runtime/application | bare-metal / hello-world; the application source remains editable                                      |
| firmware.bootMemory/console  | Must reference ram / uart0                                                                             |
| firmware.entryOffset         | 4 KiB aligned; at least 2 MiB to reserve QEMU's DTB/boot area                                          |
| firmware.stackSize           | 4 KiB–1 MiB, aligned to 16 bytes; must fit in RAM above the entry                                      |
| firmware.exceptionLevel      | EL1; secure/virtualization are disabled by the backend                                                 |
| firmware.baud                | Positive baud with a supported PL011 integer/fractional divisor                                        |
| firmware.message             | 1–120 printable ASCII characters                                                                       |

The linker also rejects firmware sections plus stack that exceed RAM. The backend validates fixed UART addresses, clocks and interrupt wiring instead of pretending that changing JSON can relocate an onboard device. Other Arm virt peripherals still exist; devices lists the firmware bindings currently understood by this generator, not the entire board inventory.

The default description has been boot-tested. Tests also cover an A53 description using 256 MiB RAM, GICv2, a 4 MiB entry offset, 32 KiB stack and 57600 baud. Other accepted combinations are constrained by the same backend contract but are not individually claimed as smoke-tested.

A future custom SoC backend must implement and validate the declared memory map and wiring in QEMU. Extending only this JSON document cannot create unsupported hardware.
