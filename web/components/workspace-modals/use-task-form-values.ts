"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { getAssigneeGroups, getNextTaskNumber } from "@/lib/db";
import { get } from "@/lib/store";
import { taskDefaults } from "@/lib/stores/taskDefaults";
import type { Assignee, AssigneeGroup, ChecklistItem, Sprint, Task } from "@/lib/types";
import type { TaskType } from "@/lib/utils/branch-name";

export type TaskFormValues = {
  title: string;
  project: string;
  date: string;
  end_date: string;
  status: Task["status"];
  priority: string;
  task_type: TaskType | undefined;
  category: string;
  notes: string;
  assignee_ids: (string | number)[];
  sprint_id: string | number | null;
  checklist: ChecklistItem[];
  links: string[];
};

const today = () => new Date().toISOString().split("T")[0];

function valuesFromTask(task: Task): TaskFormValues {
  const hasExplicitStartDate = !!task.start_date;
  const legacyDueDateOnly = !hasExplicitStartDate && !!task.end_date && !!task.date && task.end_date === task.date;

  return {
    title: task.title || "",
    project: task.project || "",
    date: legacyDueDateOnly ? "" : task.start_date || task.date || today(),
    end_date: task.due_date || task.end_date || (legacyDueDateOnly ? task.date : ""),
    status: task.status || "todo",
    priority: task.priority || "none",
    task_type: task.task_type,
    category: task.category || "งานหลัก",
    notes: task.notes || "",
    assignee_ids: (task.assignee_ids || (task.assignee_id ? [task.assignee_id] : [])).filter(
      (id) => id !== null && id !== undefined && String(id).trim() !== "",
    ),
    sprint_id: task.sprint_id || null,
    checklist: task.checklist ? [...task.checklist] : [],
    links: task.links ? [...task.links] : [],
  };
}

export const EMPTY_TASK_FORM_VALUES: TaskFormValues = {
  title: "",
  project: "",
  date: "",
  end_date: "",
  status: "todo",
  priority: "medium",
  task_type: "feature",
  category: "งานหลัก",
  notes: "",
  assignee_ids: [],
  sprint_id: null,
  checklist: [],
  links: [],
};

export function useTaskFormValues({
  show,
  editingTask,
  assignees,
  isOwner,
  sprints,
}: {
  show: boolean;
  editingTask: Task | null;
  assignees: Assignee[];
  isOwner: boolean;
  sprints: Sprint[];
}) {
  const { user } = useAuth();
  const [values, setValues] = useState<TaskFormValues>(EMPTY_TASK_FORM_VALUES);
  const [nextTaskNumber, setNextTaskNumber] = useState<number | null>(null);
  const [assigneeGroups, setAssigneeGroups] = useState<AssigneeGroup[]>([]);

  const latest = useRef({ editingTask, assignees, isOwner, sprints, user });
  latest.current = { editingTask, assignees, isOwner, sprints, user };

  const initKey = show ? `${editingTask?.id ?? "new"}:${editingTask?.created_at ?? ""}` : "closed";

  useEffect(() => {
    if (initKey === "closed") return;
    const { editingTask: task, assignees: people, isOwner: owner, sprints: sprintList, user: me } = latest.current;
    let cancelled = false;

    if (task) {
      setValues(valuesFromTask(task));
    } else {
      const defaults = get(taskDefaults);
      let assignee_ids: (string | number)[] = [];
      if (defaults.assignee_id) {
        assignee_ids = [String(defaults.assignee_id)];
      } else if (!owner && me) {
        const mine = people.find((a) => a.user_id === me.id || a.user_id === me.user_id);
        assignee_ids = mine ? [String(mine.id)] : [];
      }
      setValues({
        ...EMPTY_TASK_FORM_VALUES,
        project: defaults.project || "",
        date: today(),
        category: defaults.category || "งานหลัก",
        assignee_ids,
        sprint_id: sprintList.find((s) => s.status === "active")?.id || null,
      });
      getNextTaskNumber()
        .then((n) => !cancelled && setNextTaskNumber(n))
        .catch((error) => {
          console.error("Failed to fetch next task number:", error);
        });
    }

    setNextTaskNumber(null);
    getAssigneeGroups(true)
      .then((groups) => !cancelled && setAssigneeGroups(groups))
      .catch((error) => {
        console.error("Failed to load assignee groups:", error);
        if (!cancelled) setAssigneeGroups([]);
      });

    return () => {
      cancelled = true;
    };
  }, [initKey]);

  const patch = useCallback((partial: Partial<TaskFormValues>) => setValues((prev) => ({ ...prev, ...partial })), []);

  return { values, patch, nextTaskNumber, assigneeGroups };
}
