"use client";

import { Fragment, useState } from "react";
import { ChevronDown, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { API_BASE_URL } from "@/lib/api/apis";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import type { Assignee, CommentImage, TaskComment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ImageLightbox, type LightboxImage } from "./image-lightbox";

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g;

function getCommentImageUrl(fileKey: string): string {
  return `${API_BASE_URL.replace(/\/api$/, "")}/api/files/${fileKey}`;
}

function CommentText({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const display = part.length > 60 ? `${part.slice(0, 57)}…` : part;
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-2 hover:opacity-80"
          >
            {display}
          </a>
        );
      })}
    </p>
  );
}

interface CommentListProps {
  comments: TaskComment[];
  loading: boolean;
  assignees: Assignee[];
  onDelete: (commentId: string) => void;
}

export function CommentList({ comments, loading, assignees, onDelete }: CommentListProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  function authorName(comment: TaskComment): string {
    if (comment.created_by_name) return comment.created_by_name;
    const uid = user?.id || user?.user_id;
    if (uid && comment.created_by === uid) {
      const profile = user?.profile;
      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
      return profile?.nickname || fullName || user?.email?.split("@")[0] || "Unknown";
    }
    const matched = assignees.find((a) => a.user_id && a.user_id === comment.created_by);
    if (matched) return matched.name;
    return comment.created_by || "Unknown";
  }

  function relativeTime(dateStr?: string): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return t("taskForm__comments_time_just_now");
    if (diffMin < 60) return t("taskForm__comments_time_min_ago", { count: diffMin });
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return t("taskForm__comments_time_hour_ago", { count: diffHr });
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return t("taskForm__comments_time_day_ago", { count: diffDay });
    return date.toLocaleDateString();
  }

  function openLightbox(images: CommentImage[], index: number) {
    setLightbox({
      images: images.map((img) => ({ src: getCommentImageUrl(img.file_key), alt: img.filename || "Image" })),
      index,
    });
  }

  if (loading && comments.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading activity...</p>;
  }

  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("taskForm__comments_empty") || "No activity yet."}</p>;
  }

  return (
    <>
      {comments.map((comment) => {
        const name = authorName(comment);
        const displayName = name.length > 24 ? `${name.slice(0, 24)}…` : name;
        const cid = comment.id ?? "";
        const isCollapsed = !!collapsed[cid];
        return (
          <div key={cid} className="rounded-lg border bg-card">
            <div className="flex items-center gap-2.5 px-4 py-2.5">
              <button
                type="button"
                aria-label="Toggle Comment"
                aria-expanded={!isCollapsed}
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setCollapsed((prev) => ({ ...prev, [cid]: !prev[cid] }))}
              >
                <ChevronDown
                  size={12}
                  strokeWidth={2.5}
                  className={cn("transition-transform duration-150", isCollapsed && "-rotate-90")}
                />
              </button>
              <div className="flex size-6 shrink-0 select-none items-center justify-center rounded-full bg-brand-500 text-xs font-medium text-white">
                {(name[0] ?? "?").toUpperCase()}
              </div>
              <span className="text-sm font-semibold">{displayName}</span>
              <span className="text-xs text-muted-foreground">{relativeTime(comment.created_at)}</span>
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title="More"
                      aria-label="More"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem variant="destructive" onSelect={() => onDelete(cid)}>
                      <Trash2 size={13} />
                      <span>Delete comment</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {!isCollapsed && (
              <div className="space-y-3 px-4 pb-3 text-sm leading-relaxed text-foreground/90">
                {comment.content && <CommentText text={comment.content} />}
                {comment.images && comment.images.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {comment.images.map((img, imgIdx) => (
                      <button
                        key={img.id ?? imgIdx}
                        type="button"
                        onClick={() => openLightbox(comment.images, imgIdx)}
                        className="aspect-square overflow-hidden rounded-lg border transition-opacity hover:opacity-90"
                      >
                        <img
                          src={getCommentImageUrl(img.file_key)}
                          alt={img.filename}
                          className="size-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {lightbox && (
        <ImageLightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
