"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FocusEvent } from "react";
import { Image as ImageIcon, MessageCircle, Send } from "lucide-react";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import type { TaskComment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CommentImageLightbox, type LightboxImage } from "./comment-image-lightbox";
import { TaskCommentItem } from "./task-comment-item";
import { getCommentImageUrl } from "./task-comment-utils";
import { useTaskComments } from "./use-task-comments";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function TaskCommentsPanel({ taskId }: { taskId: string | number }) {
  const { t } = useI18n();
  const state = useTaskComments({ active: true, taskId });

  const [composerActive, setComposerActive] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  const composerRef = useRef<HTMLDivElement | null>(null);
  const keepComposerOpenRef = useRef(false);
  const hasDraft = !!state.content.trim() || state.previews.length > 0;
  const hasDraftRef = useRef(hasDraft);
  hasDraftRef.current = hasDraft;

  useEffect(() => {
    function closeReactionPicker(event: globalThis.MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-comment-reaction-picker="true"]')) return;
      setReactionPickerId(null);
    }
    document.addEventListener("mousedown", closeReactionPicker);
    return () => document.removeEventListener("mousedown", closeReactionPicker);
  }, []);

  function handleComposerBlur(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (composerRef.current && next && composerRef.current.contains(next)) return;
    requestAnimationFrame(() => {
      if (keepComposerOpenRef.current) return;
      const active = document.activeElement;
      if (composerRef.current && active && composerRef.current.contains(active)) return;
      if (!hasDraftRef.current) setComposerActive(false);
    });
  }

  const holdComposerOpen = () => {
    keepComposerOpenRef.current = true;
  };
  const releaseComposerOpen = () => {
    requestAnimationFrame(() => {
      keepComposerOpenRef.current = false;
    });
  };

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setComposerActive(true);
    state.appendFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    setDropActive(false);
    state.appendFiles(Array.from(event.dataTransfer?.files || []));
  }

  function openImageLightbox(comment: TaskComment, imageIndex: number) {
    const images = state.imageStates[String(comment.id || "")]?.images || [];
    if (images.length === 0) return;
    setLightbox({
      images: images.map((img) => ({
        src: getCommentImageUrl(img.file_key),
        alt: img.filename || t("taskForm__comments_image_fallback_alt"),
      })),
      index: imageIndex,
    });
  }

  const composerExpanded = composerActive || hasDraft;
  const canSubmit = !state.submitting && hasDraft;

  return (
    <div className="flex h-full min-h-[560px] flex-col space-y-3 border-l border-border p-4 xl:max-h-[calc(90vh-11rem)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageCircle size={16} />
        <span>{t("taskForm__comments_title")}</span>
      </div>

      <div ref={composerRef} onFocus={() => setComposerActive(true)} onBlur={handleComposerBlur} className="space-y-3">
        <textarea
          value={state.content}
          onChange={(e) => state.setContent(e.target.value)}
          placeholder={t("taskForm__comments_placeholder")}
          aria-label={t("taskForm__comments_title")}
          rows={composerExpanded ? 3 : 1}
          onPaste={(e) => state.appendFiles(Array.from(e.clipboardData?.files || []))}
          onDragEnter={(e) => {
            e.preventDefault();
            setDropActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDropActive(false);
          }}
          onDrop={handleDrop}
          className={cn(
            "w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none transition-colors focus:ring-1 focus:ring-ring/50",
            dropActive && "bg-accent",
          )}
        />
        {composerExpanded && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <label
              onMouseDown={holdComposerOpen}
              onMouseUp={releaseComposerOpen}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <ImageIcon size={14} />
              <span>{t("taskForm__comments_attach_images")}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
            </label>
            <Button
              type="button"
              disabled={!canSubmit}
              onMouseDown={holdComposerOpen}
              onMouseUp={releaseComposerOpen}
              onClick={() => void state.submitComment()}
            >
              <Send size={14} />
              <span>{state.submitting ? t("taskForm__comments_saving") : t("taskForm__btn_save")}</span>
            </Button>
          </div>
        )}
      </div>

      {state.previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {state.previews.map((preview, idx) => (
            <div key={preview.key} className="relative overflow-hidden rounded-lg border border-border bg-card">
              <img src={preview.url} alt={preview.file.name} className="h-16 w-full object-cover" />
              <button
                type="button"
                onClick={() => state.removeFile(idx)}
                aria-label={`Remove ${preview.file.name}`}
                className="absolute top-1 right-1 size-5 rounded-full bg-black/65 text-xs leading-none text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {state.loading ? (
          <p className="text-sm text-muted-foreground">{t("taskForm__comments_loading")}</p>
        ) : state.comments.length === 0 ? (
          <div className="flex h-full min-h-50 items-center justify-center p-3">
            <p className="text-center text-sm text-muted-foreground">{t("taskForm__comments_empty")}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {state.comments.map((comment, index) => {
                const commentId = String(comment.id || "");
                return (
                  <TaskCommentItem
                    key={commentId || index}
                    comment={comment}
                    state={state}
                    reactionPickerOpen={reactionPickerId === commentId}
                    onToggleReactionPicker={() =>
                      setReactionPickerId((current) => (current === commentId ? null : commentId))
                    }
                    onOpenImage={openImageLightbox}
                  />
                );
              })}
            </div>

            {state.total > state.limit && (
              <Pagination
                totalItems={state.total}
                pageSize={state.limit}
                currentPage={state.page}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageSizeChange={state.setLimit}
                onCurrentPageChange={state.setPage}
              />
            )}
          </>
        )}
      </div>

      {lightbox && (
        <CommentImageLightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}

      <Dialog open={!!state.pendingDelete} onOpenChange={(next) => !next && state.cancelDelete()}>
        <DialogContent className="max-w-sm gap-0 p-0 sm:max-w-sm">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle className="text-sm font-semibold">{t("taskForm__comments_delete_confirm_title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("taskForm__comments_delete_confirm_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-3">
            <p className="text-sm text-muted-foreground">{t("taskForm__comments_delete_confirm_desc")}</p>
          </div>
          <DialogFooter className="px-4 pb-4">
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={state.deleting}
              onClick={() => void state.confirmDelete()}
            >
              {state.deleting ? t("taskForm__comments_deleting") : t("taskForm__comments_delete_confirm_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
