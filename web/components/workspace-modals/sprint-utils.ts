import type { Sprint, Task } from "@/lib/types";

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function getDateAfterDays(startDate: string, days: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

export function formatSprintDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("th-TH", { month: "short", day: "numeric" });
}

function getDurationDays(startDate: string, endDate: string): number {
  const diffTime = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export function formatDuration(t: Translate, startDate: string, endDate: string): string {
  const days = getDurationDays(startDate, endDate);
  if (days < 7) return t("sprintManager__duration_day", { count: days });
  if (days % 7 === 0) return t("sprintManager__duration_week", { count: days / 7 });
  return t("sprintManager__duration_week_day", { weeks: Math.floor(days / 7), days: days % 7 });
}

export function getBlockingSprint(sprintList: Sprint[]): Sprint | null {
  return sprintList.find((s) => s.status === "active") ?? null;
}

export function getTaskCount(tasks: Task[], sprintId: string | number) {
  const sprintTasks = tasks.filter((t) => String(t.sprint_id) === String(sprintId));
  return { total: sprintTasks.length, done: sprintTasks.filter((t) => t.status === "done").length };
}

export function getTaskAssigneeLabel(t: Translate, task: Task): string {
  if (task.assignees && task.assignees.length > 0) {
    const names = task.assignees
      .map((assignee) => assignee?.name?.trim())
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) return names.join(", ");
  }
  const singleName = task.assignee?.name?.trim();
  if (singleName) return singleName;
  return t("page__unassigned");
}

export function getNextSprintName(sprintList: Sprint[]): string {
  if (sprintList.length === 0) return "";
  const latestName = sprintList[sprintList.length - 1]?.name?.trim() || "";
  if (!latestName) return "";

  const match = latestName.match(/^(.*?)(\d+)$/);
  if (!match) return "";
  const numberText = match[2];
  const nextNumber = String(Number.parseInt(numberText, 10) + 1).padStart(numberText.length, "0");
  return `${match[1] || ""}${nextNumber}`;
}

/** Unfinished tasks that are in no sprint, or in a sprint that is neither active nor planned. */
export function getTasksToMoveToNewSprint(tasks: Task[], sprintList: Sprint[]): (string | number)[] {
  const liveSprintIds = new Set(
    sprintList.filter((s) => s.status === "active" || s.status === "planned").map((s) => String(s.id)),
  );
  return tasks
    .filter(
      (task) =>
        task.id !== undefined &&
        task.status !== "done" &&
        (!task.sprint_id || !liveSprintIds.has(String(task.sprint_id))),
    )
    .map((task) => task.id!);
}

export function getStatusLabel(t: Translate, status: Task["status"]): string {
  switch (status) {
    case "pending":
      return t("taskList__status_pending");
    case "todo":
      return t("taskList__status_todo");
    case "in-progress":
      return t("taskList__status_in_progress");
    case "in-test":
      return t("taskList__status_in_test");
    case "done":
      return t("taskList__status_done");
  }
}

export function buildCompletedSprintMarkdown(t: Translate, sprint: Sprint, tasks: Task[]): string {
  const doneTasks = tasks.filter((task) => String(task.sprint_id) === String(sprint.id) && task.status === "done");
  const reportDate = new Date().toISOString().split("T")[0];
  const lines = [
    `# ${t("sprintManager__markdown_report_title")} - ${sprint.name}`,
    "",
    `- ${t("sprintManager__markdown_report_date")}: ${reportDate}`,
    `- ${t("sprintManager__markdown_sprint_range")}: ${formatSprintDate(sprint.start_date)} - ${formatSprintDate(sprint.end_date)}`,
    `- ${t("sprintManager__markdown_done_count", { count: doneTasks.length })}`,
    "",
    `## ✅ ${t("sprintManager__markdown_done_section")}`,
    ...(doneTasks.length > 0
      ? doneTasks.map((task) => {
          const title = task.title || t("sprintManager__unknown_task_title");
          const project = task.project || "-";
          const assignee = getTaskAssigneeLabel(t, task);
          const dateText = task.date || "-";
          return `- [x] ${title} (${project}) - ${t("tableView__column_assignee")}: ${assignee} - ${dateText}`;
        })
      : [`- ${t("sprintManager__markdown_no_tasks")}`]),
  ];
  return lines.join("\n");
}
