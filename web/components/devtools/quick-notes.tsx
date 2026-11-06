"use client";

import { useRef, useState } from "react";
import { Check, Copy, FileText, Trash2 } from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { get, useStore } from "@/lib/store";
import { quickNotes } from "@/lib/stores/quickNotes";
import { ToolModal } from "./tool-modal";

const EDITOR_CLASS = [
  "min-h-[40vh] px-3 py-2 text-sm outline-none",
  "[&_p]:my-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal",
  "[&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3",
  "[&_a]:text-primary [&_a]:underline",
].join(" ");

export function QuickNotes({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const content = useStore(quickNotes);
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const initialContent = useRef(get(quickNotes));

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent.current,
    immediatelyRender: false,
    editorProps: { attributes: { class: EDITOR_CLASS, "aria-label": t("quickNotes__title") } },
    onUpdate: ({ editor: e }) => quickNotes.set(e.getHTML()),
  });

  function handleClear() {
    quickNotes.clear();
    editor?.commands.clearContent();
    setConfirmClear(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(get(quickNotes));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }

  return (
    <>
      <ToolModal
        onClose={onClose}
        title={t("quickNotes__title")}
        subtitle={t("quickNotes__subtitle")}
        icon={FileText}
        headerActions={
          <>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void handleCopy()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {t("quickNotes__copy")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setConfirmClear(true)}>
              <Trash2 className="size-4" />
              {t("quickNotes__clear")}
            </Button>
          </>
        }
        footer={
          <p className="me-auto text-sm text-muted-foreground tabular-nums">
            {content.length} {t("quickNotes__characters")}
          </p>
        }
      >
        <EditorContent editor={editor} className="min-h-0 flex-1 rounded-md border" />
      </ToolModal>
      <ConfirmModal
        show={confirmClear}
        title={t("quickNotes__clear")}
        message={t("quickNotes__clear_confirm")}
        onConfirm={handleClear}
        onClose={() => setConfirmClear(false)}
      />
    </>
  );
}
