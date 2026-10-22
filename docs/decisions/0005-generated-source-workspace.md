# 0005: Editable generated sources and scoped cleanup

Status: accepted for the Arm virt bare-metal workspace.

The generated project remains separate from the versioned hardware recipe. Keep one active project in the desktop runtime session. The first Run generates a project; subsequent Runs compile that project's saved files. An explicit Generate/Regenerate action creates a new directory from the trusted embedded recipe and generator. Previous project directories remain available on disk until cleanup. This replaces decision 0004's original fresh-directory-on-every-Run behavior.

The footer terminal gains a Sources tab with a lightweight textarea editor. Native commands expose only startup.S, main.c and linker.ld for editing; plan.json and run.json are inspect-only. Filenames are allowlisted, file contents are bounded to 256 KiB, and links cannot redirect source or output access. Changes are saved before Run. Hardware topology, compiler arguments, launch arguments and executable selection cannot be edited through the source-file API. Compilation uses the original trusted in-memory plan, never commands taken from a disk manifest that a user may have modified.

Run records SHA-256 hashes of the actual sources being compiled. Saving or detecting modified source contents marks the project edited. Such firmware is allowed to emit different serial output: it is not labeled as the verified generated hello world, and the original greeting timeout is disabled. Process-exit and cleanup handling remain active. Regeneration resets this classification and restores the tested recipe.

Editing saves, generation, rebuilds and cleanup are serialized in Rust. Saves, regeneration and cleanup require the current guest to be stopped. The frontend keeps unsaved buffers when switching files or terminal tabs; it asks before regeneration or cleanup that would discard those buffers. Output-only cleanup preserves unsaved buffers and saved source files.

Cleanup has three explicit scopes:

- Build outputs: only allowlisted object files, ELF, runtime manifests and logs in the active project. Sources and the generation plan remain.
- Generated projects: recognized Arm virt project directories in the app's bare-metal cache, including source edits. Unknown cache entries are preserved; QEMU remains.
- Full local clean: generated projects plus the repository-local build/qemu directory, only when its configuration identifies this checkout's QEMU source. QEMU source, Cargo/JS dependencies and externally provisioned executables are never removed.

Cleanup first returns an exact path preview. Execution recomputes those paths and requires a match with the user's reviewed list before deleting. The editor, cleanup and file APIs do not accept arbitrary filesystem paths. Tests use temporary fixture directories for full-clean coverage; they do not delete the developer's real QEMU build.

The active-project pointer is session-scoped. Source files persist in the cache, but reopening older cached projects after restarting the desktop app is not yet implemented. A portable saved-project format remains separate work; this feature does not claim to provide one.
