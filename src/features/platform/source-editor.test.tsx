import { SettingsMenu } from "../../theme/SettingsMenu";
import { EditorView } from "@codemirror/view";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { createThemeStore } from "../../theme/theme-store";
import { after as afterAll, before as beforeAll, test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SourceEditor } from "./SourceEditor";
import { PlatformLibrary } from "./PlatformLibrary";

const window = new Window();
const keys = [
  "window",
  "document",
  "navigator",
  "MutationObserver",
  "ResizeObserver",
  "HTMLElement",
  "Node",
  "DOMRect",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "IS_REACT_ACT_ENVIRONMENT",
] as const;
const previous = new Map(
  keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
);
beforeAll(() => {
  const values = {
    window,
    document: window.document,
    navigator: window.navigator,
    MutationObserver: window.MutationObserver,
    ResizeObserver: window.ResizeObserver,
    HTMLElement: window.HTMLElement,
    Node: window.Node,
    DOMRect: window.DOMRect,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const key of keys)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: values[key],
    });
});
afterAll(() => {
  window.happyDOM.abort();
  for (const key of keys) {
    const descriptor = previous.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test("Vim editing, Escape isolation, shortcuts and read-only reconfiguration", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let changed = "";
  let saved = 0;
  let formatted = 0;
  let escaped = false;
  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented) escaped = true;
  });
  const props = {
    name: "main.c",
    value: "int x;",
    readOnly: false,
    vimMode: true,
    onChange: (value: string) => {
      changed = value;
    },
    onSave: () => {
      saved++;
    },
    onFormat: () => {
      formatted++;
    },
  };
  try {
    await act(async () => {
      root.render(<SourceEditor {...props} />);
    });
    const content = host.querySelector<HTMLElement>(".cm-content")!;
    assert.equal(content.getAttribute("aria-label"), "main.c source editor");
    content.focus();
    const key = async (key: string, extra = {}) => {
      await act(async () => {
        content.dispatchEvent(
          new window.KeyboardEvent("keydown", {
            key,
            bubbles: true,
            cancelable: true,
            ...extra,
          }) as unknown as Event,
        );
      });
    };
    // Vim's x command mutates the document in normal mode.
    await key("x");
    assert.equal(changed, "nt x;");
    await key("i");
    await key("Escape");
    assert.equal(escaped, false);
    await key("s", { ctrlKey: true });
    assert.equal(saved, 1);
    await key("F", { altKey: true, shiftKey: true, code: "KeyF", keyCode: 70 });
    assert.equal(formatted, 1);
    await act(async () => {
      root.render(<SourceEditor {...props} value={changed} readOnly />);
    });
    assert.equal(content.getAttribute("contenteditable"), "false");
    const original = changed;
    await key("x");
    assert.equal(changed, original);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test("library cards stay concise and component readiness is accessible through keyboard tabs", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <PlatformLibrary boardId="arm-virt-a55" onSelect={() => {}} />,
      ),
    );
    const cards = host.querySelectorAll(".board-card");
    assert.equal(cards.length, 14);
    for (const card of cards)
      assert.doesNotMatch(
        card.textContent ?? "",
        /QEMU|captured inventory|11\.1\.2/i,
      );
    const tabs = host.querySelector<HTMLElement>("[role=tablist]")!;
    await act(async () => {
      tabs.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        }) as unknown as Event,
      );
    });
    const componentTab = host.querySelector<HTMLElement>(
      "#components-library-tab",
    )!;
    assert.equal(componentTab.getAttribute("aria-selected"), "true");
    assert.equal(document.activeElement, componentTab);
    const panel = host.querySelector<HTMLElement>("#components-library-panel")!;
    assert.equal(panel.hidden, false);
    assert.equal(panel.querySelectorAll("article").length, 3);
    assert.match(panel.textContent ?? "", /Bare-metal driver/);
    assert.match(panel.textContent ?? "", /Backend needed/);
    for (const model of ["PL011", "PL031", "PL061"])
      assert.ok(panel.textContent?.includes(model));
    await act(async () => {
      tabs.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "End",
          bubbles: true,
          cancelable: true,
        }) as unknown as Event,
      );
    });
    assert.equal(
      host.querySelector("#custom-library-tab")?.getAttribute("aria-selected"),
      "true",
    );
    await act(async () => {
      tabs.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        }) as unknown as Event,
      );
    });
    assert.equal(
      host.querySelector("#boards-library-tab")?.getAttribute("aria-selected"),
      "true",
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test("theme changes preserve the editor instance, draft and undo history", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const store = createThemeStore({
    root: document.documentElement,
    media: window.matchMedia(
      "(prefers-color-scheme: dark)",
    ) as unknown as MediaQueryList,
    storage: { getItem: () => "dark", setItem: () => {} },
  });
  let draft = "int x;";
  try {
    await act(async () =>
      root.render(
        <ThemeProvider store={store}>
          <SourceEditor
            name="main.c"
            value={draft}
            readOnly={false}
            vimMode={true}
            onChange={(value) => {
              draft = value;
            }}
            onSave={() => {}}
            onFormat={() => {}}
          />
        </ThemeProvider>,
      ),
    );
    const content = host.querySelector<HTMLElement>(".cm-content")!;
    const editor = EditorView.findFromDOM(content)!;
    assert.equal(editor.state.facet(EditorView.darkTheme), true);
    content.focus();
    await act(async () => {
      content.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "x",
          bubbles: true,
          cancelable: true,
        }) as unknown as Event,
      );
    });
    assert.equal(draft, "nt x;");
    await act(async () => store.setPreference("light"));
    assert.equal(EditorView.findFromDOM(content), editor);
    assert.equal(editor.state.facet(EditorView.darkTheme), false);
    assert.equal(editor.state.doc.toString(), "nt x;");
    await act(async () => {
      content.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "u",
          bubbles: true,
          cancelable: true,
        }) as unknown as Event,
      );
    });
    assert.equal(draft, "int x;");
  } finally {
    await act(async () => root.unmount());
    store.destroy();
    host.remove();
    document.documentElement.removeAttribute("data-theme");
  }
});

test("footer settings focuses the native theme control and dismisses with Escape or outside click", async () => {
  const host = document.createElement("div");
  const outside = document.createElement("button");
  document.body.append(host, outside);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SettingsMenu />));
    const trigger = host.querySelector<HTMLButtonElement>("button")!;
    assert.equal(trigger.getAttribute("aria-expanded"), "false");
    await act(async () => trigger.click());
    const select = host.querySelector<HTMLSelectElement>("select")!;
    assert.equal(trigger.getAttribute("aria-expanded"), "true");
    assert.equal(document.activeElement, select);
    assert.equal(
      host.querySelector("[role=dialog]")?.getAttribute("aria-label"),
      "Settings",
    );
    await act(async () => {
      select.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }) as unknown as Event,
      );
    });
    assert.equal(host.querySelector("[role=dialog]"), null);
    assert.equal(document.activeElement, trigger);
    await act(async () => trigger.click());
    await act(async () => {
      outside.dispatchEvent(
        new window.MouseEvent("pointerdown", {
          bubbles: true,
        }) as unknown as Event,
      );
    });
    assert.equal(trigger.getAttribute("aria-expanded"), "false");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    outside.remove();
  }
});
