"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createTaskComment, deleteTaskComment, getTaskComments } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import type { TaskComment } from "@/lib/types";

interface Options {
  taskDbId: string | number | undefined;
  loadVersion: number;
}

export function useTaskComments({ taskDbId, loadVersion }: Options) {
  const { t } = useI18n();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const tRef = useRef(t);
  tRef.current = t;

  const load = useCallback(async () => {
    if (!taskDbId) return;
    const current = ++seq.current;
    setLoading(true);
    try {
      const response = await getTaskComments(taskDbId, { page: 1, limit: 50 });
      if (current === seq.current) setComments(response.comments);
    } catch (e) {
      console.error("Failed to load comments:", e);
    } finally {
      if (current === seq.current) setLoading(false);
    }
  }, [taskDbId]);

  useEffect(() => {
    void load();
  }, [load, loadVersion]);

  useEffect(() => {
    setComments([]);
  }, [taskDbId]);

  const submit = useCallback(
    async (content: string, files: File[]): Promise<boolean> => {
      if (!taskDbId || (!content.trim() && files.length === 0)) return false;
      try {
        await createTaskComment(taskDbId, { content: content.trim(), files });
        await load();
        return true;
      } catch {
        toast.error(tRef.current("taskForm__comments_error_submit"));
        return false;
      }
    },
    [taskDbId, load],
  );

  const remove = useCallback(
    async (commentId: string) => {
      if (!taskDbId || !commentId) return;
      try {
        await deleteTaskComment(taskDbId, commentId);
        setComments((list) => list.filter((c) => c.id !== commentId));
      } catch {
        toast.error(tRef.current("page__error"));
      }
    },
    [taskDbId],
  );

  return { comments, loading, submit, remove };
}
