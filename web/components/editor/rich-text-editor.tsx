"use client";

import { useEffect, useRef } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import type { EditorView } from "@tiptap/pm/view";
import { useBindable } from "@/components/shared/use-bindable";
import { RichTextEditor as EditorUI, Link } from "./index";
import "./style.css";

type RichTextEditorProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
};

function readAsDataUrl(file: File, onLoad: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    if (dataUrl) onLoad(dataUrl);
  };
  reader.readAsDataURL(file);
}

function handlePaste(view: EditorView, event: ClipboardEvent) {
  const items = event.clipboardData?.items;
  if (!items) return false;
  for (const item of items) {
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (!file) continue;
    readAsDataUrl(file, (dataUrl) => {
      view.dispatch(
        view.state.tr.replaceSelectionWith(
          view.state.schema.nodes.image.create({ src: dataUrl }),
        ),
      );
    });
    return true;
  }
  return false;
}

function handleDrop(view: EditorView, event: DragEvent) {
  const files = event.dataTransfer?.files;
  if (!files) return false;
  for (const file of Array.from(files)) {
    if (!file.type.startsWith("image/")) continue;
    readAsDataUrl(file, (dataUrl) => {
      const coordinates = view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });
      if (!coordinates) return;
      view.dispatch(
        view.state.tr.insert(
          coordinates.pos,
          view.state.schema.nodes.image.create({ src: dataUrl }),
        ),
      );
    });
    return true;
  }
  return false;
}

/** Markdown in, markdown out. The toolbar only offers formatting that markdown can store. */
export function RichTextEditor({
  value: valueProp = "",
  onValueChange,
  onChange,
  placeholder = "Write something...",
  className = "",
}: RichTextEditorProps) {
  const [value, setValue] = useBindable(valueProp, onValueChange);
  const valueRef = useRef(value);
  valueRef.current = value;
  const emitRef = useRef<(markdown: string) => void>(() => {});
  emitRef.current = (markdown) => {
    if (markdown === valueRef.current) return;
    setValue(markdown);
    onChange?.(markdown);
  };

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Markdown,
      Link,
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full my-4 cursor-zoom-in" },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: `outline-none min-h-[150px] ${className}`,
      },
      handlePaste: (view, event) => handlePaste(view, event),
      handleDrop: (view, event) => handleDrop(view, event),
    },
    onUpdate: ({ editor }) => emitRef.current(editor.getMarkdown()),
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.getMarkdown() !== value) {
      editor.commands.setContent(value, {
        emitUpdate: false,
        contentType: "markdown",
      });
    }
  }, [editor, value]);

  return (
    <EditorUI editor={editor}>
      <EditorUI.Toolbar>
        <EditorUI.ControlsGroup>
          <EditorUI.Bold />
          <EditorUI.Italic />
          <EditorUI.Strikethrough />
          <EditorUI.Code />
        </EditorUI.ControlsGroup>
        <EditorUI.ControlsGroup>
          <EditorUI.H1 />
          <EditorUI.H2 />
          <EditorUI.H3 />
        </EditorUI.ControlsGroup>
        <EditorUI.ControlsGroup>
          <EditorUI.BulletList />
          <EditorUI.OrderedList />
          <EditorUI.Blockquote />
          <EditorUI.Hr />
        </EditorUI.ControlsGroup>
        <EditorUI.ControlsGroup>
          <EditorUI.Link />
          <EditorUI.Unlink />
        </EditorUI.ControlsGroup>
        <EditorUI.ControlsGroup>
          <EditorUI.Undo />
          <EditorUI.Redo />
        </EditorUI.ControlsGroup>
      </EditorUI.Toolbar>
      <EditorUI.BubbleMenu editor={editor} />
      <EditorUI.Content />
    </EditorUI>
  );
}
