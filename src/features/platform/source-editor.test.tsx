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
