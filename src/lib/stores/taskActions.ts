import type { Task, ChecklistItem, Assignee } from "$lib/types";
import {
  addTask,
  updateTask,
  deleteTask,
  getAssignees,
  addAssignee as addAssigneeDB,
} from "$lib/db";

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
  const patchTaskChecklist = (
    list: Task[],
    taskId: string | number,
    checklist: ChecklistItem[],
  ): Task[] =>
    list.map((task) =>
      String(task.id) === String(taskId) ? { ...task, checklist } : task,
    );

  async function handleAddTask(
    event: CustomEvent<Omit<Task, "id" | "created_at">>,
  ) {
    const editingTask = deps.getEditingTask();
    const oldTasks = deps.getTasks();
    const oldFiltered = deps.getFilteredTasks();

    // Close modal immediately for smooth UX
    deps.setShowForm(false);

    try {
      if (editingTask) {
        const updatedTask = { ...editingTask, ...event.detail };
        deps.setTasks(
          oldTasks.map((task) =>
            String(task.id) === String(editingTask!.id) ? updatedTask : task,
          ),
        );
        deps.setFilteredTasks(
          oldFiltered.map((task) =>
            String(task.id) === String(editingTask!.id) ? updatedTask : task,
          ),
        );

        deps.setEditingTask(null); // Clear edit state

        await updateTask(editingTask.id!, {
          ...event.detail,
          workspace_id: editingTask.workspace_id,
        });
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

        const createdId = await addTask(event.detail);
        const replaceTempTaskId = (list: Task[]) =>
          list.map((task) =>
            String(task.id) === String(tempId) ? { ...task, id: createdId } : task,
          );
        deps.setTasks(replaceTempTaskId(deps.getTasks()));
        deps.setFilteredTasks(replaceTempTaskId(deps.getFilteredTasks()));
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

  async function handleChecklistUpdate(
    event: CustomEvent<{ checklist: ChecklistItem[] }>,
  ) {
    const editingTask = deps.getEditingTask();
    if (!editingTask) return;
    const previousTasks = deps.getTasks();
    const previousFilteredTasks = deps.getFilteredTasks();
    const nextTasks = patchTaskChecklist(
      previousTasks,
      editingTask.id!,
      event.detail.checklist,
    );
    const nextFilteredTasks = patchTaskChecklist(
      previousFilteredTasks,
      editingTask.id!,
      event.detail.checklist,
    );

    deps.setTasks(nextTasks);
    deps.setFilteredTasks(nextFilteredTasks);

    try {
      await updateTask(editingTask.id!, {
        checklist: event.detail.checklist,
        workspace_id: editingTask.workspace_id,
      });
      // Update editingTask reference so state stays in sync
      deps.setEditingTask({
        ...editingTask,
        checklist: event.detail.checklist,
      });
      deps.trackRealtime("update-checklist");
    } catch (e) {
      deps.setTasks(previousTasks);
      deps.setFilteredTasks(previousFilteredTasks);
      console.error("❌ handleChecklistUpdate failed:", e);
    }
  }

  async function handleChecklistToggle(
    event: CustomEvent<{ taskId: number; checklistItemId: string }>,
  ) {
    const { taskId, checklistItemId } = event.detail;
    const previousTasks = deps.getTasks();
    const previousFilteredTasks = deps.getFilteredTasks();
    try {
      const task = previousTasks.find((t) => String(t.id) === String(taskId));
      if (!task || !task.checklist) return;

      const updatedChecklist = task.checklist.map((item) =>
        item.id === checklistItemId
          ? { ...item, completed: !item.completed }
          : item,
      );

      deps.setTasks(patchTaskChecklist(previousTasks, taskId, updatedChecklist));
      deps.setFilteredTasks(
        patchTaskChecklist(previousFilteredTasks, taskId, updatedChecklist),
      );

      await updateTask(taskId, {
        checklist: updatedChecklist,
        workspace_id: task.workspace_id,
      });
      deps.trackRealtime("toggle-checklist");
    } catch (e) {
      deps.setTasks(previousTasks);
      deps.setFilteredTasks(previousFilteredTasks);
      console.error("❌ handleChecklistToggle failed:", e);
    }
  }

  async function handleAddAssignee(
    event: CustomEvent<{ name: string; color: string }>,
  ) {
    try {
      await addAssigneeDB({
        name: event.detail.name,
        color: event.detail.color,
      });
      deps.setAssignees(await getAssignees());
      deps.notify(deps.t("page__add_assignee_success"));
      deps.trackRealtime("add-assignee");
    } catch (e) {
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
    } catch (e) {
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
      const deletedCount = deleteResults.filter(
        (result) => result.status === "fulfilled",
      ).length;
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
    } catch (e) {
      deps.notify(deps.t("page__delete_tasks_error"), "error");
    }
  }

  async function handleStatusChange(
    event: CustomEvent<{ id: string | number; status: Task["status"] }>,
  ) {
    const { id, status } = event.detail;
    const oldTasks = deps.getTasks();
    const oldFiltered = deps.getFilteredTasks();
    const editingTask = deps.getEditingTask();
    deps.setTasks(
      oldTasks.map((task) =>
        String(task.id) === String(id) ? { ...task, status } : task,
      ),
    );
    deps.setFilteredTasks(
      oldFiltered.map((task) =>
        String(task.id) === String(id) ? { ...task, status } : task,
      ),
    );
    if (editingTask && String(editingTask.id) === String(id)) {
      deps.setEditingTask({ ...editingTask, status });
    }

    try {
      const currentTask = oldTasks.find((task) => String(task.id) === String(id));
      await updateTask(id, { status, workspace_id: currentTask?.workspace_id });
      deps.trackRealtime("update-task-status");
    } catch (e) {
      deps.setTasks(oldTasks);
      deps.setFilteredTasks(oldFiltered);
      deps.notify("เกิดข้อผิดพลาด", "error");
    }
  }

  async function handleKanbanMove(
    event: CustomEvent<{ id: number; newStatus: Task["status"] }>,
  ) {
    const { id, newStatus } = event.detail;
    const previousTasks = deps.getTasks();
    const previousFilteredTasks = deps.getFilteredTasks();
    const applyStatus = (list: Task[]) =>
      list.map((task) =>
        task.id === id ? { ...task, status: newStatus } : task,
      );

    deps.setTasks(applyStatus(previousTasks));
    deps.setFilteredTasks(applyStatus(previousFilteredTasks));

    try {
      const currentTask = previousTasks.find((task) => task.id === id);
      await updateTask(id, {
        status: newStatus,
        workspace_id: currentTask?.workspace_id,
      });
      deps.trackRealtime("update-task-status");
    } catch (e) {
      deps.setTasks(previousTasks);
      deps.setFilteredTasks(previousFilteredTasks);
      deps.notify("เกิดข้อผิดพลาด", "error");
    }
  }

  async function startTimerFromCommandPalette() {
    const taskToStart = deps
      .getTasks()
      .find(
        (task) =>
          !task.is_archived && task.status === "todo" && task.id !== undefined,
      );
    if (!taskToStart?.id) {
      deps.notify(deps.t("commandPalette__no_todo_to_start"), "error");
      return;
    }

    try {
      await updateTask(taskToStart.id, {
        status: "in-progress",
        workspace_id: taskToStart.workspace_id,
      });
      await deps.loadData();
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

  return {
    handleAddTask,
    handleChecklistUpdate,
    handleChecklistToggle,
    handleAddAssignee,
    handleDeleteTask,
    handleDeleteSelectedTasks,
    handleStatusChange,
    handleKanbanMove,
    startTimerFromCommandPalette,
  };
}
