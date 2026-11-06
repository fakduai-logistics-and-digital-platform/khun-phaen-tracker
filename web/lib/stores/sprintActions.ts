import type { Task, FilterOptions } from "@/lib/types";
import { updateTask, getTasksBySprint, archiveTasksBySprint } from "@/lib/db";
import { sprints } from "@/lib/stores/sprintStore";
import { persistFilters } from "@/lib/stores/filterActions";
import { api } from "@/lib/api/apis";
import { get } from "@/lib/store";
import { page } from "@/lib/page-store";
import { currentWorkspaceName } from "@/lib/stores/workspace";

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
  function extractDiscordMentionId(value?: string): string | null {
    if (!value) return null;
    const clean = value.trim();
    if (!clean) return null;
    return /^\d{8,}$/.test(clean) ? clean : null;
  }

  function getTaskMentions(task: Task): string[] {
    const ids = new Set<string>();
    const assignees = task.assignees || [];
    for (const assignee of assignees) {
      const discordId = extractDiscordMentionId(assignee.discord_id);
      if (discordId) ids.add(discordId);
      else {
        const fromUserId = extractDiscordMentionId(assignee.user_id ? String(assignee.user_id) : "");
        if (fromUserId) ids.add(fromUserId);
      }
    }
    return [...ids];
  }

  async function sendSprintCompletionWebhook(
    sprintName: string,
    doneTasks: Task[],
  ): Promise<"sent" | "missing_config" | "skipped"> {
    const workspaceId = get(page).params.workspace_id;
    if (!workspaceId || workspaceId === "offline") return "skipped";

    const configRes = await api.workspaces.getNotificationConfig(workspaceId);
    if (!configRes.ok) return "missing_config";
    const configData = await configRes.json();
    const webhookUrl = configData?.config?.discord_webhook_url?.trim?.() || "";
    if (!webhookUrl) return "missing_config";

    const doneTaskLines =
      doneTasks.length > 0
        ? doneTasks.map((task) => {
            const mentions = getTaskMentions(task);
            const mentionText = mentions.length > 0 ? ` ${mentions.map((id) => `<@${id}>`).join(" ")}` : "";
            return `- [x] ${task.title || deps.t("sprintManager__unknown_task_title")}${mentionText}`;
          })
        : [`- ${deps.t("sprintManager__markdown_no_tasks")}`];

    const workspaceName = get(currentWorkspaceName);
    const body = {
      embeds: [
        {
          title: deps.t("sprintManager__webhook_embed_title"),
          description: [
            ...(workspaceName ? [`Workspace: **${workspaceName}**`] : []),
            `${deps.t("sprintManager__webhook_sprint_label")}: **${sprintName}**`,
            `${deps.t("sprintManager__webhook_done_total", {
              values: { count: doneTasks.length },
            })}`,
            "",
            ...doneTaskLines,
          ].join("\n"),
          color: parseInt("22C55E", 16),
          timestamp: new Date().toISOString(),
          footer: {
            text: workspaceName ? `Khun Phaen Task Tracker · ${workspaceName}` : "Khun Phaen Task Tracker",
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return "sent";
  }

  async function handleCompleteSprint(
    event: CustomEvent<number | { sprintId: string | number; notifyWebhook?: boolean }>,
  ): Promise<boolean> {
    const payload = event.detail;
    const sprintId: string | number = typeof payload === "object" && payload !== null ? payload.sprintId : payload;
    const notifyWebhook = typeof payload === "object" && payload !== null ? Boolean(payload.notifyWebhook) : false;
    try {
      const sprintTasks = await getTasksBySprint(sprintId);
      const doneTasks = sprintTasks.filter((t) => t.status === "done");
      const incompleteTasks = sprintTasks.filter((t) => t.status !== "done");

      // Archive completed tasks
      const archivedCount = await archiveTasksBySprint(sprintId);

      // Move incomplete tasks out of sprint (set sprint_id to null)
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

      if (notifyWebhook) {
        try {
          const sprintName = get(sprints).find((s) => String(s.id) === String(sprintId))?.name || String(sprintId);
          const webhookState = await sendSprintCompletionWebhook(sprintName, doneTasks);
          if (webhookState === "sent") {
            deps.notify(deps.t("sprintManager__webhook_send_success"));
          } else if (webhookState === "missing_config") {
            deps.notify(deps.t("sprintManager__webhook_missing_config"), "error");
          }
        } catch (error) {
          console.error("Failed to send sprint completion webhook:", error);
          deps.notify(deps.t("sprintManager__webhook_send_error"), "error");
        }
      }

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
    } catch {
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
    } catch {
      await deps.loadData();
      deps.notify(deps.t("page__move_tasks_error"), "error");
    }
  }

  async function handleDeleteSprint(event: CustomEvent<string | number>) {
    const sprintId = event.detail;
    try {
      const sprintTasks = await getTasksBySprint(sprintId);
      const taskIds = sprintTasks.map((task) => task.id).filter((id): id is string | number => id !== undefined);

      if (taskIds.length > 0) {
        await handleMoveTasksToSprint(
          new CustomEvent("moveTasksToSprint", {
            detail: { sprintId: -1, taskIds },
          }),
        );
      } else {
        await deps.loadData();
      }
    } catch {
      deps.notify(deps.t("page__delete_sprint_error"), "error");
    }
  }

  return {
    handleCompleteSprint,
    handleMoveTasksToSprint,
    handleDeleteSprint,
  };
}
