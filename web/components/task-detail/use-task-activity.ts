"use client";

import { useEffect, useState } from "react";
import { getTaskHistory } from "@/lib/db";
import type { TaskActivityEntry } from "@/lib/types";

/** The change history of a task. `refreshKey` reloads it, e.g. with the task's `updated_at`. */
export function useTaskActivity(
  taskDbId: string | number | undefined,
  refreshKey?: string | number,
) {
  const [entries, setEntries] = useState<TaskActivityEntry[]>([]);

  useEffect(() => {
    if (!taskDbId) return;
    let cancelled = false;
    getTaskHistory(taskDbId)
      .then((next) => {
        if (!cancelled) setEntries(next);
      })
      .catch((e) => console.error("Failed to load task history:", e));
    return () => {
      cancelled = true;
    };
  }, [taskDbId, refreshKey]);

  return entries;
}
