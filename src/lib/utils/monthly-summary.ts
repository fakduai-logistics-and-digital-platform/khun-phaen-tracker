import type { Task } from "$lib/types";
import { formatDateISO } from "./export-csv-sql";
import { normalizeTaskDate } from "./export-report";

export interface MonthlySummary {
  periodLabel: string;
  total: number;
  todo: number;
  inProgress: number;
  inTest: number;
  done: number;
  archived: number;
  totalMinutes: number;
  avgPerDay: number;
  projectBreakdown: { name: string; count: number }[];
  assigneeBreakdown: { name: string; count: number }[];
  categoryBreakdown: { name: string; count: number }[];
  dailyTrend: { date: string; count: number }[];
  recentTasks: Task[];
}

export function isWithinLastDays(
  dateText: string | undefined,
  days: number,
): boolean {
  if (!dateText) return false;
  const normalized = normalizeTaskDate(dateText);
  if (normalized === "-") return false;

  const baseDate = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return false;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return baseDate >= start && baseDate <= today;
}

export function buildMonthlySummary(taskList: Task[]): MonthlySummary {
  const tasks30 = taskList.filter((task) => isWithinLastDays(task.date, 30));
  const todo = tasks30.filter((task) => task.status === "todo").length;
  const inProgress = tasks30.filter(
    (task) => task.status === "in-progress",
  ).length;
  const inTest = tasks30.filter((task) => task.status === "in-test").length;
  const done = tasks30.filter((task) => task.status === "done").length;
  const archived = tasks30.filter((task) => task.is_archived).length;
  const totalMinutes = tasks30.reduce(
    (sum, task) => sum + (task.duration_minutes || 0),
    0,
  );

  const toSortedPairs = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));

  const projectMap = new Map<string, number>();
  const assigneeMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  for (const task of tasks30) {
    const projectName =
      (task.project || "ไม่ระบุโปรเจกต์").trim() || "ไม่ระบุโปรเจกต์";
    projectMap.set(projectName, (projectMap.get(projectName) || 0) + 1);

    const assigneeName =
      (task.assignee?.name || "ไม่ระบุผู้รับผิดชอบ").trim() ||
      "ไม่ระบุผู้รับผิดชอบ";
    assigneeMap.set(assigneeName, (assigneeMap.get(assigneeName) || 0) + 1);

    const categoryName = (task.category || "อื่นๆ").trim() || "อื่นๆ";
    categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
  }

  const recentTasks = [...tasks30]
    .sort((a, b) =>
      normalizeTaskDate(b.date).localeCompare(normalizeTaskDate(a.date)),
    )
    .slice(0, 12);

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  const dailyMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dailyMap.set(formatDateISO(date), 0);
  }
  for (const task of tasks30) {
    const key = normalizeTaskDate(task.date);
    if (dailyMap.has(key)) {
      dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
    }
  }
  const dailyTrend = [...dailyMap.entries()].map(([date, count]) => ({
    date,
    count,
  }));

  return {
    periodLabel: `${formatDateISO(start)} ถึง ${formatDateISO(today)}`,
    total: tasks30.length,
    todo,
    inProgress,
    inTest,
    done,
    archived,
    totalMinutes,
    avgPerDay: tasks30.length / 30,
    projectBreakdown: toSortedPairs(projectMap).slice(0, 8),
    assigneeBreakdown: toSortedPairs(assigneeMap).slice(0, 8),
    categoryBreakdown: toSortedPairs(categoryMap).slice(0, 8),
    dailyTrend,
    recentTasks,
  };
}
