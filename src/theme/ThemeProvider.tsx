import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ThemeStore, ThemeSnapshot } from "./theme-store";
const fallbackSnapshot: ThemeSnapshot = {
  preference: "dark",
  resolved: "dark",
};
const fallback: ThemeStore = {
  getSnapshot: () => fallbackSnapshot,
  subscribe: () => () => {},
  setPreference: () => {},
  destroy: () => {},
};
const ThemeContext = createContext<ThemeStore>(fallback);
export function ThemeProvider({
  store,
  children,
}: {
  store: ThemeStore;
  children: ReactNode;
}) {
  return (
    <ThemeContext.Provider value={store}>{children}</ThemeContext.Provider>
  );
}
export function useTheme() {
  const store = useContext(ThemeContext);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return { ...snapshot, setPreference: store.setPreference };
}
