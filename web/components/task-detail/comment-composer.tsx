"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Maximize2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { processFilesForPreview, revokePreview } from "@/lib/utils/file";

interface AttachedFile {
  file: File;
  preview?: string;
}

interface CommentComposerProps {
  userInitial: string;
  onSubmit: (content: string, files: File[]) => Promise<boolean>;
}

export function CommentComposer({ userInitial, onSubmit }: CommentComposerProps) {
  const { t } = useI18n();
  const [content, setContent] = useState("");
  const [attached, setAttached] = useState<AttachedFile[]>([]);
  const [rows, setRows] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachedRef = useRef(attached);
  attachedRef.current = attached;

  useEffect(
    () => () => {
      attachedRef.current.forEach((af) => revokePreview(af.preview));
    },
    [],
  );

  const canSubmit = (content.trim().length > 0 || attached.length > 0) && !submitting;

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    setAttached((prev) => [...prev, ...processFilesForPreview(files)]);
  }

  function removeFile(index: number) {
    setAttached((prev) => {
      revokePreview(prev[index]?.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files: File[] = [];
    for (const item of Array.from(e.clipboardData?.items ?? [])) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    addFiles(files);
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await onSubmit(
      content,
      attached.map((af) => af.file),
    );
    setSubmitting(false);
    if (!ok) return;
    attached.forEach((af) => revokePreview(af.preview));
    setContent("");
    setAttached([]);
  }

  return (
    <div className="flex gap-3 pt-2">
      <div className="shrink-0">
        <div className="flex size-8 select-none items-center justify-center rounded-full bg-brand-500 text-sm font-medium text-white">
          {userInitial}
        </div>
      </div>
      <div className="flex-1">
        <div className="relative overflow-hidden rounded-lg border bg-transparent transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.currentTarget.files || []));
              e.currentTarget.value = "";
            }}
          />
          {attached.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3">
              {attached.map((af, i) => (
                <div
                  key={`${af.file.name}-${i}`}
                  className="group relative flex items-center gap-2 rounded-lg border bg-muted p-1 text-xs text-muted-foreground"
                >
                  {af.preview ? (
                    <img src={af.preview} alt="preview" className="size-8 rounded border object-cover shadow-sm" />
                  ) : (
                    <div className="flex size-8 items-center justify-center rounded bg-accent text-muted-foreground">
                      <FileText size={12} />
                    </div>
                  )}
                  <span className="max-w-[100px] truncate px-1">{af.file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Remove file"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("taskForm__comments_placeholder")}
            rows={rows}
            aria-label={t("taskForm__comments_placeholder")}
            className="w-full resize-none bg-transparent px-4 pt-3 pb-10 text-sm text-foreground outline-none [scrollbar-width:none] placeholder:text-muted-foreground [&::-webkit-scrollbar]:hidden"
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title="Expand"
              aria-label="Expand"
              onClick={() => {
                setRows((r) => (r < 8 ? 8 : 3));
                textareaRef.current?.focus();
              }}
            >
              <Maximize2 />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title="Attach file"
              aria-label="Attach file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip />
            </Button>
            <Button
              type="button"
              size="icon"
              className="size-8"
              onClick={() => void submit()}
              disabled={!canSubmit}
              title="Send (⌘+Enter)"
              aria-label="Send (⌘+Enter)"
            >
              <Send />
            </Button>
          </div>
        </div>
        <p className="mt-1 pl-1 text-xs text-muted-foreground">⌘+Enter to send</p>
      </div>
    </div>
  );
}
