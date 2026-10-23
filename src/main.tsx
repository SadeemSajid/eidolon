import "./theme/themes.css";
import { createThemeStore } from "./theme/theme-store";
import { ThemeProvider } from "./theme/ThemeProvider";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Apply the resolved preference before mounting the app. Storage can be blocked.
let storage: Storage | undefined;
try {
  storage = window.localStorage;
} catch {
  /* Session-only theming. */
}
const themeStore = createThemeStore({
  root: document.documentElement,
  media: window.matchMedia("(prefers-color-scheme: dark)"),
  storage,
});
if (import.meta.hot) import.meta.hot.dispose(() => themeStore.destroy());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider store={themeStore}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
