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

export function createTaskActions(deps: TaskActionDeps) {
  async function handleAddTask(
    event: CustomEvent<Omit<Task, "id" | "created_at">>,
  ) {
    const editingTask = deps.getEditingTask();
    const isEditing = Boolean(editingTask);
    const oldTasks = deps.getTasks();
    const oldFiltered = deps.getFilteredTasks();

    // Close modal immediately for smooth UX
    deps.setShowForm(false);

    try {
      if (editingTask) {
        const updatedTask = { ...editingTask, ...event.detail };
        deps.setTasks(
          oldTasks.map((task) =>
            task.id === editingTask!.id ? updatedTask : task,
          ),
        );
        deps.setFilteredTasks(deps.getTasks());

        deps.setEditingTask(null); // Clear edit state

        await updateTask(editingTask.id!, event.detail);
        deps.notify(deps.t("page__update_task_success"));
      } else {
        // Optimistic add with temporary ID
        const tempId = `temp-${Date.now()}`;
        const newTask: Task = {
          ...event.detail,
          id: tempId,
          created_at: new Date().toISOString(),
        };
        deps.setTasks([...oldTasks, newTask]);
        deps.setFilteredTasks(deps.getTasks());

        await addTask(event.detail);
        deps.notify(deps.t("page__add_task_success"));
      }

      await deps.loadData();
      deps.trackRealtime(isEditing ? "update-task" : "add-task");
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
    try {
      await updateTask(editingTask.id!, {
        checklist: event.detail.checklist,
      });
      // Update editingTask reference so state stays in sync
      deps.setEditingTask({
        ...editingTask,
        checklist: event.detail.checklist,
      });
      await deps.loadData();
      deps.trackRealtime("update-checklist");
    } catch (e) {
      console.error("❌ handleChecklistUpdate failed:", e);
    }
  }

  async function handleChecklistToggle(
    event: CustomEvent<{ taskId: number; checklistItemId: string }>,
  ) {
    const { taskId, checklistItemId } = event.detail;
    try {
      const task = deps.getTasks().find((t) => t.id === taskId);
      if (!task || !task.checklist) return;

      const updatedChecklist = task.checklist.map((item) =>
        item.id === checklistItemId
          ? { ...item, completed: !item.completed }
          : item,
      );

      await updateTask(taskId, { checklist: updatedChecklist });
      await deps.loadData();
      deps.trackRealtime("toggle-checklist");
    } catch (e) {
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
    if (!confirm(deps.t("page__delete_task_confirm"))) return;
    try {
      await deleteTask(id);
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
    if (
      !confirm(
        deps.t("page__delete_tasks_confirm", { values: { count: ids.length } }),
      )
    )
      return;

    try {
      const deleteResults = await Promise.allSettled(
        ids.map((id) => deleteTask(id)),
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
    deps.setTasks(
      oldTasks.map((task) =>
        String(task.id) === String(id) ? { ...task, status } : task,
      ),
    );
    deps.setFilteredTasks(deps.getTasks());

    try {
      await updateTask(id, { status });
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
      await updateTask(id, { status: newStatus });
      await deps.loadData();
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
      await updateTask(taskToStart.id, { status: "in-progress" });
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
