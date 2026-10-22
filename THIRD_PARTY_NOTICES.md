# Third-party notices

Eidolon's root MIT license applies to its original code, not to all dependencies.

- QEMU: https://gitlab.com/qemu-project/qemu — GPL version 2 overall, with component-specific licenses. See third_party/qemu/LICENSE, COPYING, COPYING.LIB, and individual file notices after initialization. Preserve these and provide required corresponding source when distributing covered binaries. Modifications inside QEMU retain the applicable upstream licensing.
- Tauri: https://github.com/tauri-apps/tauri — MIT or Apache-2.0.
- React: https://github.com/facebook/react — MIT.
- React Flow (@xyflow/react): https://github.com/xyflow/xyflow — MIT.
- JetBrains Mono (bundled via @fontsource/jetbrains-mono): https://github.com/JetBrains/JetBrainsMono — SIL Open Font License 1.1. See public/licenses/JetBrainsMono-OFL.txt for the bundled notice.
- Bun: https://github.com/oven-sh/bun — MIT with separately licensed bundled components; development tooling only here.

This is a guide to major dependencies, not an exhaustive generated dependency inventory. Check the exact dependency licenses and notices before distributing a release. Guest firmware, FreeRTOS ports, Linux kernels, and filesystem images must each have explicit provenance and licensing before inclusion.
