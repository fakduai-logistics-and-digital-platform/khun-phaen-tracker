"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownText } from "@/components/shared/markdown-text";
import { StoredImage } from "@/components/shared/stored-image";
import { signedFileUrl } from "@/lib/api/file-urls";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import type { Assignee, CommentImage, TaskComment } from "@/lib/types";
import { ImageLightbox, type LightboxImage } from "./image-lightbox";
import { mentionPattern } from "./mentions";

interface CommentListProps {
  comments: TaskComment[];
  loading: boolean;
  assignees: Assignee[];
  onDelete: (commentId: string) => void;
}

const CLAMP_PX = 160;

/** Long comments stay one short block; the rest opens with "Show more". */
function ClampedContent({
  contentKey,
  children,
}: {
  contentKey: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollHeight > CLAMP_PX + 8);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [contentKey]);

  return (
    <div>
      <div
        ref={ref}
        className="overflow-hidden"
        style={expanded ? undefined : { maxHeight: CLAMP_PX }}
      >
        {children}
      </div>
      {overflowing && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-1 h-auto p-0 text-xs"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? t("taskForm__comments_show_less")
            : t("taskForm__comments_show_more")}
        </Button>
      )}
    </div>
  );
}

export function CommentList({
  comments,
  loading,
  assignees,
  onDelete,
}: CommentListProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [lightbox, setLightbox] = useState<{
    images: LightboxImage[];
    index: number;
  } | null>(null);
  const pattern = useMemo(
    () => mentionPattern(assignees.map((a) => a.name)),
    [assignees],
  );

  function authorName(comment: TaskComment): string {
    if (comment.created_by_name) return comment.created_by_name;
    const uid = user?.id || user?.user_id;
    if (uid && comment.created_by === uid) {
      const profile = user?.profile;
      const fullName = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      return (
        profile?.nickname || fullName || user?.email?.split("@")[0] || "Unknown"
      );
    }
    const matched = assignees.find(
      (a) => a.user_id && a.user_id === comment.created_by,
    );
    if (matched) return matched.name;
    return comment.created_by || "Unknown";
  }

  function authorColor(comment: TaskComment): string | undefined {
    return assignees.find((a) => a.user_id && a.user_id === comment.created_by)
      ?.color;
  }

  function relativeTime(dateStr?: string): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return t("taskForm__comments_time_just_now");
    if (diffMin < 60)
      return t("taskForm__comments_time_min_ago", { count: diffMin });
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)
      return t("taskForm__comments_time_hour_ago", { count: diffHr });
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7)
      return t("taskForm__comments_time_day_ago", { count: diffDay });
    return date.toLocaleDateString();
  }

  async function openLightbox(images: CommentImage[], index: number) {
    const urls = await Promise.all(
      images.map((img) => signedFileUrl(img.file_key)),
    );
    setLightbox({
      images: images.map((img, i) => ({
        src: urls[i] ?? "",
        alt: img.filename || "Image",
      })),
      index,
    });
  }

  if (loading && comments.length === 0) {
    return (
      <div
        className="flex flex-col gap-4"
        aria-busy="true"
        aria-label={t("taskForm__comments_loading")}
      >
        {[0, 1].map((row) => (
          <div key={row} className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("taskForm__comments_empty")}
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-4">
        {comments.map((comment) => {
          const name = authorName(comment);
          const cid = comment.id ?? "";
          const color = authorColor(comment);
          return (
            <li key={cid} className="group flex gap-3">
              <Avatar className="size-8">
                <AvatarFallback
                  className={
                    color
                      ? "text-xs font-medium text-white"
                      : "bg-brand-500 text-xs font-medium text-white"
                  }
                  style={color ? { backgroundColor: color } : undefined}
                >
                  {(name[0] ?? "?").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{name}</span>
                  <time
                    className="shrink-0 text-xs text-muted-foreground"
                    dateTime={comment.created_at}
                    title={
                      comment.created_at
                        ? new Date(comment.created_at).toLocaleString()
                        : undefined
                    }
                  >
                    {relativeTime(comment.created_at)}
                  </time>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ms-auto size-6 text-muted-foreground transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
                        title={t("taskForm__comments_more_actions")}
                        aria-label={t("taskForm__comments_more_actions")}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    {/* The quick preview dialog sits at z-[10000], so the menu must stack above it. */}
                    <DropdownMenuContent align="end" className="z-[10001] w-44">
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onDelete(cid)}
                      >
                        <Trash2 />
                        {t("taskForm__comments_delete_title")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {comment.content && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <ClampedContent contentKey={comment.content}>
                      <MarkdownText
                        text={comment.content}
                        pattern={pattern}
                        assignees={assignees}
                      />
                    </ClampedContent>
                  </div>
                )}
                {comment.images && comment.images.length > 0 && (
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {comment.images.map((img, imgIdx) => (
                      <button
                        key={img.id ?? imgIdx}
                        type="button"
                        onClick={() => openLightbox(comment.images, imgIdx)}
                        className="aspect-square overflow-hidden rounded-md border transition-opacity hover:opacity-90"
                      >
                        <StoredImage
                          fileKey={img.file_key}
                          thumb
                          alt={img.filename}
                          className="size-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
