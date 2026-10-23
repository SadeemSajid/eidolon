import { useCallback, useEffect, useState } from "react";
import defaultPlatform from "../../../platforms/arm-virt-a55.json";
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

export type BuildProgress = { stage: string; message: string };
export type SourceFile = { name: string; content: string; editable: boolean };
export type ProjectFiles = { directory: string; files: SourceFile[] };
export type CleanScope = "outputs" | "projects" | "full";
export type CleanPreview = { targets: string[]; includesQemu: boolean };
export type PlatformSnapshot = {
  state:
    "idle" | "ready" | "building" | "running" | "stopped" | "exited" | "failed";
  boardId: string | null;
  serial: string;
  message: string;
  artifactDirectory: string | null;
  helloVerified: boolean;
  sourceEdited: boolean;
};
const initial: PlatformSnapshot = {
  state: "idle",
  boardId: null,
  serial: "",
  message: "",
  artifactDirectory: null,
  helloVerified: false,
  sourceEdited: false,
};

export function usePlatformRuntime() {
  const desktop = isTauri();
  const [platformDraft, setPlatformDraft] = useState(
    JSON.stringify(defaultPlatform, null, 2),
  );
  const [formatOnSave, setFormatOnSave] = useState(() => {
    try {
      return localStorage.getItem("eidolon.editor.formatOnSave") === "true";
    } catch {
      return false;
    }
  });
  const [snapshot, setSnapshot] = useState(initial);
  const [busy, setBusy] = useState<
    | "building"
    | "stopping"
    | "generating"
    | "saving"
    | "cleaning"
    | "formatting"
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [buildProgress, setBuildProgress] = useState<BuildProgress[]>([]);
  const [project, setProject] = useState<ProjectFiles | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const edits =
    project?.files
      .filter(
        (file) =>
          file.editable &&
          drafts[file.name] !== undefined &&
          drafts[file.name] !== file.content,
      )
      .map((file) => ({ name: file.name, content: drafts[file.name] })) ?? [];
  const dirty = edits.length > 0;
  const refreshProject = useCallback(async (preserveDrafts = false) => {
    const next = await invoke<ProjectFiles | null>("project_files");
    setProject(next);
    setDrafts((current) =>
      Object.fromEntries(
        next?.files.map((file) => [
          file.name,
          preserveDrafts && file.editable
            ? (current[file.name] ?? file.content)
            : file.content,
        ]) ?? [],
      ),
    );
    return next;
  }, []);
  useEffect(() => {
    if (desktop)
      void refreshProject()
        .then((next) => {
          const description = next?.files.find(
            (file) => file.name === "platform.json",
          );
          if (description) setPlatformDraft(description.content);
        })
        .catch((failure) => setError(String(failure)));
  }, [desktop, refreshProject]);
  useEffect(() => {
    if (!desktop || busy) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await invoke<PlatformSnapshot>("platform_status");
        if (!cancelled)
          setSnapshot((current) =>
            JSON.stringify(current) === JSON.stringify(next) ? current : next,
          );
      } catch (failure) {
        if (!cancelled) setError(String(failure));
      }
      if (!cancelled) timer = setTimeout(poll, 500);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [desktop, busy]);

  const prepareEdits = async () => {
    if (!formatOnSave) return edits;
    const formatted: { name: string; content: string }[] = [];
    for (const edit of edits) {
      formatted.push(
        /\.[ch]$/.test(edit.name)
          ? { ...edit, content: await invoke<string>("format_source", edit) }
          : edit,
      );
    }
    // Keep all drafts if any formatter invocation fails; never save a partial set.
    setDrafts((current) => ({
      ...current,
      ...Object.fromEntries(formatted.map((edit) => [edit.name, edit.content])),
    }));
    return formatted;
  };
  const run = async (boardId: string) => {
    if (!desktop || busy || snapshot.state === "running") return;
    setError(null);
    setBusy("building");
    setBuildProgress([]);
    let saved = false;
    try {
      if (edits.length)
        await invoke("save_sources", { edits: await prepareEdits() });
      saved = true;
      setSnapshot((current) => ({
        ...current,
        state: "building",
        boardId,
        serial: "",
      }));
      const progress = new Channel<BuildProgress>((update) =>
        setBuildProgress((current) => [...current.slice(-199), update]),
      );
      setSnapshot(
        await invoke<PlatformSnapshot>("run_platform", { boardId, progress }),
      );
    } catch (failure) {
      setError(String(failure));
      setSnapshot(
        await invoke<PlatformSnapshot>("platform_status").catch(() => ({
          ...initial,
          state: "failed" as const,
          boardId,
        })),
      );
    } finally {
      if (saved)
        await refreshProject().catch((failure) => setError(String(failure)));
      setBusy(null);
    }
  };
  const save = async () => {
    if (!desktop || busy || !dirty || snapshot.state === "running") return;
    setBusy("saving");
    setError(null);
    try {
      setSnapshot(
        await invoke<PlatformSnapshot>("save_sources", {
          edits: await prepareEdits(),
        }),
      );
      await refreshProject();
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(null);
    }
  };
  const formatSource = async (name: string) => {
    const file = project?.files.find((item) => item.name === name);
    if (
      !desktop ||
      busy ||
      snapshot.state === "running" ||
      !file?.editable ||
      !/\.[ch]$/.test(name)
    )
      return;
    const content = drafts[name] ?? file.content;
    setBusy("formatting");
    setError(null);
    try {
      const formatted = await invoke<string>("format_source", {
        name,
        content,
      });
      setDrafts((current) =>
        current[name] === content ? { ...current, [name]: formatted } : current,
      );
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(null);
    }
  };
  const regenerate = async () => {
    if (!desktop || busy || snapshot.state === "running") return false;
    setBusy("generating");
    setError(null);
    try {
      setSnapshot(
        await invoke<PlatformSnapshot>("regenerate_project", {
          boardId: "arm-virt-a55",
        }),
      );
      await refreshProject();
      setBuildProgress([]);
      return true;
    } catch (failure) {
      setError(String(failure));
      return false;
    } finally {
      setBusy(null);
    }
  };
  const configurePlatform = async () => {
    if (!desktop || busy || snapshot.state === "running") return false;
    setBusy("generating");
    setError(null);
    try {
      setSnapshot(
        await invoke<PlatformSnapshot>("configure_platform", {
          descriptionJson: platformDraft,
        }),
      );
      const next = await refreshProject();
      const description = next?.files.find(
        (file) => file.name === "platform.json",
      );
      if (description) setPlatformDraft(description.content);
      setBuildProgress([]);
      return true;
    } catch (failure) {
      setError(String(failure));
      return false;
    } finally {
      setBusy(null);
    }
  };
  const previewCleanup = async (scope: CleanScope) => {
    if (!desktop || busy || snapshot.state === "running") return null;
    setError(null);
    try {
      return await invoke<CleanPreview>("preview_cleanup", { scope });
    } catch (failure) {
      setError(String(failure));
      return null;
    }
  };
  const clean = async (scope: CleanScope, preview: CleanPreview) => {
    if (!desktop || busy || snapshot.state === "running") return false;
    setBusy("cleaning");
    setError(null);
    try {
      setSnapshot(
        await invoke<PlatformSnapshot>("clean_platform", {
          scope,
          expectedTargets: preview.targets,
        }),
      );
      await refreshProject(scope === "outputs");
      setBuildProgress([]);
      return true;
    } catch (failure) {
      setError(String(failure));
      return false;
    } finally {
      setBusy(null);
    }
  };
  const stop = async () => {
    if (!desktop || busy) return;
    setError(null);
    setBusy("stopping");
    try {
      setSnapshot(await invoke<PlatformSnapshot>("stop_platform"));
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(null);
    }
  };
  return {
    desktop,
    snapshot,
    busy,
    error,
    buildProgress,
    project,
    drafts,
    dirty,
    run,
    stop,
    save,
    formatSource,
    formatOnSave,
    setFormatOnSave: (enabled: boolean) => {
      setFormatOnSave(enabled);
      try {
        localStorage.setItem("eidolon.editor.formatOnSave", String(enabled));
      } catch {
        /* Optional preference. */
      }
    },
    regenerate,
    configurePlatform,
    platformDraft,
    setPlatformDraft,
    previewCleanup,
    clean,
    setDraft: (name: string, content: string) =>
      setDrafts((current) => ({ ...current, [name]: content })),
  };
}
export type PlatformRuntime = ReturnType<typeof usePlatformRuntime>;
