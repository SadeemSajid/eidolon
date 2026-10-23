# Development

The [dependency guide](DEPENDENCIES.md) separates end-user runtime tools from frontend, desktop and QEMU build dependencies.

Use Bun 1.3.14, as pinned in package.json, and stable Rust for desktop work. Install native prerequisites from https://v2.tauri.app/start/prerequisites/.

On Debian/Ubuntu, Tauri currently documents these packages (requires administrator access):

```sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev librsvg2-dev libayatana-appindicator3-dev
```

Windows needs Microsoft C++ build tools and WebView2; macOS needs Xcode command-line tools. Follow the upstream guide for supported OS versions. Bun is the package manager and script runner; Vite's tooling may also require a current Node.js runtime (use Node 24 LTS).

```sh
bun install --frozen-lockfile
bun run test
python3 -m unittest discover -s scripts -p "*_test.py"
bun run check
bun run build
bun run format:check
bun run tauri dev
```

`bun run dev` runs the editor in a browser without a desktop backend. No browser fallback may pretend to execute a guest. The desktop exposes only the constrained run/status/stop commands for its generated Arm virt hello-world recipe; see [bare-metal setup](BARE_METAL.md).

For native verification:

```sh
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib
# Requires clang-format on PATH or EIDOLON_CLANG_FORMAT:
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib formats_real_c_and_is_idempotent -- --ignored
```

Cargo.lock records the verified native dependency resolution. Use `--locked` for checks and builds.

CI checks commit/PR conventions, tooling regressions, board-model invariants, frontend types, formatting, and production compilation. It also checks Rust formatting and compilation on Ubuntu with native prerequisites, and boots the generated Arm virt hello-world recipe against a separately built pinned QEMU. It does not package installers.

Before claiming runtime support, add a meaningful boot smoke test with known serial output and a timeout. Record QEMU version, host, build flags, firmware provenance, and exact launch arguments.

Firmware changes must preserve the legacy recipe golden hashes and pass modular target validation tests. With pinned QEMU/Clang/LLD available, run the three Python boot regressions and both native boots_and_stops tests documented in BARE_METAL.md. Do not update the frozen fixture merely to make a failing regression pass.

## Source editor

The Code panel uses CodeMirror 6 for line numbers, syntax highlighting, indentation,
search, undo and completion. Its Vim checkbox enables the existing
`@replit/codemirror-vim` modal bindings. Escape stays inside the editor while Vim
is enabled. File switches preserve draft text; editor selection and undo history
reset when switching files. Vim and format-on-save preferences are stored locally.

Ctrl/Cmd+S saves edits. Format (Alt+Shift+F) formats the active editable C source
or header using `clang-format` and leaves the result unsaved. Install
`clang-format` on the desktop host, or set `EIDOLON_CLANG_FORMAT` to its executable
path before starting Eidolon. The fixed LLVM style uses two-space indentation;
project `.clang-format` files are not loaded. Optional Format on save applies to
all changed C sources/headers during Save and Save & run. A formatting failure
preserves drafts and prevents saving that batch. Assembly, linker scripts and
read-only manifests are excluded. Formatting is unavailable during emulation.

## Linux graphics fallback

Mesa/EGL/Zink messages occur in the native WebKitGTK graphics stack, independently
of the Vite dev server. Check GPU access and host graphics drivers first. For a
VM, container, remote desktop or host without usable GPU access, try:

```sh
bun run tauri:software
```

This launches `tauri dev` with `LIBGL_ALWAYS_SOFTWARE=1`,
`WEBKIT_DISABLE_DMABUF_RENDERER=1` and `WEBKIT_DISABLE_COMPOSITING_MODE=1` on Linux.
It disables accelerated compositing for that process and may reduce performance.
The ordinary `bun run tauri dev` keeps the platform defaults. For a lighter
workaround, try `WEBKIT_DISABLE_DMABUF_RENDERER=1 bun run tauri dev` first.
No stderr filtering or system driver changes are made. See Tauri's
[Linux graphics troubleshooting](https://v2.tauri.app/develop/debug/linux-graphics/).
The fallback requires a working graphical display; it is not a headless mode.
