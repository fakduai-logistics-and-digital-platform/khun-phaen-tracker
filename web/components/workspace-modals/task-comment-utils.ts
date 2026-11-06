import { API_BASE_URL } from "@/lib/api/apis";
import type { CommentImage, CommentReaction, TaskComment } from "@/lib/types";

export const COMMENT_REACTION_EMOJIS = ["👍", "❤️", "🔥", "🎉", "😂", "😮", "😢", "👀", "✅", "🚀"];

export const MAX_COMMENT_FILES = 10;
export const COMMENT_IMAGES_PAGE_SIZE = 6;

export function getCommentImageUrl(fileKey: string): string {
  return `${API_BASE_URL.replace(/\/api$/, "")}/api/files/${fileKey}`;
}

export type CommentImageState = {
  page: number;
  limit: number;
  total: number;
  images: CommentImage[];
  loading: boolean;
  error: string;
};

export type ReactionGroup = { emoji: string; count: number; reactedByMe: boolean };

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function extractCommentUrls(content?: string): string[] {
  if (!content) return [];
  const matches = content.match(/https?:\/\/[^\s<>"']+/g) || [];
  const normalized = matches
    .map((url) => {
      try {
        return new URL(url).toString();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

/** Escapes the whole comment first, so the only markup in the result is the anchors added here. */
export function linkifyCommentContent(content?: string): string {
  if (!content) return "";
  const withLinks = escapeHtml(content).replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noreferrer noopener" class="text-primary underline underline-offset-2 break-all">$1</a>',
  );
  return withLinks.replaceAll("\n", "<br>");
}

export function getUrlMetaPreview(url: string): { host: string; path: string; favicon: string } {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname || "/"}${parsed.search || ""}`;
    return {
      host: parsed.hostname,
      path: path.length > 72 ? `${path.slice(0, 72)}...` : path,
      favicon: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`,
    };
  } catch {
    return { host: url, path: "", favicon: "" };
  }
}

export function getReactionGroups(comment: TaskComment, me: string): ReactionGroup[] {
  const grouped = new Map<string, { count: number; reactedByMe: boolean }>();
  for (const reaction of comment.reactions || []) {
    const current = grouped.get(reaction.emoji) || { count: 0, reactedByMe: false };
    current.count += 1;
    if (me && reaction.user_id === me) current.reactedByMe = true;
    grouped.set(reaction.emoji, current);
  }
  return Array.from(grouped.entries()).map(([emoji, value]) => ({ emoji, ...value }));
}

export function buildOptimisticReactions(comment: TaskComment, emoji: string, userId: string): CommentReaction[] {
  const now = new Date().toISOString();
  const current = [...(comment.reactions || [])];
  const mineIdx = current.findIndex((reaction) => reaction.user_id === userId);
  if (mineIdx >= 0) {
    if (current[mineIdx].emoji === emoji) current.splice(mineIdx, 1);
    else current[mineIdx] = { ...current[mineIdx], emoji, reacted_at: now };
  } else {
    current.push({ emoji, user_id: userId, reacted_at: now });
  }
  return current;
}

export function formatCommentTime(value: string | undefined, locale: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatCommentRelativeTime(value: string | undefined, locale: string, t: Translate): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatCommentTime(value, locale);
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return t("taskForm__comments_time_just_now");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t("taskForm__comments_time_min_ago", { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t("taskForm__comments_time_hour_ago", { count: diffHr });
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return t("taskForm__comments_time_day_ago", { count: diffDay });
  return formatCommentTime(value, locale);
}

export function makeFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
