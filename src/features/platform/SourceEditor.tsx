import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit, StreamLanguage } from "@codemirror/language";
import { cpp } from "@codemirror/lang-cpp";
import { json } from "@codemirror/lang-json";
import { gasArm } from "@codemirror/legacy-modes/mode/gas";
import { vim } from "@replit/codemirror-vim";

type Props = {
  name: string;
  value: string;
  readOnly: boolean;
  vimMode: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onFormat: () => void;
};

// The parent keys this component by project and filename. Native project files
// remain authoritative; document changes go through the existing draft workflow.
export function SourceEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const settings = useRef(new Compartment());
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: latest.current.value,
        extensions: [
          settings.current.of([]),
          basicSetup,
          indentUnit.of("  "),
          /\.[ch]$/.test(props.name)
            ? cpp()
            : props.name.endsWith(".json")
              ? json()
              : props.name.endsWith(".S")
                ? StreamLanguage.define(gasArm)
                : [],
          Prec.highest(
            keymap.of([
              {
                key: "Mod-s",
                run: () => {
                  latest.current.onSave();
                  return true;
                },
              },
              {
                key: "Alt-Shift-f",
                run: () => {
                  latest.current.onFormat();
                  return true;
                },
              },
            ]),
          ),
          keymap.of([indentWithTab]),
          EditorView.contentAttributes.of({
            "aria-label": `${props.name} source editor`,
          }),
          EditorView.domEventHandlers({
            keydown(event) {
              if (event.key === "Escape" && latest.current.vimMode)
                event.stopPropagation();
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              latest.current.onChange(update.state.doc.toString());
          }),
          EditorView.theme(
            {
              "&": {
                height: "100%",
                backgroundColor: "var(--color-ink)",
                color: "var(--color-text)",
              },
              ".cm-scroller": { overflow: "auto", fontFamily: "inherit" },
              ".cm-content": { caretColor: "var(--color-text)" },
              ".cm-gutters": {
                backgroundColor: "var(--color-ink)",
                color: "var(--color-muted)",
                borderRight: "1px solid var(--color-border)",
              },
              ".cm-activeLine, .cm-activeLineGutter": {
                backgroundColor: "#3772ff12",
              },
              "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
                backgroundColor: "#3772ff40",
              },
              ".cm-cursor": { borderLeftColor: "var(--color-text)" },
            },
            { dark: true },
          ),
        ],
      }),
    });
    view.current = editor;
    return () => {
      view.current = null;
      editor.destroy();
    };
  }, [props.name]);
  useEffect(() => {
    view.current?.dispatch({
      effects: settings.current.reconfigure([
        props.vimMode ? vim({ status: true }) : [],
        EditorState.readOnly.of(props.readOnly),
        EditorView.editable.of(!props.readOnly),
      ]),
    });
  }, [props.readOnly, props.vimMode]);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== props.value)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: props.value },
      });
  }, [props.value]);
  return <div className="source-editor" ref={host} />;
}
