import type { Task } from "../types";

export function isTaskOverdue(task: Task, today: Date = new Date()): boolean {
  if ((!task.date && !task.due_date) || task.status === "done") return false;
  const due = new Date(task.date || task.due_date || "");

  const todayCopy = new Date(today);
  todayCopy.setHours(0, 0, 0, 0);

  const dueCopy = new Date(due);
  dueCopy.setHours(0, 0, 0, 0);

  return dueCopy < todayCopy;
}

export function calculateBattleHealthStats(allTasks: Task[], today: Date = new Date()) {
  const currentLastDay = new Date(today);
  currentLastDay.setHours(23, 59, 59, 999);

  const sevenDaysAgo = new Date(currentLastDay);
  sevenDaysAgo.setDate(currentLastDay.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const fourteenDaysAgo = new Date(currentLastDay);
  fourteenDaysAgo.setDate(currentLastDay.getDate() - 14);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  // Filter tasks for velocity calculation
  const doneTasksLast7Days = allTasks.filter((t) => {
    if (t.status !== "done" || !t.updated_at) return false;
    const updatedDate = new Date(t.updated_at);
    return updatedDate >= sevenDaysAgo && updatedDate <= currentLastDay;
  }).length;

  const doneTasksPrev7Days = allTasks.filter((t) => {
    if (t.status !== "done" || !t.updated_at) return false;
    const updatedDate = new Date(t.updated_at);
    return updatedDate >= fourteenDaysAgo && updatedDate < sevenDaysAgo;
  }).length;

  const velocityTrend = doneTasksLast7Days - doneTasksPrev7Days;
  const velocity = doneTasksLast7Days / 7;

  // Active tasks (todo, in-progress, in-test)
  const activeTasks = allTasks.filter((t) => t.status !== "done");
  const activeTasksCount = activeTasks.length;
  const overdueCount = allTasks.filter((t) => isTaskOverdue(t, today)).length;

  const overdueRatio = activeTasksCount > 0 ? (overdueCount / activeTasksCount) * 100 : 0;

  let morale: "excellent" | "stable" | "warning" | "critical" = "stable";
  if (overdueRatio < 5) {
    if (doneTasksLast7Days > 5) morale = "excellent";
    else morale = "stable";
  } else if (overdueRatio > 30) {
    morale = "critical";
  } else if (overdueRatio > 15) {
    morale = "warning";
  }

  return {
    velocity: velocity.toFixed(1),
    velocityTrend,
    overdueRatio,
    overdueCount,
    activeTasksCount,
    morale,
    doneTasksLast7Days,
  };
}
