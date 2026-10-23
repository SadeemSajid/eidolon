# 0007: Embedded source editor and host formatting

Status: Accepted

Use CodeMirror 6 with language extensions for the existing generated source
workspace. Offer optional Vim bindings through the maintained CodeMirror Vim
extension, rather than embedding a terminal editor. Keep project files and draft
ownership in the existing runtime hook; the editor only reports text changes.
Read-only files and running/busy states disable editor mutations. Escape must
remain an editor key in Vim mode instead of closing the Code panel.

Formatting belongs behind a narrow Rust command: accept an allowlisted editable
C filename and bounded unsaved text, require a stopped active project, and invoke
host clang-format with argument arrays, stdin/stdout, a fixed style, an output
limit and a timeout. Never load executable options from project configuration,
write a file during Format, or download a tool at runtime. The optional
EIDOLON_CLANG_FORMAT path is a host launch setting.

Format on save is opt-in. Format every eligible changed buffer successfully
before sending the batch to the existing save command. A formatter error leaves
the original drafts intact. Assembly, linker scripts and generated read-only
configuration remain outside C formatting. Missing tools produce actionable
errors; ordinary editing and saving remain available with formatting disabled.

File switches retain drafts but currently reset editor cursor/undo state.
Formatting requires the desktop host. The browser remains a presentation preview.
