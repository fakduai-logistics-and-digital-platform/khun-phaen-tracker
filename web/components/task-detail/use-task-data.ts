"use client";

import { getWorkspaceRoom } from "@/lib/room";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteTask, getAssignees, getProjectsList, getSprints, getTaskById, updateTask } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { get } from "@/lib/store";
import { connectRealtime } from "@/lib/stores/realtime";
import { currentWorkspaceId, MY_TASKS_WORKSPACE_ID, setWorkspaceId } from "@/lib/stores/workspace";
import type { Assignee, Project, Sprint, Task } from "@/lib/types";

interface Options {
  workspaceId: string;
  taskId: string;
  room: string | null;
}

export function useTaskData({ workspaceId, taskId, room }: Options) {
  const { t } = useI18n();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);

  const loadSeq = useRef(0);
  const tRef = useRef(t);
  tRef.current = t;
  const taskRef = useRef<Task | null>(null);
  taskRef.current = task;

  const loadTask = useCallback(
    async (silent: boolean) => {
      const seq = ++loadSeq.current;
      if (!silent) {
        setLoading(true);
        setError("");
        setTask(null);
      }
      try {
        if (!taskId) return;
        const result = await getTaskById(taskId, workspaceId);
        if (seq !== loadSeq.current) return;
        if (result) {
          setTask(result);
          setLoadVersion((v) => v + 1);
          if (workspaceId && workspaceId !== MY_TASKS_WORKSPACE_ID) {
            setWorkspaceId(
              workspaceId,
              result.workspace_name || undefined,
              undefined,
              result.workspace_color,
              result.workspace_icon,
              result.workspace_short_name,
            );
          }
        } else {
          setError(tRef.current("taskList__no_tasks"));
        }
      } catch {
        if (seq === loadSeq.current) setError(tRef.current("page__load_data_error"));
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [taskId, workspaceId],
  );

  const loadMetadata = useCallback(async () => {
    try {
      const [projectList, assigneeList, sprintList] = await Promise.all([
        getProjectsList(),
        getAssignees(true),
        getSprints(),
      ]);
      setProjects(projectList);
      setAssignees(assigneeList);
      setSprints(sprintList);
    } catch (e) {
      console.error("Failed to load metadata:", e);
    }
  }, []);

  useEffect(() => {
    if (workspaceId && get(currentWorkspaceId) !== workspaceId) {
      currentWorkspaceId.set(workspaceId);
    }
    void loadTask(false);
    void loadMetadata();
  }, [workspaceId, loadTask, loadMetadata]);

  useEffect(() => {
    const roomCode = room || getWorkspaceRoom(workspaceId);
    if (!roomCode || workspaceId === MY_TASKS_WORKSPACE_ID) return;
    connectRealtime(roomCode, (payload) => {
      if (
        payload.action === "refresh" ||
        (payload.entity === "task" && String(payload.id || payload.data?.id || "") === String(taskId))
      ) {
        void loadTask(true);
      }
    });
  }, [room, workspaceId, taskId, loadTask]);

  const update = useCallback(
    async (updates: Partial<Task>) => {
      const current = taskRef.current;
      if (!current?.id) return;
      try {
        const updated = await updateTask(current.id, {
          workspace_id: current.workspace_id || workspaceId,
          ...updates,
        });
        if (updated) {
          setTask((prev) => (prev ? { ...prev, ...updated } : prev));
          toast.success(tRef.current("page__update_task_success"));
        }
      } catch (e) {
        console.error("Failed to update task:", e);
        toast.error(tRef.current("page__error"));
      }
    },
    [workspaceId],
  );

  const remove = useCallback(async (): Promise<boolean> => {
    const id = taskRef.current?.id;
    if (id == null) return false;
    try {
      await deleteTask(id);
      return true;
    } catch (e) {
      console.error("Delete task failed", e);
      return false;
    }
  }, []);

  return { task, loading, error, loadVersion, projects, assignees, sprints, update, remove };
}
