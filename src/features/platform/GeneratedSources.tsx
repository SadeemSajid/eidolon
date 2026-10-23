import { lazy, Suspense, useEffect, useState } from "react";
const SourceEditor = lazy(() =>
  import("./SourceEditor").then((module) => ({ default: module.SourceEditor })),
);
import type {
  CleanPreview,
  CleanScope,
  PlatformRuntime,
} from "./usePlatformRuntime";

export function GeneratedSources({ runtime }: { runtime: PlatformRuntime }) {
  const { project, drafts, dirty, busy, desktop, snapshot } = runtime;
  const [vimMode, setVimMode] = useState(() => {
    try {
      return localStorage.getItem("eidolon.editor.vim") === "true";
    } catch {
      return false;
    }
  });
  const [selected, setSelected] = useState("main.c");
  const [scope, setScope] = useState<CleanScope>("outputs");
  const [confirmation, setConfirmation] = useState<
    | { type: "regenerate" }
    | { type: "clean"; scope: CleanScope; preview: CleanPreview }
    | null
  >(null);
  const [previewing, setPreviewing] = useState(false);
  const locked =
    !desktop || !!busy || snapshot.state === "running" || previewing;
  const file =
    project?.files.find((item) => item.name === selected) ?? project?.files[0];
  const text = file ? (drafts[file.name] ?? file.content) : "";
  useEffect(() => {
    setConfirmation(null);
  }, [project?.directory]);
  const reviewClean = async () => {
    setPreviewing(true);
    const preview = await runtime.previewCleanup(scope);
    if (preview) setConfirmation({ type: "clean", scope, preview });
    setPreviewing(false);
  };
  return (
    <div className="source-workspace">
      <div className="source-toolbar">
        {snapshot.state === "running" && (
          <button disabled={!!busy} onClick={() => void runtime.stop()}>
            Stop platform
          </button>
        )}
        <button
          disabled={locked || !dirty || !!confirmation}
          onClick={() => void runtime.save()}
        >
          Save
        </button>
        <button
          disabled={locked || !project || !!confirmation}
          onClick={() => void runtime.run("arm-virt-a55")}
        >
          {dirty ? "Save & run" : "Rebuild & run"}
        </button>
        <button
          disabled={locked || !!confirmation}
          onClick={() =>
            project || dirty
              ? setConfirmation({ type: "regenerate" })
              : void runtime.regenerate()
          }
        >
          {project ? "Regenerate" : "Generate sources"}
        </button>
        <button
          disabled={
            locked ||
            !!confirmation ||
            !file?.editable ||
            !/\.[ch]$/.test(file.name)
          }
          onClick={() => file && void runtime.formatSource(file.name)}
        >
          Format
        </button>
        <label className="editor-preference">
          <input
            type="checkbox"
            checked={vimMode}
            onChange={(event) => {
              setVimMode(event.target.checked);
              try {
                localStorage.setItem(
                  "eidolon.editor.vim",
                  String(event.target.checked),
                );
              } catch {
                /* Preferences are optional. */
              }
            }}
          />{" "}
          Vim
        </label>
        <label className="editor-preference">
          <input
            type="checkbox"
            checked={runtime.formatOnSave}
            disabled={locked || !!confirmation}
            onChange={(event) => runtime.setFormatOnSave(event.target.checked)}
          />{" "}
          Format on save
        </label>
        <span className="source-state">
          {snapshot.state === "running"
            ? "Running · stop to edit"
            : dirty
              ? "Unsaved changes"
              : snapshot.sourceEdited
                ? "Edited sources"
                : "Generated sources"}
        </span>
        <select
          aria-label="Cleanup scope"
          value={scope}
          disabled={locked || !!confirmation}
          onChange={(event) => setScope(event.target.value as CleanScope)}
        >
          <option value="outputs">Build outputs only</option>
          <option value="projects">Generated projects · keep QEMU</option>
          <option value="full">Full local clean · includes QEMU build</option>
        </select>
        <button
          disabled={locked || !!confirmation}
          onClick={() => void reviewClean()}
        >
          Clean…
        </button>
      </div>
      {runtime.error && (
        <p className="runtime-error source-error" role="alert">
          {runtime.error}
        </p>
      )}
      {confirmation && (
        <div
          className="source-confirmation"
          role="region"
          aria-label="Confirm project action"
        >
          {confirmation.type === "regenerate" ? (
            <p>
              Create a fresh project from the active platform description?
              Unsaved edits will be discarded. The previous project remains on
              disk.
            </p>
          ) : (
            <>
              <p>
                Delete the paths below?{" "}
                {confirmation.scope !== "outputs" &&
                  "Saved source edits in these projects will be deleted. "}
                {confirmation.scope !== "outputs" &&
                  dirty &&
                  "Unsaved edits will be discarded. "}
                {confirmation.preview.includesQemu
                  ? "The local QEMU build will be removed; its source and host tools will remain."
                  : "QEMU and host tools will be preserved."}
              </p>
              <pre>
                {confirmation.preview.targets.join("\n") ||
                  "No matching files to delete."}
              </pre>
            </>
          )}
          <button
            disabled={
              locked ||
              (confirmation.type === "clean" &&
                !confirmation.preview.targets.length)
            }
            onClick={async () => {
              const success =
                confirmation.type === "regenerate"
                  ? await runtime.regenerate()
                  : await runtime.clean(
                      confirmation.scope,
                      confirmation.preview,
                    );
              if (success) setConfirmation(null);
            }}
          >
            {confirmation.type === "regenerate"
              ? "Generate fresh project"
              : "Delete selected files"}
          </button>
          <button disabled={!!busy} onClick={() => setConfirmation(null)}>
            Cancel
          </button>
        </div>
      )}
      {project ? (
        <div className="source-editor-layout">
          <nav className="source-files" aria-label="Generated files">
            {project.files.map((item) => (
              <button
                key={item.name}
                aria-current={file?.name === item.name ? "page" : undefined}
                onClick={() => setSelected(item.name)}
              >
                {item.name}
                {item.editable && drafts[item.name] !== item.content
                  ? " *"
                  : ""}
                {!item.editable && <span>read only</span>}
              </button>
            ))}
          </nav>
          {file && (
            <Suspense
              fallback={<p className="source-empty">Loading editor…</p>}
            >
              <SourceEditor
                key={`${project.directory}/${file.name}`}
                name={file.name}
                value={text}
                readOnly={!file.editable || locked || !!confirmation}
                vimMode={vimMode}
                onChange={(value) => runtime.setDraft(file.name, value)}
                onSave={() => {
                  if (!locked && !confirmation) void runtime.save();
                }}
                onFormat={() => {
                  if (!locked && !confirmation)
                    void runtime.formatSource(file.name);
                }}
              />
            </Suspense>
          )}
        </div>
      ) : (
        <p className="source-empty">
          {desktop
            ? "Generate sources to inspect and edit the bare-metal project."
            : "Generated sources are available in the desktop app."}
        </p>
      )}
      {project && (
        <div className="source-location" title={project.directory}>
          {project.directory}
        </div>
      )}
    </div>
  );
}
