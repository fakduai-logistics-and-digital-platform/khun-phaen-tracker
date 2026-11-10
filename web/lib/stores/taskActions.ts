import type { Task, ChecklistItem, Assignee } from "@/lib/types";
import { addTask, updateTask, deleteTask, getAssignees, addAssignee as addAssigneeDB } from "@/lib/db";

type NotifyType = "success" | "error";

export type TaskActionDeps = {
  loadData: () => Promise<void>;
  notify: (message: string, type?: NotifyType) => void;
  t: (key: string, options?: any) => string;
  trackRealtime: (reason: string) => void;
  getTasks: () => Task[];
  setTasks: (tasks: Task[]) => void;
  getFilteredTasks: () => Task[];
  setFilteredTasks: (tasks: Task[]) => void;
  getEditingTask: () => Task | null;
  setEditingTask: (task: Task | null) => void;
  setShowForm: (show: boolean) => void;
  setAssignees: (assignees: Assignee[]) => void;
};

import { requestConfirm } from "./confirmStore";

export function createTaskActions(deps: TaskActionDeps) {
  // Helper to enrich a single task with assignee objects
  async function enrichTaskWithAssignees(task: Task): Promise<Task> {
    if (!task.assignee_ids || task.assignee_ids.length === 0) {
      return { ...task, assignees: [], assignee: null, assignee_id: null };
    }

    try {
      const allAssignees = await getAssignees();
      const assigneeMap = new Map(allAssignees.map((a) => [String(a.id), a]));
      const assignees = task.assignee_ids
        .map((id) => assigneeMap.get(String(id)))
        .filter((a): a is Assignee => a !== undefined);

      return {
        ...task,
        assignees,
        assignee: assignees[0] ?? null,
        assignee_id: assignees[0]?.id ?? null,
      };
    } catch (error) {
      console.error("Failed to enrich task with assignees:", error);
      return task;
    }
  }

  const patchTaskChecklist = (list: Task[], taskId: string | number, checklist: ChecklistItem[]): Task[] =>
    list.map((task) => (String(task.id) === String(taskId) ? { ...task, checklist } : task));

  async function handleAddTask(event: CustomEvent<Omit<Task, "id" | "created_at">>) {
    const editingTask = deps.getEditingTask();
    const oldTasks = deps.getTasks();
    const oldFiltered = deps.getFilteredTasks();

    // Close modal immediately for smooth UX
    deps.setShowForm(false);

    try {
      if (editingTask) {
        // Optimistic update with merged data
        const optimisticTask = { ...editingTask, ...event.detail };
        deps.setTasks(oldTasks.map((task) => (String(task.id) === String(editingTask!.id) ? optimisticTask : task)));
        deps.setFilteredTasks(
          oldFiltered.map((task) => (String(task.id) === String(editingTask!.id) ? optimisticTask : task)),
        );

        deps.setEditingTask(null); // Clear edit state

        // Get the actual updated task from server
        const serverTask = await updateTask(editingTask.id!, {
          ...event.detail,
          workspace_id: editingTask.workspace_id,
        });

        console.log("🔍 Update payload:", event.detail);
        console.log("🔍 Server response:", serverTask);

        // Replace optimistic update with server data
        if (serverTask) {
          // Enrich task with assignee objects
          const enrichedTask = await enrichTaskWithAssignees(serverTask);

          deps.setTasks(
            deps.getTasks().map((task) => (String(task.id) === String(editingTask!.id) ? enrichedTask : task)),
          );
          deps.setFilteredTasks(
            deps.getFilteredTasks().map((task) => (String(task.id) === String(editingTask!.id) ? enrichedTask : task)),
          );
        }

        deps.notify(deps.t("page__update_task_success"));
        deps.trackRealtime("update-task");
      } else {
        // Optimistic add with temporary ID
        const tempId = `temp-${Date.now()}`;
        const newTask: Task = {
          ...event.detail,
          id: tempId,
          created_at: new Date().toISOString(),
        };
        deps.setTasks([...oldTasks, newTask]);
        deps.setFilteredTasks([...oldFiltered, newTask]);

        // Get the actual created task from server
        const serverTask = await addTask(event.detail);

        // Enrich task with assignee objects
        const enrichedTask = await enrichTaskWithAssignees(serverTask);

        // Replace temporary task with server data
        const replaceTemp = (list: Task[]) =>
          list.map((task) => (String(task.id) === String(tempId) ? enrichedTask : task));
        deps.setTasks(replaceTemp(deps.getTasks()));
        deps.setFilteredTasks(replaceTemp(deps.getFilteredTasks()));

        deps.notify(deps.t("page__add_task_success"));
        deps.trackRealtime("add-task");
      }
    } catch (e) {
      console.error("❌ handleAddTask failed:", e);
      deps.setTasks(oldTasks);
      deps.setFilteredTasks(oldFiltered);
      deps.notify(deps.t("page__add_task_error"), "error");
    }
  }

  async function handleChecklistUpdate(event: CustomEvent<{ checklist: ChecklistItem[] }>) {
    const editingTask = deps.getEditingTask();
    if (!editingTask) return;
    const previousTasks = deps.getTasks();
    const previousFilteredTasks = deps.getFilteredTasks();
    const previousEditingTask = editingTask;
    const nextTasks = patchTaskChecklist(previousTasks, editingTask.id!, event.detail.checklist);
    const nextFilteredTasks = patchTaskChecklist(previousFilteredTasks, editingTask.id!, event.detail.checklist);

    // Optimistic update
    deps.setTasks(nextTasks);
    deps.setFilteredTasks(nextFilteredTasks);

    try {
      const serverTask = await updateTask(editingTask.id!, {
        checklist: event.detail.checklist,
        workspace_id: editingTask.workspace_id,
      });

      // Replace optimistic update with server data
      if (serverTask) {
        const enrichedTask = await enrichTaskWithAssignees(serverTask);

        deps.setTasks(
          deps.getTasks().map((task) => (String(task.id) === String(editingTask.id) ? enrichedTask : task)),
        );
        deps.setFilteredTasks(
          deps.getFilteredTasks().map((task) => (String(task.id) === String(editingTask.id) ? enrichedTask : task)),
        );
        deps.setEditingTask(enrichedTask);
      }

      deps.trackRealtime("update-checklist");
    } catch (e) {
      deps.setTasks(previousTasks);
      deps.setFilteredTasks(previousFilteredTasks);
      deps.setEditingTask(previousEditingTask);
      console.error("❌ handleChecklistUpdate failed:", e);
    }
  }

  async function handleChecklistToggle(event: CustomEvent<{ taskId: number; checklistItemId: string }>) {
    const { taskId, checklistItemId } = event.detail;
    const previousTasks = deps.getTasks();
    const previousFilteredTasks = deps.getFilteredTasks();
    try {
      const task = previousTasks.find((t) => String(t.id) === String(taskId));
      if (!task || !task.checklist) return;

      const updatedChecklist = task.checklist.map((item) =>
        item.id === checklistItemId ? { ...item, completed: !item.completed } : item,
      );

      // Optimistic update
      deps.setTasks(patchTaskChecklist(previousTasks, taskId, updatedChecklist));
      deps.setFilteredTasks(patchTaskChecklist(previousFilteredTasks, taskId, updatedChecklist));

      const serverTask = await updateTask(taskId, {
        checklist: updatedChecklist,
        workspace_id: task.workspace_id,
      });

      // Replace optimistic update with server data
      if (serverTask) {
        const enrichedTask = await enrichTaskWithAssignees(serverTask);

        deps.setTasks(deps.getTasks().map((t) => (String(t.id) === String(taskId) ? enrichedTask : t)));
        deps.setFilteredTasks(deps.getFilteredTasks().map((t) => (String(t.id) === String(taskId) ? enrichedTask : t)));
      }

      deps.trackRealtime("toggle-checklist");
    } catch (e) {
      deps.setTasks(previousTasks);
      deps.setFilteredTasks(previousFilteredTasks);
      console.error("❌ handleChecklistToggle failed:", e);
    }
  }

  async function handleAddAssignee(event: CustomEvent<{ name: string; color: string }>) {
    try {
      await addAssigneeDB({
        name: event.detail.name,
        color: event.detail.color,
      });
      deps.setAssignees(await getAssignees());
      deps.notify(deps.t("page__add_assignee_success"));
      deps.trackRealtime("add-assignee");
    } catch {
      deps.notify(deps.t("page__add_assignee_error"), "error");
    }
  }

  async function handleDeleteTask(event: CustomEvent<string | number>) {
    const id = event.detail;
    const confirmed = await requestConfirm({
      title: deps.t("common.confirm"),
      message: deps.t("page__delete_task_confirm"),
      type: "danger",
    });
    if (!confirmed) return;
    try {
      const task = deps.getTasks().find((item) => String(item.id) === String(id));
      await deleteTask(id, task);
      await deps.loadData();
      deps.notify(deps.t("page__delete_task_success"));
      deps.trackRealtime("delete-task");
    } catch {
      deps.notify(deps.t("page__delete_task_error"), "error");
    }
  }

  async function handleDeleteSelectedTasks(event: CustomEvent<number[]>) {
    const ids = event.detail;
    if (ids.length === 0) return;
    const confirmed = await requestConfirm({
      title: deps.t("common.confirm"),
      message: deps.t("page__delete_tasks_confirm", {
        values: { count: ids.length },
      }),
      type: "danger",
    });
    if (!confirmed) return;

    try {
      const deleteResults = await Promise.allSettled(
        ids.map((id) =>
          deleteTask(
            id,
            deps.getTasks().find((task) => String(task.id) === String(id)),
          ),
        ),
      );
      const deletedCount = deleteResults.filter((result) => result.status === "fulfilled").length;
      const failedCount = ids.length - deletedCount;

      await deps.loadData();

      if (failedCount === 0) {
        deps.notify(
          deps.t("page__delete_tasks_success", {
            values: { count: deletedCount },
          }),
        );
      } else {
        deps.notify(
          deps.t("page__delete_tasks_error", {
            values: { count: deletedCount, failed: failedCount },
          }),
          "error",
        );
      }
      if (deletedCount > 0) {
        deps.trackRealtime("delete-selected-tasks");
      }
    } catch {
      deps.notify(deps.t("page__delete_tasks_error"), "error");
    }
  }

  async function handleStatusChange(event: CustomEvent<{ id: string | number; status: Task["status"] }>) {
    const { id, status } = event.detail;
    const oldTasks = deps.getTasks();
    const oldFiltered = deps.getFilteredTasks();
    const editingTask = deps.getEditingTask();
    const oldEditingTask = editingTask;

    // Optimistic update
    deps.setTasks(oldTasks.map((task) => (String(task.id) === String(id) ? { ...task, status } : task)));
    deps.setFilteredTasks(oldFiltered.map((task) => (String(task.id) === String(id) ? { ...task, status } : task)));
    if (editingTask && String(editingTask.id) === String(id)) {
      deps.setEditingTask({ ...editingTask, status });
    }

    try {
      const currentTask = oldTasks.find((task) => String(task.id) === String(id));
      const serverTask = await updateTask(id, { status, workspace_id: currentTask?.workspace_id });

      // Replace optimistic update with server data
      if (serverTask) {
        const enrichedTask = await enrichTaskWithAssignees(serverTask);

        deps.setTasks(deps.getTasks().map((task) => (String(task.id) === String(id) ? enrichedTask : task)));
        deps.setFilteredTasks(
          deps.getFilteredTasks().map((task) => (String(task.id) === String(id) ? enrichedTask : task)),
        );
        if (oldEditingTask && String(oldEditingTask.id) === String(id)) {
          deps.setEditingTask(enrichedTask);
        }
      }

      deps.trackRealtime("update-task-status");
    } catch {
      deps.setTasks(oldTasks);
      deps.setFilteredTasks(oldFiltered);
      if (oldEditingTask) {
        deps.setEditingTask(oldEditingTask);
      }
      deps.notify("เกิดข้อผิดพลาด", "error");
    }
  }

  async function handleKanbanMove(event: CustomEvent<{ id: number; newStatus: Task["status"] }>) {
    const { id, newStatus } = event.detail;
    const previousTasks = deps.getTasks();
    const previousFilteredTasks = deps.getFilteredTasks();
    const applyStatus = (list: Task[]) => list.map((task) => (task.id === id ? { ...task, status: newStatus } : task));

    // Optimistic update
    deps.setTasks(applyStatus(previousTasks));
    deps.setFilteredTasks(applyStatus(previousFilteredTasks));

    try {
      const currentTask = previousTasks.find((task) => task.id === id);
      const serverTask = await updateTask(id, {
        status: newStatus,
        workspace_id: currentTask?.workspace_id,
      });

      // Replace optimistic update with server data
      if (serverTask) {
        const enrichedTask = await enrichTaskWithAssignees(serverTask);

        deps.setTasks(deps.getTasks().map((task) => (task.id === id ? enrichedTask : task)));
        deps.setFilteredTasks(deps.getFilteredTasks().map((task) => (task.id === id ? enrichedTask : task)));
      }

      deps.trackRealtime("update-task-status");
    } catch {
      deps.setTasks(previousTasks);
      deps.setFilteredTasks(previousFilteredTasks);
      deps.notify("เกิดข้อผิดพลาด", "error");
    }
  }

  async function startTimerFromCommandPalette() {
    const previousTasks = deps.getTasks();
    const previousFilteredTasks = deps.getFilteredTasks();
    const taskToStart = previousTasks.find(
      (task) => !task.is_archived && task.status === "todo" && task.id !== undefined,
    );
    if (!taskToStart?.id) {
      deps.notify(deps.t("commandPalette__no_todo_to_start"), "error");
      return;
    }

    try {
      const serverTask = await updateTask(taskToStart.id, {
        status: "in-progress",
        workspace_id: taskToStart.workspace_id,
      });

      // Update with server data instead of reloading all
      if (serverTask) {
        const enrichedTask = await enrichTaskWithAssignees(serverTask);

        deps.setTasks(previousTasks.map((task) => (task.id === taskToStart.id ? enrichedTask : task)));
        deps.setFilteredTasks(previousFilteredTasks.map((task) => (task.id === taskToStart.id ? enrichedTask : task)));
      }

      deps.trackRealtime("update-task-status");
      deps.notify(
        deps.t("commandPalette__timer_started", {
          values: { title: taskToStart.title },
        }),
      );
    } catch (error) {
      console.error("Failed to start timer from command palette:", error);
      deps.notify(deps.t("commandPalette__timer_error"), "error");
    }
  }

  async function handlePriorityChange(event: CustomEvent<{ id: string | number; priority: Task["priority"] }>) {
    const { id, priority } = event.detail;
    const oldTasks = deps.getTasks();
    const oldFiltered = deps.getFilteredTasks();
    const editingTask = deps.getEditingTask();
    const oldEditingTask = editingTask;

    // Optimistic update
    deps.setTasks(oldTasks.map((task) => (String(task.id) === String(id) ? { ...task, priority } : task)));
    deps.setFilteredTasks(oldFiltered.map((task) => (String(task.id) === String(id) ? { ...task, priority } : task)));
    if (editingTask && String(editingTask.id) === String(id)) {
      deps.setEditingTask({ ...editingTask, priority });
    }

    try {
      const currentTask = oldTasks.find((task) => String(task.id) === String(id));
      const serverTask = await updateTask(id, { priority, workspace_id: currentTask?.workspace_id });

      if (serverTask) {
        const enrichedTask = await enrichTaskWithAssignees(serverTask);

        deps.setTasks(deps.getTasks().map((task) => (String(task.id) === String(id) ? enrichedTask : task)));
        deps.setFilteredTasks(
          deps.getFilteredTasks().map((task) => (String(task.id) === String(id) ? enrichedTask : task)),
        );
        if (oldEditingTask && String(oldEditingTask.id) === String(id)) {
          deps.setEditingTask(enrichedTask);
        }
      }

      deps.trackRealtime("update-task-priority");
    } catch {
      deps.setTasks(oldTasks);
      deps.setFilteredTasks(oldFiltered);
      if (oldEditingTask) {
        deps.setEditingTask(oldEditingTask);
      }
      deps.notify("เกิดข้อผิดพลาด", "error");
    }
  }

  async function handleTaskUpdate(event: CustomEvent<{ id: string | number; updates: Partial<Task> }>) {
    const { id, updates } = event.detail;
    const oldTasks = deps.getTasks();
    const oldFiltered = deps.getFilteredTasks();
    const editingTask = deps.getEditingTask();
    const isTarget = (task: Task) => String(task.id) === String(id);

    deps.setTasks(oldTasks.map((task) => (isTarget(task) ? { ...task, ...updates } : task)));
    deps.setFilteredTasks(oldFiltered.map((task) => (isTarget(task) ? { ...task, ...updates } : task)));
    if (editingTask && isTarget(editingTask)) deps.setEditingTask({ ...editingTask, ...updates });

    try {
      const currentTask = oldTasks.find(isTarget);
      const serverTask = await updateTask(id, { ...updates, workspace_id: currentTask?.workspace_id });
      if (serverTask) {
        const enrichedTask = await enrichTaskWithAssignees(serverTask);
        deps.setTasks(deps.getTasks().map((task) => (isTarget(task) ? enrichedTask : task)));
        deps.setFilteredTasks(deps.getFilteredTasks().map((task) => (isTarget(task) ? enrichedTask : task)));
        if (editingTask && isTarget(editingTask)) deps.setEditingTask(enrichedTask);
      }
      deps.trackRealtime("update-task");
    } catch {
      deps.setTasks(oldTasks);
      deps.setFilteredTasks(oldFiltered);
      if (editingTask) deps.setEditingTask(editingTask);
      deps.notify("เกิดข้อผิดพลาด", "error");
    }
  }

  return {
    handleAddTask,
    handleChecklistUpdate,
    handleChecklistToggle,
    handleAddAssignee,
    handleDeleteTask,
    handleDeleteSelectedTasks,
    handleStatusChange,
    handlePriorityChange,
    handleTaskUpdate,
    handleKanbanMove,
    startTimerFromCommandPalette,
  };
}
