"use client";

import { useRef } from "react";
import { Paperclip, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_ATTACHMENTS } from "./editor-options";
import type { AttachmentFile } from "./use-editor-attachments";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type EditorAttachmentsProps = {
  attachments: AttachmentFile[];
  isAuthorized: boolean;
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
};

export function EditorAttachments({ attachments, isAuthorized, onAdd, onRemove }: EditorAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="border-t p-6">
      <h2 className="text-base font-semibold">Attachments</h2>

      {attachments.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {attachments.map((att, index) => (
            <div key={att.url} className="w-40 overflow-hidden rounded-lg border">
              {att.file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={att.url} alt={att.file.name} className="h-24 w-full object-cover" />
              ) : (
                <div className="flex h-24 items-center justify-center bg-muted">
                  <Paperclip size={28} className="text-muted-foreground" />
                </div>
              )}
              <div className="px-2 py-1.5">
                <p className="truncate text-xs font-medium text-foreground">{att.file.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatFileSize(att.file.size)}</span>
                  {isAuthorized && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      title="Remove"
                      aria-label={`Remove ${att.file.name}`}
                      onClick={() => onRemove(index)}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAuthorized && attachments.length < MAX_ATTACHMENTS ? (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
            className="hidden"
            onChange={(e) => {
              onAdd(e.target.files);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}>
            <Plus />
            Add attachment
          </Button>
          <span className="ml-2 text-xs text-muted-foreground">
            ({attachments.length}/{MAX_ATTACHMENTS})
          </span>
        </>
      ) : (
        isAuthorized && (
          <p className="mt-4 text-xs text-muted-foreground">Maximum {MAX_ATTACHMENTS} attachments reached.</p>
        )
      )}
    </section>
  );
}
