export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type ThemeSnapshot = Readonly<{
  preference: ThemePreference;
  resolved: ResolvedTheme;
}>;
const storageKey = "eidolon.theme";
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}
export function createThemeStore({
  root,
  media,
  storage,
}: {
  root: Pick<HTMLElement, "setAttribute">;
  media: Pick<
    MediaQueryList,
    "matches" | "addEventListener" | "removeEventListener"
  >;
  storage?: Pick<Storage, "getItem" | "setItem">;
}) {
  let preference: ThemePreference = "system";
  try {
    const saved = storage?.getItem(storageKey);
    if (isThemePreference(saved)) preference = saved;
  } catch {
    /* Storage is optional. */
  }
  const resolve = (): ResolvedTheme =>
    preference === "system" ? (media.matches ? "dark" : "light") : preference;
  let snapshot: ThemeSnapshot = { preference, resolved: resolve() };
  const listeners = new Set<() => void>();
  const apply = () => {
    const resolved = resolve();
    root.setAttribute("data-theme", resolved);
    if (snapshot.preference === preference && snapshot.resolved === resolved)
      return;
    snapshot = { preference, resolved };
    listeners.forEach((listener) => listener());
  };
  apply();
  const onSystemChange = () => {
    if (preference === "system") apply();
  };
  media.addEventListener("change", onSystemChange);
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setPreference: (next: ThemePreference) => {
      preference = next;
      try {
        storage?.setItem(storageKey, next);
      } catch {
        /* Keep the session preference. */
      }
      apply();
    },
    destroy: () => {
      media.removeEventListener("change", onSystemChange);
      listeners.clear();
    },
  };
}
export type ThemeStore = ReturnType<typeof createThemeStore>;
