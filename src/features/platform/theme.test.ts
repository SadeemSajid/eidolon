import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createThemeStore } from "../../theme/theme-store";

function fixture(saved: string | null = null, blocked = false) {
  const events = new EventTarget();
  const media = {
    matches: false,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  let applied = "";
  let persisted = saved;
  const store = createThemeStore({
    root: {
      setAttribute: (_name, value) => {
        applied = value;
      },
    },
    media,
    storage: {
      getItem: () => {
        if (blocked) throw Error("blocked");
        return saved;
      },
      setItem: (_name, value) => {
        if (blocked) throw Error("blocked");
        persisted = value;
      },
    },
  });
  return {
    store,
    applied: () => applied,
    persisted: () => persisted,
    system: (dark: boolean) => {
      media.matches = dark;
      events.dispatchEvent(new Event("change"));
    },
  };
}

test("saved overrides, live system changes and persistence resolve independently", () => {
  const env = fixture("dark");
  let changes = 0;
  const unsubscribe = env.store.subscribe(() => {
    changes++;
  });
  try {
    assert.equal(env.applied(), "dark");
    env.system(true);
    env.system(false);
    assert.equal(changes, 0);
    env.store.setPreference("system");
    assert.deepEqual(env.store.getSnapshot(), {
      preference: "system",
      resolved: "light",
    });
    assert.equal(env.persisted(), "system");
    env.system(true);
    assert.equal(env.applied(), "dark");
    env.store.setPreference("light");
    env.system(false);
    env.system(true);
    assert.equal(env.applied(), "light");
    assert.equal(changes, 3);
    unsubscribe();
    env.store.setPreference("dark");
    assert.equal(changes, 3);
  } finally {
    env.store.destroy();
  }
});

test("invalid or inaccessible preferences fall back to System and remain usable", () => {
  for (const env of [fixture("sepia"), fixture(null, true)]) {
    try {
      assert.deepEqual(env.store.getSnapshot(), {
        preference: "system",
        resolved: "light",
      });
      env.store.setPreference("dark");
      assert.equal(env.applied(), "dark");
      env.store.setPreference("system");
      env.system(true);
      assert.deepEqual(env.store.getSnapshot(), {
        preference: "system",
        resolved: "dark",
      });
    } finally {
      env.store.destroy();
    }
  }
});

test("light and dark supply the same palette roles and components use shared tokens", () => {
  const source = readFileSync(
    new URL("../../theme/themes.css", import.meta.url),
    "utf8",
  );
  const dark = source.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)![1];
  const light = source.match(/:root\[data-theme="light"\]\s*\{([^}]+)\}/)![1];
  const tokens = (value: string) =>
    [...value.matchAll(/(--color-[\w-]+):/g)].map((match) => match[1]).sort();
  assert.deepEqual(tokens(dark), tokens(light));
  for (const path of [
    "../../App.css",
    "../../App.tsx",
    "./diagram.ts",
    "./SourceEditor.tsx",
  ])
    assert.doesNotMatch(
      readFileSync(new URL(path, import.meta.url), "utf8"),
      /#[0-9a-f]{3,8}\b/i,
    );
});
