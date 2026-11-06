"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useBindable } from "@/components/shared/use-bindable";
import "./rich-text-editor.css";

export type TitleEditorHandle = { focus: () => void };

type TitleEditorProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  className?: string;
  ref?: React.Ref<TitleEditorHandle>;
};

const toDoc = (text: string): JSONContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
});

export function TitleEditor({
  value: valueProp = "",
  onValueChange,
  onChange,
  onBlur,
  placeholder = "Title",
  className = "",
  ref,
}: TitleEditorProps) {
  const [value, setValue] = useBindable(valueProp, onValueChange);
  const valueRef = useRef(value);
  valueRef.current = value;
  const handlersRef = useRef({ setValue, onChange, onBlur });
  handlersRef.current = { setValue, onChange, onBlur };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: toDoc(value),
    editorProps: {
      attributes: { class: `title-editor outline-none ${className}` },
      handleKeyDown: (view, event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          handlersRef.current.onBlur?.(view.state.doc.textBetween(0, view.state.doc.content.size, "\n"));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      if (text === valueRef.current) return;
      handlersRef.current.setValue(text);
      handlersRef.current.onChange?.(text);
    },
    onBlur: ({ editor }) => handlersRef.current.onBlur?.(editor.getText()),
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.getText() !== value) {
      editor.commands.setContent(toDoc(value), { emitUpdate: false });
    }
  }, [editor, value]);

  useImperativeHandle(ref, () => ({ focus: () => editor?.commands.focus() }), [editor]);

  return <EditorContent editor={editor} className="w-full" />;
}
