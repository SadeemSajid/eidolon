# Dependencies and installation

This is the dependency guide for Eidolon users and contributors. The browser editor and desktop execution have different requirements. External runtime tools are not bundled or automatically installed when you click Run platform. Compilation and emulation run locally, so those tools must exist on the host. The inbuilt source editor adds no external editor dependency.

## What you need

| Use                                                         | Required dependencies                                                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Open an already hosted browser editor                       | A modern browser; host tools are not used                                                                                  |
| Run the browser editor from source                          | Git, Bun 1.3.14, Node.js 24 LTS                                                                                            |
| Build/run the desktop app from source                       | The frontend tools above, stable Rust/Cargo, and the native Tauri prerequisites below                                      |
| Run modular Arm virt bare-metal firmware in the desktop app | Python 3.9+, AArch64-capable Clang, LLD (`ld.lld`), and pinned QEMU 11.1.2                                                 |
| Format C sources/headers in the desktop Code panel          | `clang-format` (optional; separate from the Clang compiler)                                                                |
| Build the pinned QEMU executable                            | Git, a native C/C++ compiler, Python with venv/pip, Ninja, pkg-config, GLib development files and Pixman development files |

Rust, Bun and Node are needed to build Eidolon from source; they are not needed merely to execute a built desktop app. Python, Clang, LLD and QEMU are external dependencies of the current bare-metal runtime even when the app itself has already been built. The hello-world recipe uses no vendor SDK, C library, downloaded firmware, or OS image.

Clang must support `--target=aarch64-none-elf` and the selected `-mcpu=cortex-a53`, `cortex-a55` or `cortex-a72` (A55 is the default). A host-only compiler or Apple's native linker cannot substitute for the ELF linker `ld.lld`. The QEMU executable must support `virt-11.1`, Cortex-A55, TCG and the generic loader. Use the repository's pinned source commit `4fc49f46dc95d4a27de2509e7fceb2931e91faeb`; an arbitrary package-manager QEMU release may fail the exact 11.1.2 runtime check.

## macOS

