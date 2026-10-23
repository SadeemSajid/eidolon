import { useTheme } from "./ThemeProvider";
import { isThemePreference } from "./theme-store";
export function ThemePicker() {
  const { preference, setPreference } = useTheme();
  return (
    <label className="theme-picker">
      <span className="sr-only">Color theme</span>
      <select
        aria-label="Color theme"
        value={preference}
        onChange={(event) => {
          if (isThemePreference(event.target.value))
            setPreference(event.target.value);
        }}
      >
        <option value="system">System</option>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </label>
  );
}
