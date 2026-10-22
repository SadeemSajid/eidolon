# Development

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

`bun run dev` runs the editor in a browser without a desktop backend. No browser fallback may pretend to execute a guest. The current host exposes no custom IPC commands.

For native verification:

```sh
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml
```

The initial environment had no Rust toolchain, so Cargo.lock and native verification must be completed on a machine with prerequisites. Commit Cargo.lock after that first successful build; subsequent checks should use `--locked`.

CI checks commit/PR conventions, tooling regressions, board-model invariants, frontend types, formatting, and production compilation. It also checks Rust formatting and compilation on Ubuntu with native prerequisites, but does not package installers or build/boot QEMU. Once Cargo.lock is committed, make that check use `--locked`.

Before claiming runtime support, add a meaningful boot smoke test with known serial output and a timeout. Record QEMU version, host, build flags, firmware provenance, and exact launch arguments.