Install [Xcode Command Line Tools](https://v2.tauri.app/start/prerequisites/#macos) for the native compiler, SDK and desktop build:

```sh
xcode-select --install
```

With [Homebrew](https://brew.sh/) available, the direct system dependencies for desktop development, firmware compilation and building QEMU are:

```sh
brew install rust python llvm lld ninja pkgconf glib pixman
```

Bun 1.3.14 and Node.js 24 LTS are installed separately for frontend development. Git is supplied by the command-line tools. Homebrew installs its packages' transitive dependencies automatically; those libraries are not additional tools that Eidolon launches. In particular, [LLD is a separate Homebrew package](https://formulae.brew.sh/formula/lld).

LLVM may be keg-only. Set executable overrides in the same terminal that starts Eidolon, using absolute paths. From the repository root:

```sh
export EIDOLON_CLANG="$(brew --prefix llvm)/bin/clang"
export EIDOLON_CLANG_FORMAT="$(brew --prefix llvm)/bin/clang-format"
export EIDOLON_LLD="$(brew --prefix lld)/bin/ld.lld"
export EIDOLON_PYTHON="$(brew --prefix python)/bin/python3"
export EIDOLON_QEMU="$PWD/build/qemu/qemu-system-aarch64"
bun install --frozen-lockfile
bun run tauri dev
```

Build QEMU first using [QEMU.md](QEMU.md). On the macOS 27 SDK, include `--disable-pvg` to disable the unused Apple graphics backend, and pass `--python` with the Homebrew Python path. The system Python 3.9 can run the generator but may need additional Python packages to build QEMU; the local QEMU build was verified with Homebrew Python 3.14. No QEMU source patch was needed.

## Ubuntu 24.04 / Debian package names

For the desktop build, firmware tools and QEMU build dependencies:

```sh
sudo apt update
sudo apt install git build-essential curl wget file \
  libwebkit2gtk-4.1-dev libxdo-dev libssl-dev librsvg2-dev \
  libayatana-appindicator3-dev \
  python3 python3-venv python3-pip clang clang-format lld ninja-build pkg-config \
  libglib2.0-dev libpixman-1-dev
```

`clang-format` is needed only for Format and optional Format on save. For an existing Ubuntu/Debian setup, install it with `sudo apt install clang-format`; installing `clang` alone does not provide it. Verify with `clang-format --version`.

Install stable Rust/Cargo, Bun 1.3.14 and Node.js 24 LTS separately. Follow the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/#linux) for other distributions. These package names match the Ubuntu CI environment; manual Linux desktop verification has not been performed in this session.

## Windows

Building the desktop shell requires Rust's MSVC toolchain, Microsoft C++ Build Tools with the desktop C++ workload, and WebView2, as described in [Tauri's Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows). Frontend development also needs Git, Bun and Node.

The bare-metal runtime additionally needs Python, an AArch64-capable Clang, LLD and the exact pinned QEMU build, with executable overrides set before starting the app. For optional source formatting, install clang-format (provided by LLVM) and add its executable directory to PATH or set `EIDOLON_CLANG_FORMAT` to its absolute executable path. The native hello-world flow has not been verified on Windows; a Windows QEMU/toolchain setup is not yet documented as a tested installation path.

## Tool discovery

| Variable               | Default                                     | Purpose                                  |
| ---------------------- | ------------------------------------------- | ---------------------------------------- |
| `EIDOLON_PYTHON`       | `python3` on PATH                           | Execute the embedded project generator   |
| `EIDOLON_CLANG`        | `clang` on PATH                             | Compile generated AArch64 assembly and C |
| `EIDOLON_CLANG_FORMAT` | `clang-format` on PATH                      | Format editable C sources and headers    |
| `EIDOLON_LLD`          | `ld.lld` on PATH                            | Link the bare-metal ELF                  |
| `EIDOLON_QEMU`         | Repository `build/qemu/qemu-system-aarch64` | Execute the guest                        |

A desktop app launched from a GUI may not inherit your terminal's PATH or exports. Start it from the configured environment. An installation outside the source checkout must set `EIDOLON_QEMU` explicitly. Paths are passed as executable arguments, never shell commands. See [BARE_METAL.md](BARE_METAL.md) for operation, generated artifact locations and smoke tests.

QEMU's configure step can download Python build packages and pinned subprojects. It manages Meson and other Python dependencies in its build environment; users should not install arbitrary global pip packages to work around errors. Network access may be needed during initial setup. After tools have been provisioned, the hello-world Run action generates/builds locally and performs no dependency downloads.

## Verified versions and dependency records

The macOS arm64 hello-world smoke test used Apple Clang 21.0.0, LLD 23.1.4 and QEMU 11.1.2. The native build used Rust/Cargo 1.99.1. The QEMU build used Python 3.14.7, Ninja 1.13.2, GLib 2.90.1 and Pixman 0.46.4. The pinned QEMU source requires Python 3.9+, Meson 1.5+ and GLib 2.66+. These tested versions are a verification record, not a claim that every host package must have exactly those versions.

Application dependencies are installed through package managers rather than copied into the source tree:

- `package.json` and `bun.lock`: React 19, React Flow 12, Tauri's JavaScript API/CLI 2, CodeMirror 6, CodeMirror Vim, JetBrains Mono, happy-dom (DOM tests), Vite, TypeScript, Prettier, and supporting packages.
- `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`: Tauri 2, Serde/serde_json, SHA-256 hashing via sha2, tauri-build and their Rust dependencies.
- The `third_party/qemu` Git submodule and [QEMU.md](QEMU.md): exact QEMU release, commit and build policy. QEMU manages its own build dependencies and licenses.
- Generated `plan.json` and `run.json`: recipe, source hashes, exact command arguments, executable paths and compiler/linker/QEMU version output for each run.

Use `bun install --frozen-lockfile` and Cargo's `--locked` option to preserve application dependency resolution. Firmware source generation is deterministic for the same recipe/generator; reproducing identical binaries also requires the same toolchain. See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) for major dependency licenses.

The source editor bundles MIT-licensed CodeMirror 6 and
`@replit/codemirror-vim`. Optional C/header formatting requires a host
`clang-format` executable (LLVM, Apache-2.0 with LLVM exceptions); it is invoked
as a separate tool and is not bundled. Set `EIDOLON_CLANG_FORMAT` to override its
location. No formatter is downloaded at runtime.
