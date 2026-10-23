import { useTheme } from "../../theme/ThemeProvider";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import {
  indentUnit,
  StreamLanguage,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
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
  const { resolved } = useTheme();
  const appearance = useRef(new Compartment());
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
          EditorView.theme({
            "&": {
              height: "100%",
              backgroundColor: "var(--color-background)",
              color: "var(--color-foreground)",
            },
            ".cm-scroller": { overflow: "auto", fontFamily: "inherit" },
            ".cm-content": { caretColor: "var(--color-foreground)" },
            ".cm-gutters": {
              backgroundColor: "var(--color-background)",
              color: "var(--color-muted)",
              borderRight: "1px solid var(--color-border)",
            },
            ".cm-activeLine, .cm-activeLineGutter": {
              backgroundColor: "var(--color-editor-active-line)",
            },
            "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
              backgroundColor: "var(--color-selection)",
            },
            ".cm-cursor": { borderLeftColor: "var(--color-foreground)" },
          }),
          appearance.current.of(
            EditorView.theme({}, { dark: resolved === "dark" }),
          ),
          syntaxHighlighting(
            HighlightStyle.define([
              { tag: tags.keyword, color: "var(--color-syntax-keyword)" },
              {
                tag: [tags.string, tags.character],
                color: "var(--color-syntax-string)",
              },
              {
                tag: [tags.number, tags.bool, tags.null],
                color: "var(--color-syntax-number)",
              },
              {
                tag: [tags.typeName, tags.className],
                color: "var(--color-syntax-type)",
              },
              { tag: [tags.comment, tags.meta], color: "var(--color-muted)" },
            ]),
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
    // Change CodeMirror's mode without recreating its document, history or Vim state.
    view.current?.dispatch({
      effects: appearance.current.reconfigure(
        EditorView.theme({}, { dark: resolved === "dark" }),
      ),
    });
  }, [resolved]);
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
