// Explicit fallback for Linux hosts without working GPU access. Set environment
// before launching WebKitGTK, without changing the user's system configuration.
import { spawn } from "node:child_process";
const args = process.argv.slice(2);
const child = spawn(
  "bun",
  ["run", "tauri", ...(args.length ? args : ["dev"])],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ...(process.platform === "linux"
        ? {
            LIBGL_ALWAYS_SOFTWARE: "1",
            WEBKIT_DISABLE_DMABUF_RENDERER: "1",
            WEBKIT_DISABLE_COMPOSITING_MODE: "1",
          }
        : {}),
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
