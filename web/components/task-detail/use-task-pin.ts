"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/apis";
import { get } from "@/lib/store";
import { currentWorkspaceShortName, MY_TASKS_WORKSPACE_ID } from "@/lib/stores/workspace";
import type { Task } from "@/lib/types";

const PINNED_KEY = "pinned-tasks";
const PINNED_LIMIT = 5;

type PinnedEntry = string | Record<string, unknown>;

function readPinned(): PinnedEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PINNED_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePinned(entries: PinnedEntry[]) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent("pinnedTasksChanged"));
}

function entryId(entry: PinnedEntry): string {
  return String(typeof entry === "object" ? (entry?.id ?? "") : entry);
}

interface Options {
  task: Task | null;
  taskId: string;
  workspaceId: string;
  projectShortName: string;
}

export function useTaskPin({ task, taskId, workspaceId, projectShortName }: Options) {
  const [isPinned, setIsPinned] = useState(false);
  const [shortNameFallback, setShortNameFallback] = useState("");
  const fallbackRef = useRef("");
  const projectShortNameRef = useRef(projectShortName);
  projectShortNameRef.current = projectShortName;

  useEffect(() => {
    fallbackRef.current = "";
    setShortNameFallback("");
  }, [workspaceId]);

  useEffect(() => {
    setIsPinned(readPinned().some((entry) => entryId(entry) === taskId));
  }, [taskId]);

  const resolveWorkspaceShortName = useCallback(
    async (source: Task): Promise<string> => {
      const existing =
        source.workspace_short_name ||
        projectShortNameRef.current ||
        get(currentWorkspaceShortName) ||
        fallbackRef.current;
      if (existing) return existing;
      if (!workspaceId || workspaceId === MY_TASKS_WORKSPACE_ID) return "";
      try {
        const res = await api.workspaces.getList();
        if (!res.ok) return "";
        const data = await res.json();
        const workspace = (data.workspaces || []).find((ws: { id: unknown }) => String(ws.id) === String(workspaceId));
        fallbackRef.current = workspace?.short_name || "";
        setShortNameFallback(fallbackRef.current);
        return fallbackRef.current;
      } catch {
        return "";
      }
    },
    [workspaceId],
  );

  const buildMeta = useCallback(
    (source: Task, shortName: string) => ({
      id: String(source.id || taskId),
      title: source.title || "",
      short_name:
        shortName || source.workspace_short_name || get(currentWorkspaceShortName) || fallbackRef.current || "",
      task_number: source.task_number || "",
      workspace_id: workspaceId || source.workspace_id || "",
    }),
    [taskId, workspaceId],
  );

  useEffect(() => {
    if (!task?.id) return;
    const sourceId = String(task.id);
    if (!readPinned().some((entry) => entryId(entry) === sourceId)) return;
    let cancelled = false;
    void resolveWorkspaceShortName(task).then((shortName) => {
      if (cancelled) return;
      const entries = readPinned();
      const index = entries.findIndex((entry) => entryId(entry) === sourceId);
      if (index === -1) return;
      const existing = entries[index];
      entries[index] = { ...(typeof existing === "object" ? existing : {}), ...buildMeta(task, shortName) };
      writePinned(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [task, resolveWorkspaceShortName, buildMeta]);

  const togglePin = useCallback(async () => {
    if (!task || String(task.id || "") !== String(taskId)) return;
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    let entries = readPinned();
    const meta = buildMeta(task, await resolveWorkspaceShortName(task));

    if (nextPinned) {
      const index = entries.findIndex((entry) => entryId(entry) === meta.id);
      if (index === -1) {
        entries.unshift(meta);
        if (entries.length > PINNED_LIMIT) entries = entries.slice(0, PINNED_LIMIT);
      } else {
        const existing = entries[index];
        entries[index] = { ...(typeof existing === "object" ? existing : {}), ...meta };
      }
    } else {
      entries = entries.filter((entry) => entryId(entry) !== meta.id);
    }
    writePinned(entries);
  }, [task, taskId, isPinned, buildMeta, resolveWorkspaceShortName]);

  return { isPinned, togglePin, shortNameFallback };
}
