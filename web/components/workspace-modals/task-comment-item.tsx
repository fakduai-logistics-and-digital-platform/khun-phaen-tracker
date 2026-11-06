"use client";

import { Edit2, Smile, Trash2 } from "lucide-react";
import { StoredImage } from "@/components/shared/stored-image";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import type { TaskComment } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { useTaskComments } from "./use-task-comments";
import {
  COMMENT_REACTION_EMOJIS,
  extractCommentUrls,
  formatCommentRelativeTime,
  getReactionGroups,
  getUrlMetaPreview,
  linkifyCommentContent,
} from "./task-comment-utils";

type CommentsState = ReturnType<typeof useTaskComments>;

export function TaskCommentItem({
  comment,
  state,
  reactionPickerOpen,
  onToggleReactionPicker,
  onOpenImage,
}: {
  comment: TaskComment;
  state: CommentsState;
  reactionPickerOpen: boolean;
  onToggleReactionPicker: () => void;
  onOpenImage: (comment: TaskComment, imageIndex: number) => void;
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const commentId = String(comment.id || "");
  const isEditing = state.editingId === commentId;
  const imageState = state.imageStates[commentId];
  const imageTotalPages = imageState ? Math.max(1, Math.ceil(imageState.total / imageState.limit)) : 1;
  const reactionGroups = getReactionGroups(comment, state.currentUserId);
  const reactionBusy = !!state.reactionUpdating[commentId];
  const urls = extractCommentUrls(comment.content);

  const author = (() => {
    if (comment.created_by_name) return comment.created_by_name;
    const unknown = t("taskForm__comments_unknown_author");
    if (state.currentUserId && comment.created_by === state.currentUserId) {
      const profile = user?.profile;
      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
      return profile?.nickname || fullName || user?.email?.split("@")[0] || unknown;
    }
    return comment.created_by || unknown;
  })();

  const initials =
    author
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || t("taskForm__comments_unknown_initial");

  return (
    <div className="space-y-2 p-1">
      <div className="flex items-center gap-2 text-xs">
        <div className="flex size-7 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
          {initials}
        </div>
        <span className="font-semibold text-foreground">{author}</span>
        <span className="text-primary underline underline-offset-2">
          {formatCommentRelativeTime(comment.created_at, locale, t)}
        </span>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={state.editingText}
            onChange={(e) => state.setEditingText(e.target.value)}
            rows={3}
            aria-label={t("taskForm__comments_edit_title")}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="xs" disabled={state.updating} onClick={() => void state.saveEdit(comment)}>
              {state.updating ? t("taskForm__comments_saving") : t("taskForm__btn_save")}
            </Button>
            <Button type="button" size="xs" variant="outline" disabled={state.updating} onClick={state.cancelEdit}>
              {t("taskForm__btn_cancel")}
            </Button>
          </div>
        </div>
      ) : (
        comment.content && (
          <div className="space-y-2">
            <p
              className="rounded-lg bg-muted/60 px-3 py-2 text-sm wrap-break-word text-foreground"
              dangerouslySetInnerHTML={{ __html: linkifyCommentContent(comment.content) }}
            />
            {urls.length > 0 && (
              <div className="space-y-1.5">
                {urls.map((url) => {
                  const meta = getUrlMetaPreview(url);
                  return (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block rounded-lg border border-border bg-card px-2.5 py-2 transition-colors hover:border-primary/50"
                    >
                      <div className="flex items-center gap-2">
                        {meta.favicon && (
                          <img
                            src={meta.favicon}
                            alt={meta.host}
                            loading="lazy"
                            className="size-4 shrink-0 rounded-sm"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">{meta.host}</p>
                          <p className="truncate text-xs text-muted-foreground">{meta.path}</p>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {imageState &&
        imageState.total > 0 &&
        (imageState.loading ? (
          <p className="text-xs text-muted-foreground">{t("taskForm__comments_images_loading")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {imageState.images.map((image, imageIndex) => (
                <button
                  key={image.id ?? image.file_key}
                  type="button"
                  onClick={() => onOpenImage(comment, imageIndex)}
                  className="block overflow-hidden rounded-md border border-border bg-muted/40 p-1"
                >
                  <StoredImage
                    fileKey={image.file_key}
                    thumb
                    alt={image.filename}
                    className="mx-auto h-auto max-h-72 w-auto max-w-full object-contain"
                  />
                </button>
              ))}
            </div>
            {imageState.total > imageState.limit && (
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={imageState.page <= 1}
                  onClick={() => state.changeImagesPage(comment, -1)}
                >
                  {t("taskForm__pagination_prev")}
                </Button>
                <span>{t("taskForm__pagination_page", { page: imageState.page, pages: imageTotalPages })}</span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={imageState.page >= imageTotalPages}
                  onClick={() => state.changeImagesPage(comment, 1)}
                >
                  {t("taskForm__pagination_next")}
                </Button>
              </div>
            )}
          </>
        ))}

      {reactionGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {reactionGroups.map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              disabled={reactionBusy}
              onClick={() => void state.toggleReaction(comment, reaction.emoji)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors",
                reaction.reactedByMe
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              <span>{reaction.emoji}</span>
              <span>{reaction.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="relative" data-comment-reaction-picker="true">
          <button
            type="button"
            onClick={onToggleReactionPicker}
            aria-expanded={reactionPickerOpen}
            title="Add reaction"
            className="inline-flex items-center gap-1 hover:text-primary"
          >
            <Smile size={12} />
            <span>React</span>
          </button>
          {reactionPickerOpen && (
            <div className="absolute bottom-full left-0 z-20 mb-2 w-57 rounded-lg border border-border bg-popover p-2">
              <div className="grid grid-cols-5 gap-1.5">
                {COMMENT_REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    disabled={reactionBusy}
                    onClick={() => void state.toggleReaction(comment, emoji)}
                    className="h-9 rounded-lg text-lg hover:bg-accent"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <span>•</span>
        <button
          type="button"
          onClick={() => state.startEdit(comment)}
          title={t("taskForm__comments_edit_title")}
          className="inline-flex items-center gap-1 hover:text-primary"
        >
          <Edit2 size={12} />
          <span>{t("taskForm__comments_edit")}</span>
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => state.requestDelete(comment)}
          title={t("taskForm__comments_delete_title")}
          className="inline-flex items-center gap-1 text-destructive hover:opacity-80"
        >
          <Trash2 size={12} />
          <span>{t("taskForm__comments_delete")}</span>
        </button>
      </div>
    </div>
  );
}
