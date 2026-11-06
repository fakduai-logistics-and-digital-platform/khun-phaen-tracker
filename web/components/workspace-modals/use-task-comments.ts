"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  createTaskComment,
  deleteTaskComment,
  getCommentImages,
  getTaskComments,
  toggleTaskCommentReaction,
  updateTaskCommentText,
} from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import type { TaskComment } from "@/lib/types";
import {
  buildOptimisticReactions,
  COMMENT_IMAGES_PAGE_SIZE,
  makeFileKey,
  MAX_COMMENT_FILES,
  type CommentImageState,
} from "./task-comment-utils";

export type CommentFilePreview = { key: string; file: File; url: string };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useTaskComments({
  active,
  taskId,
}: {
  /** True while the task form is open for an existing task. */
  active: boolean;
  taskId: string | number | undefined;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const currentUserId = String(user?.id || user?.user_id || "");

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [imageStates, setImageStates] = useState<Record<string, CommentImageState>>({});

  const [content, setContent] = useState("");
  const [previews, setPreviews] = useState<CommentFilePreview[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [updating, setUpdating] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<TaskComment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [reactionUpdating, setReactionUpdating] = useState<Record<string, boolean>>({});

  const taskIdRef = useRef(taskId);
  taskIdRef.current = taskId;
  const limitRef = useRef(limit);
  limitRef.current = limit;
  const imageStatesRef = useRef(imageStates);
  imageStatesRef.current = imageStates;
  const loadSeqRef = useRef(0);
  const previewsRef = useRef<CommentFilePreview[]>([]);

  const setFiles = useCallback((files: File[]) => {
    const existing = new Map(previewsRef.current.map((item) => [item.key, item]));
    const next: CommentFilePreview[] = [];
    for (const file of files.slice(0, MAX_COMMENT_FILES)) {
      const key = makeFileKey(file);
      const prev = existing.get(key);
      if (prev) {
        next.push(prev);
        existing.delete(key);
      } else {
        next.push({ key, file, url: URL.createObjectURL(file) });
      }
    }
    for (const stale of existing.values()) URL.revokeObjectURL(stale.url);
    previewsRef.current = next;
    setPreviews(next);
  }, []);

  const appendFiles = useCallback(
    (input: File[]) => {
      const images = input.filter((file) => file.type.startsWith("image/"));
      if (images.length === 0) return;
      const merged = previewsRef.current.map((item) => item.file);
      const seen = new Set(merged.map(makeFileKey));
      for (const file of images) {
        const key = makeFileKey(file);
        if (seen.has(key)) continue;
        merged.push(file);
        seen.add(key);
        if (merged.length >= MAX_COMMENT_FILES) break;
      }
      setFiles(merged);
    },
    [setFiles],
  );

  const removeFile = useCallback(
    (index: number) => setFiles(previewsRef.current.filter((_, i) => i !== index).map((p) => p.file)),
    [setFiles],
  );

  useEffect(
    () => () => {
      for (const preview of previewsRef.current) URL.revokeObjectURL(preview.url);
    },
    [],
  );

  const fetchImages = useCallback(
    async (comment: TaskComment, imagePage: number, imageLimit: number, imageTotal: number) => {
      const id = taskIdRef.current;
      if (!id || !comment.id) return;
      const key = String(comment.id);
      setImageStates((prev) => ({
        ...prev,
        [key]: {
          page: imagePage,
          limit: imageLimit,
          total: imageTotal,
          images: prev[key]?.images ?? [],
          loading: true,
          error: "",
        },
      }));
      try {
        const response = await getCommentImages(id, comment.id, { page: imagePage, limit: imageLimit });
        setImageStates((prev) => ({
          ...prev,
          [key]: {
            page: response.page,
            limit: response.limit,
            total: response.total,
            images: response.images,
            loading: false,
            error: "",
          },
        }));
      } catch (err) {
        setImageStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            loading: false,
            error: errorMessage(err, t("taskForm__comments_error_load_images")),
          },
        }));
      }
    },
    [t],
  );

  const loadComments = useCallback(
    async (targetPage: number) => {
      const id = taskIdRef.current;
      if (!id) return;
      const seq = ++loadSeqRef.current;
      setLoading(true);
      setError("");
      try {
        const response = await getTaskComments(id, { page: targetPage, limit: limitRef.current });
        if (seq !== loadSeqRef.current) return;
        setComments(response.comments);
        setTotal(response.total);
        setPage(response.page);
        await Promise.all(
          response.comments.map((comment) => {
            const prev = imageStatesRef.current[String(comment.id || "")];
            return fetchImages(
              comment,
              prev?.page || 1,
              prev?.limit || COMMENT_IMAGES_PAGE_SIZE,
              comment.images.length || 0,
            );
          }),
        );
      } catch (err) {
        if (seq === loadSeqRef.current) setError(errorMessage(err, t("taskForm__comments_error_load")));
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [fetchImages, t],
  );

  useEffect(() => {
    if (!active) return;
    setContent("");
    setFiles([]);
    setComments([]);
    setError("");
    setPage(1);
    setTotal(0);
    setImageStates({});
    setEditingId(null);
    setPendingDelete(null);
  }, [active, taskId, setFiles]);

  useEffect(() => {
    if (active && taskId) void loadComments(page);
    // Reload only when the target task, page or page size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, taskId, page, limit]);

  function changeImagesPage(comment: TaskComment, delta: 1 | -1) {
    if (!comment.id) return;
    const state = imageStates[String(comment.id)];
    if (!state) return;
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    const nextPage = state.page + delta;
    if (nextPage < 1 || nextPage > totalPages) return;
    void fetchImages(comment, nextPage, state.limit, state.total);
  }

  async function submitComment() {
    const id = taskIdRef.current;
    if (!id) return;
    if (!content.trim() && previews.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      await createTaskComment(id, { content, files: previews.map((p) => p.file) });
      setContent("");
      setFiles([]);
      await loadComments(1);
    } catch (err) {
      setError(errorMessage(err, t("taskForm__comments_error_submit")));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleReaction(comment: TaskComment, emoji: string) {
    const id = taskIdRef.current;
    if (!id || !comment.id) return;
    const commentId = String(comment.id);
    if (!currentUserId || reactionUpdating[commentId]) return;

    const previousReactions = [...(comment.reactions || [])];
    const optimistic = buildOptimisticReactions(comment, emoji, currentUserId);
    const patch = (reactions: TaskComment["reactions"]) =>
      setComments((list) => list.map((item) => (String(item.id || "") === commentId ? { ...item, reactions } : item)));

    setReactionUpdating((prev) => ({ ...prev, [commentId]: true }));
    setError("");
    patch(optimistic);

    try {
      await toggleTaskCommentReaction(id, comment.id, emoji);
    } catch (err) {
      patch(previousReactions);
      setError(errorMessage(err, t("taskForm__comments_error_update")));
    } finally {
      setReactionUpdating((prev) => {
        const { [commentId]: _done, ...rest } = prev;
        return rest;
      });
    }
  }

  function startEdit(comment: TaskComment) {
    setEditingId(String(comment.id || ""));
    setEditingText(comment.content || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  async function saveEdit(comment: TaskComment) {
    const id = taskIdRef.current;
    if (!id || !comment.id) return;
    setUpdating(true);
    setError("");
    try {
      await updateTaskCommentText(id, comment.id, editingText);
      cancelEdit();
      await loadComments(page);
    } catch (err) {
      setError(errorMessage(err, t("taskForm__comments_error_update")));
    } finally {
      setUpdating(false);
    }
  }

  function requestDelete(comment: TaskComment) {
    setPendingDelete(comment);
  }

  function cancelDelete() {
    if (!deleting) setPendingDelete(null);
  }

  async function confirmDelete() {
    const id = taskIdRef.current;
    const commentId = pendingDelete?.id;
    if (!id || !commentId) return;
    setError("");
    setDeleting(true);
    setPendingDelete(null);
    try {
      await deleteTaskComment(id, commentId);
      const nextTotal = Math.max(0, total - 1);
      const nextPages = Math.max(1, Math.ceil(nextTotal / limit));
      await loadComments(Math.min(page, nextPages));
    } catch (err) {
      setError(errorMessage(err, t("taskForm__comments_error_delete")));
    } finally {
      setDeleting(false);
    }
  }

  return {
    currentUserId,
    comments,
    loading,
    error,
    page,
    setPage,
    limit,
    setLimit,
    total,
    imageStates,
    content,
    setContent,
    previews,
    appendFiles,
    removeFile,
    submitting,
    submitComment,
    changeImagesPage,
    reactionUpdating,
    toggleReaction,
    editingId,
    editingText,
    setEditingText,
    updating,
    startEdit,
    cancelEdit,
    saveEdit,
    pendingDelete,
    deleting,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
