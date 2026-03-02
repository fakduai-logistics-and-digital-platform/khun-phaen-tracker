import type { Task, FilterOptions } from "$lib/types";
import { updateTask, getTasksBySprint, archiveTasksBySprint } from "$lib/db";
import { sprints } from "$lib/stores/sprintStore";
import { persistFilters } from "$lib/stores/filterActions";

type NotifyType = "success" | "error";

export type SprintActionDeps = {
  loadData: () => Promise<void>;
  notify: (message: string, type?: NotifyType) => void;
  t: (key: string, options?: any) => string;
  trackRealtime: (reason: string) => void;
  getTasks: () => Task[];
  setTasks: (tasks: Task[]) => void;
  getFilteredTasks: () => Task[];
  setFilteredTasks: (tasks: Task[]) => void;
  getAllTasks: () => Task[];
  setAllTasks: (tasks: Task[]) => void;
  getFilters: () => FilterOptions;
  setFilters: (filters: FilterOptions) => void;
};

function applySprintUpdateToLocalState(
  deps: SprintActionDeps,
  taskIds: (string | number)[],
  sprintId: string | number | null,
) {
  if (taskIds.length === 0) return;
  const taskIdSet = new Set(taskIds.map(String));

  const updateTaskSprint = (task: Task): Task => {
    if (task.id === undefined || !taskIdSet.has(String(task.id))) return task;
    return { ...task, sprint_id: sprintId };
  };

  deps.setTasks(deps.getTasks().map(updateTaskSprint));
  deps.setFilteredTasks(deps.getFilteredTasks().map(updateTaskSprint));
  deps.setAllTasks(deps.getAllTasks().map(updateTaskSprint));
}

export function createSprintActions(deps: SprintActionDeps) {
  async function handleCompleteSprint(
    event: CustomEvent<number>,
  ): Promise<boolean> {
    const sprintId = event.detail;
    try {
      // Archive completed tasks
      const archivedCount = await archiveTasksBySprint(sprintId);

      // Move incomplete tasks out of sprint (set sprint_id to null)
      const sprintTasks = await getTasksBySprint(sprintId);
      const incompleteTasks = sprintTasks.filter((t) => t.status !== "done");
      for (const task of incompleteTasks) {
        await updateTask(task.id!, { sprint_id: null });
      }

      // Update sprint with archived count
      await sprints.update(sprintId, {
        status: "completed",
        archived_count: archivedCount,
      });

      // Reset sprint filter if selected sprint has just been completed
      const filters = deps.getFilters();
      if (filters.sprint_id === sprintId) {
        const newFilters = { ...filters, sprint_id: "all" as const };
        deps.setFilters(newFilters);
        persistFilters(newFilters);
      }

      await deps.loadData();
      deps.notify(
        deps.t("page__complete_sprint_success", {
          values: {
            archived: archivedCount,
            incomplete: incompleteTasks.length,
          },
        }),
      );
      deps.trackRealtime("complete-sprint");
      return true;
    } catch (e) {
      deps.notify(deps.t("page__complete_sprint_error"), "error");
      return false;
    }
  }

  async function handleMoveTasksToSprint(
    event: CustomEvent<{
      sprintId: string | number;
      taskIds: (string | number)[];
    }>,
  ) {
    const { sprintId, taskIds } = event.detail;
    const newSprintId = sprintId === -1 ? null : sprintId;

    // Optimistic update so sprint dialog stats change immediately.
    applySprintUpdateToLocalState(deps, taskIds, newSprintId);

    try {
      let movedCount = 0;
      for (const taskId of taskIds) {
        await updateTask(taskId, { sprint_id: newSprintId });
        movedCount++;
      }
      await deps.loadData();
      if (sprintId === -1) {
        deps.notify(
          deps.t("page__move_tasks_from_sprint_success", {
            values: { count: movedCount },
          }),
        );
      } else {
        deps.notify(
          deps.t("page__move_tasks_to_sprint_success", {
            values: { count: movedCount },
          }),
        );
      }
      deps.trackRealtime("move-tasks-to-sprint");
    } catch (e) {
      await deps.loadData();
      deps.notify(deps.t("page__move_tasks_error"), "error");
    }
  }

  async function handleDeleteSprint(event: CustomEvent<string | number>) {
    const sprintId = event.detail;
    try {
      const sprintTasks = await getTasksBySprint(sprintId);
      const taskIds = sprintTasks
        .map((task) => task.id)
        .filter((id): id is string | number => id !== undefined);

      if (taskIds.length > 0) {
        await handleMoveTasksToSprint(
          new CustomEvent("moveTasksToSprint", {
            detail: { sprintId: -1, taskIds },
          }),
        );
      } else {
        await deps.loadData();
      }
    } catch (e) {
      deps.notify(deps.t("page__delete_sprint_error"), "error");
    }
  }

  return {
    handleCompleteSprint,
    handleMoveTasksToSprint,
    handleDeleteSprint,
  };
}
