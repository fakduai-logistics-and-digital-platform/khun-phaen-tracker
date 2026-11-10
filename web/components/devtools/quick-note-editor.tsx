"use client";

import { useCallback, useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useI18n } from "@/lib/i18n";
import { quickNotes } from "@/lib/stores/quickNotes";

const EDITOR_CLASS = [
  "min-h-[40vh] px-6 py-2 text-sm outline-none",
  "[&_p]:my-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal",
  "[&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3",
  "[&_a]:text-primary [&_a]:underline",
].join(" ");

const SAVE_DELAY_MS = 300;

/** One note's editor. Mount it with `key={id}` so each note gets a fresh editor. */
export function QuickNoteEditor({ id, initialContent }: { id: string; initialContent: string }) {
  const { t } = useI18n();
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; html: string } | null>(null);

  const flush = useCallback(() => {
    if (!pending.current) return;
    clearTimeout(pending.current.timer);
    quickNotes.update(id, pending.current.html);
    pending.current = null;
  }, [id]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    immediatelyRender: false,
    autofocus: "end",
    editorProps: { attributes: { class: EDITOR_CLASS, "aria-label": t("quickNotes__title") } },
    onUpdate: ({ editor: e }) => {
      if (pending.current) clearTimeout(pending.current.timer);
      const html = e.getHTML();
      pending.current = { html, timer: setTimeout(flush, SAVE_DELAY_MS) };
    },
  });

  // Typing is saved after a short pause; leaving the note or closing the dialog saves immediately.
  useEffect(() => flush, [flush]);

  return <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto" />;
}
